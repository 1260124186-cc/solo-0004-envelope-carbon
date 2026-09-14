import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import type { Assembly, Layer } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { EnvelopeData } from '../persistence/types'
import type { AssemblyDraft } from '../drafts/types'
import type { DraftDiff } from '../drafts/diff'
import { clearDraft, readDraft, writeDraft } from '../drafts/types'
import { diffDraft } from '../drafts/diff'
import { createAssembly, createLayer, duplicateAssembly, moveLayer } from '../assemblies/factory'
import { requireEditable, validateAssembly } from '../assemblies/validation'
import { validateMaterial } from '../materials/validation'
import { calculate } from '../carbon/engine'
import { createDocument } from '../documents/create'
import { commitData, readData } from '../persistence/repository'
import { persistenceKey } from '../persistence/types'
import { clone, newId, now } from '../shared/identity'
import { date } from '../shared/format'

export type WorkspaceTab = 'design' | 'compare' | 'documents' | 'materials'

/** 恢复对话框所需的全部上下文。 */
export interface RecoveryInfo {
  record: AssemblyDraft
  saved: Assembly | null
  stale: boolean
  finalized: boolean
  diff: DraftDiff
}

/** 参与“内容是否相同”判断的字段，排除修订号与更新时间。 */
const editableFingerprintKeys = [
  'name',
  'surface',
  'area',
  'years',
  'carbonLimit',
  'thermalLimit',
  'note',
  'state',
  'layers',
] as const

function fingerprint(assembly: Assembly): string {
  return JSON.stringify(editableFingerprintKeys.map((key) => assembly[key]))
}

function isBlankNewDraft(assembly: Assembly): boolean {
  return fingerprint(assembly) === fingerprint(createAssembly())
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
  const recovery = shallowRef<RecoveryInfo | null>(null)
  const recoveryError = shallowRef('')
  const draftStatus = shallowRef('')
  // 当前编辑上下文的草稿元数据；恢复的过期草稿在保存前需要二次确认。
  let draftOriginId: string | null = null
  let draftBaseStamp = ''
  let draftStartedAt = ''
  let restoreStale = false
  let draftTimer: number | undefined
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

  // ── 草稿自动保存（独立存储，不触碰正式数据、修订戳与互斥锁）──────────────

  function resetDraftMeta(originId: string | null, baseStamp: string) {
    draftOriginId = originId
    draftBaseStamp = baseStamp
    draftStartedAt = ''
    restoreStale = false
    draftStatus.value = ''
  }

  function dropDraftSlot() {
    if (draftTimer !== undefined) {
      window.clearTimeout(draftTimer)
      draftTimer = undefined
    }
    clearDraft()
  }

  /** 当前编辑内容是否应占用草稿槽位；无实质内容或与保存版本一致时清除。 */
  function shouldKeepDraft(current: Assembly): boolean {
    if (current.state === 'finalized') return false
    if (draftOriginId !== null) {
      const saved = data.value?.assemblies.find((item) => item.id === draftOriginId)
      if (!saved) {
        // 起点构造已不存在，把未提交内容作为新构造草稿保留。
        draftOriginId = null
        draftBaseStamp = data.value?.stamp ?? draftBaseStamp
        return true
      }
      return fingerprint(saved) !== fingerprint(current)
    }
    return !isBlankNewDraft(current)
  }

  function persistDraftNow() {
    if (draftTimer !== undefined) {
      window.clearTimeout(draftTimer)
      draftTimer = undefined
    }
    if (!draft.value || busy.value || recovery.value) return
    if (!shouldKeepDraft(draft.value)) {
      clearDraft()
      draftStatus.value = ''
      return
    }
    draftStartedAt = draftStartedAt || now()
    const record: AssemblyDraft = {
      draftSchema: 1,
      assembly: clone(draft.value),
      originId: draftOriginId,
      baseStamp: draftBaseStamp,
      startedAt: draftStartedAt,
      updatedAt: now(),
    }
    try {
      writeDraft(record)
      draftStatus.value = `草稿已于 ${date(record.updatedAt)} 自动保存，异常关闭后可恢复`
    } catch {
      draftStatus.value = '草稿自动保存失败（存储空间不足或被禁用），正式数据未受影响。'
    }
  }

  function scheduleDraftPersist() {
    if (recovery.value) return
    if (draftTimer !== undefined) window.clearTimeout(draftTimer)
    draftTimer = window.setTimeout(persistDraftNow, 800)
  }

  function inspectStoredDraft(next: EnvelopeData) {
    const record = readDraft()
    if (!record) return
    const saved = record.originId
      ? (next.assemblies.find((item) => item.id === record.originId) ?? null)
      : null
    // 与正式版本完全一致的草稿（改动已被撤销）直接静默清理。
    if (saved && fingerprint(saved) === fingerprint(record.assembly)) {
      clearDraft()
      return
    }
    recovery.value = {
      record,
      saved,
      stale: saved !== null && record.baseStamp !== next.stamp,
      finalized: saved?.state === 'finalized',
      diff: diffDraft(record.assembly, saved, next.materials),
    }
  }

  function load(initial = false) {
    if (!initial && !mayDiscard()) return
    try {
      const next = readData()
      const selectedId = draft.value?.id
      data.value = next
      draft.value = clone(
        next.assemblies.find((item) => item.id === selectedId) ?? next.assemblies[0] ?? null,
      )
      baselineId.value = next.assemblies[0]?.id ?? ''
      alternativeId.value = next.assemblies[1]?.id ?? ''
      fatal.value = ''
      externalChange.value = false
      recovery.value = null
      recoveryError.value = ''
      if (initial) {
        resetDraftMeta(draft.value?.id ?? null, next.stamp)
        inspectStoredDraft(next)
        clearFeedback()
      } else {
        dropDraftSlot()
        resetDraftMeta(draft.value?.id ?? null, next.stamp)
        clearFeedback()
        notice.value = '已重新加载保存版本。'
      }
    } catch (cause) {
      fatal.value = cause instanceof Error ? cause.message : '无法读取浏览器存储。'
    }
  }

  function select(id: string) {
    if (busy.value || !mayDiscard()) return
    const selected = data.value?.assemblies.find((item) => item.id === id)
    if (!selected) return
    dropDraftSlot()
    draft.value = clone(selected)
    resetDraftMeta(selected.id, data.value?.stamp ?? '')
    clearFeedback()
    tab.value = 'design'
  }

  function create() {
    if (busy.value || !mayDiscard()) return
    dropDraftSlot()
    draft.value = createAssembly()
    resetDraftMeta(null, data.value?.stamp ?? '')
    clearFeedback()
    tab.value = 'design'
  }

  function duplicate() {
    if (busy.value || !draft.value) return
    if (dirty.value) {
      error.value = '请先保存当前构造，再复制替代方案。'
      return
    }
    dropDraftSlot()
    baselineId.value = draft.value.id
    draft.value = duplicateAssembly(draft.value)
    resetDraftMeta(null, data.value?.stamp ?? '')
    alternativeId.value = draft.value.id
    tab.value = 'design'
    clearFeedback()
    notice.value = '已创建替代构造草稿，修改后保存即可比较。'
  }

  function update(patch: Partial<Assembly>) {
    if (!draft.value || !editable.value || busy.value) return
    draft.value = { ...draft.value, ...patch }
    clearFeedback()
    scheduleDraftPersist()
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

  async function act(change: (next: EnvelopeData) => void, text: string): Promise<boolean> {
    if (!data.value || busy.value || fatal.value) return false
    clearFeedback()
    busy.value = true
    try {
      data.value = await commitData(data.value.stamp, change)
      externalChange.value = false
      notice.value = text
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '操作未完成，请重试。'
      return false
    } finally {
      busy.value = false
    }
  }

  async function save() {
    if (!draft.value || !data.value || !editable.value) return
    if (findings.value.length) {
      error.value = findings.value[0].text
      return
    }
    if (
      restoreStale &&
      !window.confirm(
        '该草稿基于更早的保存版本，此后正式数据已被其它标签页修改保存。继续保存会用草稿覆盖当前正式构造。\n建议取消并改用「另存为新构造」，是否仍然覆盖保存？',
      )
    ) {
      return
    }
    const candidate = clone(draft.value)
    candidate.name = candidate.name.trim()
    candidate.revision += 1
    candidate.updatedAt = now()
    const saved = await act((next) => {
      const index = next.assemblies.findIndex((item) => item.id === candidate.id)
      if (index >= 0) {
        requireEditable(next.assemblies[index])
        next.assemblies[index] = candidate
      } else {
        if (next.assemblies.length >= 200) throw new Error('最多保存 200 个构造。')
        next.assemblies.push(candidate)
      }
    }, '构造已保存。')
    if (saved) {
      dropDraftSlot()
      draft.value = clone(candidate)
      resetDraftMeta(candidate.id, data.value.stamp)
    }
  }

  async function finalize() {
    if (!draft.value || !persisted.value || dirty.value) {
      error.value = '请先保存当前构造，再生成定稿。'
      return
    }
    const id = draft.value.id
    const saved = await act((next) => {
      const assembly = next.assemblies.find((item) => item.id === id)
      if (!assembly) throw new Error('构造不存在。')
      if (next.documents.length >= 1000) throw new Error('计算书已达到 1,000 份容量上限。')
      const document = createDocument(assembly, next.materials)
      next.documents.push(document)
      assembly.state = 'finalized'
      assembly.updatedAt = now()
    }, '计算书已定稿，构造现为只读。')
    if (saved) {
      dropDraftSlot()
      draft.value = clone(data.value!.assemblies.find((item) => item.id === id)!)
      resetDraftMeta(id, data.value!.stamp)
      tab.value = 'documents'
    }
  }

  async function reopen() {
    if (!draft.value) return
    const id = draft.value.id
    const saved = await act((next) => {
      const assembly = next.assemblies.find((item) => item.id === id)
      if (!assembly || assembly.state !== 'finalized')
        throw new Error('只有已定稿构造可以重新编辑。')
      assembly.state = 'editing'
      assembly.revision += 1
      assembly.updatedAt = now()
    }, '已重新开启编辑，历史计算书保持不变。')
    if (saved) {
      draft.value = clone(data.value!.assemblies.find((item) => item.id === id)!)
      resetDraftMeta(id, data.value!.stamp)
      tab.value = 'design'
    }
  }

  async function addCustomMaterial(input: Material): Promise<boolean> {
    const candidate = clone({ ...input, id: newId('material'), custom: true })
    const errors = validateMaterial(candidate)
    if (errors.length) {
      error.value = errors[0]
      return false
    }
    return act((next) => {
      if (next.materials.length >= 500) throw new Error('最多保存 500 种材料。')
      if (next.materials.some((material) => material.name.trim() === candidate.name.trim())) {
        throw new Error('材料名称已存在，请使用可区分的名称。')
      }
      candidate.name = candidate.name.trim()
      next.materials.push(candidate)
    }, '自定义材料已保存，可在构造中选用。')
  }

  async function alignAlternative() {
    if (dirty.value) {
      error.value = '请先保存当前构造，避免口径调整覆盖编辑内容。'
      return
    }
    const saved = await act((next) => {
      const a = next.assemblies.find((item) => item.id === baselineId.value)
      const b = next.assemblies.find((item) => item.id === alternativeId.value)
      if (!a || !b || a.id === b.id) throw new Error('请选择两个不同的构造。')
      requireEditable(b)
      b.area = a.area
      b.years = a.years
      b.surface = a.surface
      b.revision += 1
      b.updatedAt = now()
    }, '替代构造已按基准统一部位、面积和年限。')
    if (saved && draft.value) {
      draft.value = clone(data.value!.assemblies.find((item) => item.id === draft.value!.id)!)
      resetDraftMeta(draft.value.id, data.value!.stamp)
    }
  }

  // ── 草稿恢复决策 ─────────────────────────────────────────────────────────

  function restoreDraft() {
    const info = recovery.value
    if (!info || busy.value) return
    draft.value = clone(info.record.assembly)
    draftOriginId = info.record.originId
    draftBaseStamp = info.record.baseStamp
    draftStartedAt = info.record.startedAt
    restoreStale = info.stale
    recovery.value = null
    recoveryError.value = ''
    clearFeedback()
    tab.value = 'design'
    draftStatus.value = `草稿自动保存于 ${date(info.record.updatedAt)}，保存前请再次核对`
    notice.value = info.stale
      ? '已恢复过期草稿：正式版本之后被其它标签页修改过。保存草稿前会再次要求确认，避免覆盖。'
      : '已恢复上次自动保存的草稿，请核对后再保存或放弃。'
  }

  function discardDraft() {
    if (busy.value) return
    dropDraftSlot()
    recovery.value = null
    recoveryError.value = ''
    restoreStale = false
    draftStatus.value = ''
    clearFeedback()
    notice.value = '草稿已放弃，编辑区保持最近保存版本，正式数据未受影响。'
  }

  async function saveDraftAs() {
    const info = recovery.value
    if (!info || !data.value || busy.value) return
    if (!info.saved) {
      recoveryError.value = '这是尚未保存过的新构造草稿，请直接恢复后使用「保存构造」。'
      return
    }
    const candidate = clone(info.record.assembly)
    const problems = validateAssembly(candidate, data.value.materials)
    if (problems.length) {
      recoveryError.value = `草稿内容尚不能保存：${problems[0].text} 请先恢复到编辑区修正。`
      return
    }
    candidate.id = newId('envelope')
    candidate.layers = candidate.layers.map((layer) => ({ ...layer, id: newId('ply') }))
    candidate.name = `${candidate.name.trim().slice(0, 42)} · 草稿另存`
    candidate.state = 'editing'
    candidate.revision = 1
    candidate.updatedAt = now()
    const success = await act((next) => {
      if (next.assemblies.length >= 200) throw new Error('最多保存 200 个构造。')
      next.assemblies.push(candidate)
    }, '草稿已另存为新构造，原构造保持不变。')
    if (!success) {
      // 错误信息展示在恢复对话框内，避免关闭后消失。
      recoveryError.value = error.value
      error.value = ''
      return
    }
    dropDraftSlot()
    draft.value = clone(candidate)
    resetDraftMeta(candidate.id, data.value.stamp)
    recovery.value = null
    recoveryError.value = ''
    tab.value = 'design'
  }

  function onStorage(event: StorageEvent) {
    // 仅正式设计命名空间的变化触发跨标签页保护；草稿槽位变化不影响正式数据。
    if (
      event.storageArea === localStorage &&
      (event.key === persistenceKey || event.key === null)
    ) {
      externalChange.value = true
    }
  }

  function beforeUnload(event: BeforeUnloadEvent) {
    persistDraftNow()
    if (dirty.value) event.preventDefault()
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') persistDraftNow()
  }

  onMounted(() => {
    load(true)
    window.addEventListener('storage', onStorage)
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('pagehide', beforeUnload)
    document.addEventListener('visibilitychange', onVisibilityChange)
  })
  onUnmounted(() => {
    if (draftTimer !== undefined) window.clearTimeout(draftTimer)
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('beforeunload', beforeUnload)
    window.removeEventListener('pagehide', beforeUnload)
    document.removeEventListener('visibilitychange', onVisibilityChange)
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
    recovery,
    recoveryError,
    draftStatus,
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
    restoreDraft,
    discardDraft,
    saveDraftAs,
  }
}
