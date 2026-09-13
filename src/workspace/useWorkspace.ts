import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import type { Assembly, Layer } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { EnvelopeData } from '../persistence/types'
import type { AuditEntry } from '../audit/audit'
import { createAssembly, createLayer, duplicateAssembly, moveLayer } from '../assemblies/factory'
import { requireEditable, validateAssembly } from '../assemblies/validation'
import { validateMaterial } from '../materials/validation'
import { calculate } from '../carbon/engine'
import { createDocument } from '../documents/create'
import { commitData, readData, recordRejection, type AuditIntent } from '../persistence/repository'
import { persistenceKey } from '../persistence/types'
import { currentActor } from '../audit/actor'
import { clone, newId, now } from '../shared/identity'

export type WorkspaceTab = 'design' | 'compare' | 'documents' | 'materials' | 'audit'

/** 轻量读取存储原文的修订标识，避免为判断变化做完整领域校验。 */
function stampOf(raw: string): string | undefined {
  const parsed: unknown = JSON.parse(raw)
  if (parsed && typeof parsed === 'object' && 'stamp' in parsed) {
    const stamp = (parsed as { stamp?: unknown }).stamp
    return typeof stamp === 'string' ? stamp : undefined
  }
  return undefined
}

export function useWorkspace() {
  const data = shallowRef<EnvelopeData | null>(null)
  const draft = ref<Assembly | null>(null)
  const tab = shallowRef<WorkspaceTab>('design')
  const notice = shallowRef('')
  const error = shallowRef('')
  const busy = shallowRef(false)
  const externalChange = shallowRef(false)
  const fatal = shallowRef('')
  const baselineId = shallowRef('')
  const alternativeId = shallowRef('')
  // 审计日志为只读取数，不进入任何编辑状态；最新条目在前。
  const auditEntries = shallowRef<AuditEntry[]>([])
  // 本标签页的操作者标识，整个会话保持不变。
  const actor = currentActor()
  const persisted = computed(() =>
    data.value?.assemblies.find((item) => item.id === draft.value?.id),
  )
  const dirty = computed(() =>
    Boolean(draft.value && JSON.stringify(draft.value) !== JSON.stringify(persisted.value)),
  )
  const editable = computed(() => draft.value?.state === 'editing')
  const findings = computed(() =>
    draft.value ? validateAssembly(draft.value, data.value?.materials ?? []) : [],
  )
  const result = computed(() => {
    if (!draft.value || !data.value || findings.value.length) return null
    return calculate(draft.value, data.value.materials)
  })
  const selectedDocuments = computed(
    () =>
      data.value?.documents
        .filter((document) => document.assemblyId === draft.value?.id)
        .slice()
        .reverse() ?? [],
  )

  function clearFeedback() {
    notice.value = ''
    error.value = ''
  }

  function mayDiscard(): boolean {
    return !dirty.value || window.confirm('当前构造有未保存的修改，是否放弃这些修改？')
  }

  /** 仅重新读取只追加日志，不触碰编辑区与业务状态。 */
  function refreshAudit() {
    try {
      const latest = readData()
      auditEntries.value = latest.audit.slice().reverse()
    } catch {
      // 日志读取失败不影响工作面，保留上一次可见的条目。
    }
  }

  function load(initial = false) {
    if (!initial && !mayDiscard()) return
    try {
      const next = readData()
      const selectedId = draft.value?.id
      data.value = next
      auditEntries.value = next.audit.slice().reverse()
      draft.value = clone(
        next.assemblies.find((item) => item.id === selectedId) ?? next.assemblies[0] ?? null,
      )
      baselineId.value = next.assemblies[0]?.id ?? ''
      alternativeId.value = next.assemblies[1]?.id ?? ''
      fatal.value = ''
      externalChange.value = false
      clearFeedback()
      if (!initial) notice.value = '已重新加载保存版本。'
    } catch (cause) {
      fatal.value = cause instanceof Error ? cause.message : '无法读取浏览器存储。'
    }
  }

  function select(id: string) {
    if (busy.value || !mayDiscard()) return
    const selected = data.value?.assemblies.find((item) => item.id === id)
    if (!selected) return
    draft.value = clone(selected)
    clearFeedback()
    tab.value = 'design'
  }

  function create() {
    if (busy.value || !mayDiscard()) return
    draft.value = createAssembly()
    clearFeedback()
    tab.value = 'design'
  }

  function duplicate() {
    if (busy.value || !draft.value) return
    if (dirty.value) {
      error.value = '请先保存当前构造，再复制替代方案。'
      return
    }
    baselineId.value = draft.value.id
    draft.value = duplicateAssembly(draft.value)
    alternativeId.value = draft.value.id
    tab.value = 'design'
    clearFeedback()
    notice.value = '已创建替代构造草稿，修改后保存即可比较。'
  }

  function update(patch: Partial<Assembly>) {
    if (!draft.value || !editable.value || busy.value) return
    draft.value = { ...draft.value, ...patch }
    clearFeedback()
  }

  function addMaterial(material: Material) {
    if (!draft.value || !editable.value || busy.value) return
    if (draft.value.layers.length >= 20) {
      error.value = '单个构造最多包含 20 层。'
      return
    }
    update({ layers: [...draft.value.layers, createLayer(material)] })
  }

  function updateLayer(id: string, patch: Partial<Layer>) {
    if (!draft.value) return
    update({
      layers: draft.value.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
    })
  }

  function removeLayer(id: string) {
    if (!draft.value) return
    update({ layers: draft.value.layers.filter((layer) => layer.id !== id) })
  }

  function move(id: string, direction: -1 | 1) {
    if (!draft.value) return
    update({ layers: moveLayer(draft.value.layers, id, direction) })
  }

  /**
   * 在进入互斥锁之前被拒绝的尝试（本地校验、脏草稿保护等）。
   * 仍由持久层排队写入审计，保证拒绝动作与成功动作在同一全局序列中可区分。
   */
  async function rejectAttempt(intent: AuditIntent, reason: string): Promise<void> {
    error.value = reason
    await recordRejection(intent, reason)
    refreshAudit()
  }

  async function act(
    change: (next: EnvelopeData) => void,
    text: string,
    intent: AuditIntent,
  ): Promise<boolean> {
    if (!data.value || busy.value || fatal.value) return false
    clearFeedback()
    busy.value = true
    try {
      data.value = await commitData(data.value.stamp, change, intent)
      externalChange.value = false
      notice.value = text
      auditEntries.value = data.value.audit.slice().reverse()
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '操作未完成，请重试。'
      // 冲突或锁内拒绝已由持久层追加“已拒绝”条目，这里同步只读取数。
      refreshAudit()
      return false
    } finally {
      busy.value = false
    }
  }

  async function save() {
    if (!draft.value || !data.value || !editable.value) return
    if (findings.value.length) {
      await rejectAttempt(
        {
          action: 'assembly-save',
          targetKind: 'assembly',
          targetId: draft.value.id,
          targetName: draft.value.name.trim() || '未命名构造',
        },
        findings.value[0].text,
      )
      return
    }
    const candidate = clone(draft.value)
    candidate.name = candidate.name.trim()
    candidate.revision += 1
    candidate.updatedAt = now()
    const existed = data.value.assemblies.some((item) => item.id === candidate.id)
    const intent: AuditIntent = {
      action: existed ? 'assembly-save' : 'assembly-create',
      targetKind: 'assembly',
      targetId: candidate.id,
      targetName: candidate.name,
      detail: existed ? `修订 ${candidate.revision}` : '新建构造',
    }
    const saved = await act(
      (next) => {
        const index = next.assemblies.findIndex((item) => item.id === candidate.id)
        if (index >= 0) {
          requireEditable(next.assemblies[index])
          next.assemblies[index] = candidate
        } else {
          if (next.assemblies.length >= 200) throw new Error('最多保存 200 个构造。')
          next.assemblies.push(candidate)
        }
      },
      '构造已保存。',
      intent,
    )
    if (saved) draft.value = clone(candidate)
  }

  async function finalize() {
    if (!draft.value || !persisted.value || dirty.value) {
      if (draft.value) {
        await rejectAttempt(
          {
            action: 'assembly-finalize',
            targetKind: 'assembly',
            targetId: draft.value.id,
            targetName: draft.value.name.trim() || '未命名构造',
          },
          '请先保存当前构造，再生成定稿。',
        )
      }
      return
    }
    const id = draft.value.id
    const saved = await act(
      (next) => {
        const assembly = next.assemblies.find((item) => item.id === id)
        if (!assembly) throw new Error('构造不存在。')
        if (next.documents.length >= 1000) throw new Error('计算书已达到 1,000 份容量上限。')
        const document = createDocument(assembly, next.materials)
        next.documents.push(document)
        assembly.state = 'finalized'
        assembly.updatedAt = now()
      },
      '计算书已定稿，构造现为只读。',
      {
        action: 'assembly-finalize',
        targetKind: 'assembly',
        targetId: id,
        targetName: draft.value.name,
        detail: `第 ${persisted.value.revision} 版定稿`,
      },
    )
    if (saved) {
      draft.value = clone(data.value!.assemblies.find((item) => item.id === id)!)
      tab.value = 'documents'
    }
  }

  async function reopen() {
    if (!draft.value) return
    const id = draft.value.id
    const name = draft.value.name
    const saved = await act(
      (next) => {
        const assembly = next.assemblies.find((item) => item.id === id)
        if (!assembly || assembly.state !== 'finalized')
          throw new Error('只有已定稿构造可以重新编辑。')
        assembly.state = 'editing'
        assembly.revision += 1
        assembly.updatedAt = now()
      },
      '已重新开启编辑，历史计算书保持不变。',
      {
        action: 'assembly-reopen',
        targetKind: 'assembly',
        targetId: id,
        targetName: name,
        detail: `将开启修订 ${draft.value.revision + 1}`,
      },
    )
    if (saved) {
      draft.value = clone(data.value!.assemblies.find((item) => item.id === id)!)
      tab.value = 'design'
    }
  }

  async function addCustomMaterial(input: Material): Promise<boolean> {
    const candidate = clone({ ...input, id: newId('material'), custom: true })
    const errors = validateMaterial(candidate)
    if (errors.length) {
      await rejectAttempt(
        {
          action: 'material-create',
          targetKind: 'material',
          // 校验失败的材料从未落库，不记录尚未使用的临时标识。
          targetId: '',
          targetName: candidate.name.trim() || '未命名材料',
        },
        errors[0],
      )
      return false
    }
    candidate.name = candidate.name.trim()
    return act(
      (next) => {
        if (next.materials.length >= 500) throw new Error('最多保存 500 种材料。')
        if (next.materials.some((material) => material.name === candidate.name)) {
          throw new Error('材料名称已存在，请使用可区分的名称。')
        }
        next.materials.push(candidate)
      },
      '自定义材料已保存，可在构造中选用。',
      {
        action: 'material-create',
        targetKind: 'material',
        // 锁内被拒绝（重名、容量）时材料同样未落库，成功后才以该标识可查。
        targetId: candidate.id,
        targetName: candidate.name,
      },
    )
  }

  /** 构造口径对齐的审计意图在前置校验与锁内共用，确保拒绝时记录同一对标识。 */
  function alignIntent(next?: EnvelopeData): AuditIntent | null {
    const pool = next ?? data.value
    const a = pool?.assemblies.find((item) => item.id === baselineId.value)
    const b = pool?.assemblies.find((item) => item.id === alternativeId.value)
    if (!a || !b) return null
    return {
      action: 'comparison-align',
      targetKind: 'comparison',
      targetId: `${a.id} → ${b.id}`,
      targetName: `${a.name} → ${b.name}`,
    }
  }

  async function alignAlternative() {
    if (dirty.value) {
      const intent = alignIntent()
      if (intent) {
        await rejectAttempt(intent, '请先保存当前构造，避免口径调整覆盖编辑内容。')
      } else {
        error.value = '请先保存当前构造，避免口径调整覆盖编辑内容。'
      }
      return
    }
    const intent = alignIntent()
    if (!intent) {
      error.value = '请选择两个不同的构造。'
      return
    }
    const saved = await act(
      (next) => {
        const a = next.assemblies.find((item) => item.id === baselineId.value)
        const b = next.assemblies.find((item) => item.id === alternativeId.value)
        if (!a || !b || a.id === b.id) throw new Error('请选择两个不同的构造。')
        requireEditable(b)
        b.area = a.area
        b.years = a.years
        b.surface = a.surface
        b.revision += 1
        b.updatedAt = now()
      },
      '替代构造已按基准统一部位、面积和年限。',
      intent,
    )
    if (saved && draft.value) {
      draft.value = clone(data.value!.assemblies.find((item) => item.id === draft.value!.id)!)
    }
  }

  function onStorage(event: StorageEvent) {
    if (
      event.storageArea !== localStorage ||
      (event.key !== persistenceKey && event.key !== null)
    ) {
      return
    }
    // 审计日志随时只读刷新，不触碰编辑区。
    refreshAudit()
    // 仅日志追加（拒绝记录）不更换修订标识，不应触发“请重新加载”保护。
    let stampChanged = true
    try {
      stampChanged = event.newValue === null || stampOf(event.newValue) !== data.value?.stamp
    } catch {
      stampChanged = true
    }
    if (stampChanged) externalChange.value = true
  }

  function beforeUnload(event: BeforeUnloadEvent) {
    if (dirty.value) event.preventDefault()
  }

  onMounted(() => {
    load(true)
    window.addEventListener('storage', onStorage)
    window.addEventListener('beforeunload', beforeUnload)
  })
  onUnmounted(() => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('beforeunload', beforeUnload)
  })

  return {
    data,
    draft,
    tab,
    notice,
    error,
    fatal,
    busy,
    externalChange,
    dirty,
    editable,
    findings,
    result,
    selectedDocuments,
    baselineId,
    alternativeId,
    auditEntries,
    refreshAudit,
    actor,
    load,
    select,
    create,
    duplicate,
    update,
    addMaterial,
    updateLayer,
    removeLayer,
    move,
    save,
    finalize,
    reopen,
    addCustomMaterial,
    alignAlternative,
  }
}
