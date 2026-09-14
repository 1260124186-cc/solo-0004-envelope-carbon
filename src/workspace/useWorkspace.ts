import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import type { Assembly, Layer } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { EnvelopeData } from '../persistence/types'
import { createAssembly, createLayer, duplicateAssembly, moveLayer } from '../assemblies/factory'
import { requireEditable, validateAssembly } from '../assemblies/validation'
import { validateMaterial } from '../materials/validation'
import { calculate } from '../carbon/engine'
import { createDocument } from '../documents/create'
import { commitData, readData } from '../persistence/repository'
import { persistenceKey } from '../persistence/types'
import {
  clearDraftRecord,
  readDraftRecord,
  writeDraftRecord,
  type DraftRecord,
} from '../drafts/store'
import { diffAssemblies, type AssemblyDiff } from '../drafts/diff'
import { clone, newId, now } from '../shared/identity'

export type WorkspaceTab = 'design' | 'compare' | 'documents' | 'materials'

const draftDebounceMs = 800

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

  // 恢复提示状态。pendingDraft 为 null 表示没有待处理的异常草稿。
  const pendingDraft = shallowRef<DraftRecord | null>(null)
  const pendingSaved = shallowRef<Assembly | null>(null)
  const pendingDiff = shallowRef<AssemblyDiff | null>(null)
  const draftStale = shallowRef(false)
  const draftFinalized = shallowRef(false)

  // 草稿自动保存状态（响应式，供编辑区显示）。
  const draftSavedAt = shallowRef('')
  const draftWriteFailed = shallowRef(false)

  // 当前编辑会话开始时的正式版本基准。恢复过期草稿时保留草稿自带基准，
  // 避免后续自动保存把“过期”标记悄悄冲掉。
  let sessionBaseRevision = 0
  let sessionBaseStamp = ''
  let sessionBaseline = ''
  let sessionCreatedAt = now()
  let draftTimer: ReturnType<typeof setTimeout> | null = null

  const persisted = computed(() =>
    data.value?.assemblies.find((item) => item.id === draft.value?.id),
  )
  const dirty = computed(() => {
    if (!draft.value) return false
    const current = data.value?.assemblies.find((item) => item.id === draft.value!.id)
    if (!current) return true
    return JSON.stringify(draft.value) !== JSON.stringify(current)
  })
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
  const draftStatus = computed(() => {
    if (draftWriteFailed.value) return '草稿自动保存失败，请检查浏览器存储权限。'
    if (!draftSavedAt.value) return ''
    const time = new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(draftSavedAt.value))
    return `草稿已自动保存 · ${time}`
  })

  function clearFeedback() {
    notice.value = ''
    error.value = ''
  }

  // 记录本会话编辑所基于的正式版本与内容快照。
  function captureBase(assembly: Assembly | null) {
    const existing = assembly
      ? data.value?.assemblies.find((item) => item.id === assembly.id)
      : undefined
    sessionBaseRevision = existing ? existing.revision : 0
    sessionBaseStamp = existing ? data.value!.stamp : ''
    sessionBaseline = JSON.stringify(assembly)
  }

  function mayDiscard(): boolean {
    return !dirty.value || window.confirm('当前构造有未保存的修改，是否放弃这些修改？')
  }

  function buildRecord(assembly: Assembly): DraftRecord {
    return {
      schema: 1,
      assembly: clone(assembly),
      baseRevision: sessionBaseRevision,
      baseStamp: sessionBaseStamp,
      createdAt: sessionCreatedAt,
      updatedAt: now(),
    }
  }

  // 立即把当前编辑内容写入独立草稿存储；从不触碰正式存储键。
  function flushDraft() {
    if (draftTimer) {
      clearTimeout(draftTimer)
      draftTimer = null
    }
    if (!draft.value) return
    // 内容回到会话开始时的快照（或与正式版本完全一致）时无需保留草稿。
    if (JSON.stringify(draft.value) === sessionBaseline) {
      clearDraftRecord()
      draftSavedAt.value = ''
      draftWriteFailed.value = false
      return
    }
    const ok = writeDraftRecord(buildRecord(draft.value))
    draftWriteFailed.value = !ok
    if (ok) draftSavedAt.value = new Date().toISOString()
  }

  function scheduleDraft() {
    if (draftTimer) clearTimeout(draftTimer)
    draftTimer = setTimeout(flushDraft, draftDebounceMs)
  }

  function beginSession(assembly: Assembly | null) {
    captureBase(assembly)
    sessionCreatedAt = now()
    draftSavedAt.value = ''
    draftWriteFailed.value = false
    draft.value = assembly ? clone(assembly) : null
  }

  function load(initial = false) {
    if (!initial) {
      if (!mayDiscard()) return
      // 用户显式重新加载/放弃：本地未提交草稿一并作废。
      if (draftTimer) clearTimeout(draftTimer)
      clearDraftRecord()
    }
    try {
      const next = readData()
      const selectedId = draft.value?.id
      data.value = next
      const selected =
        next.assemblies.find((item) => item.id === selectedId) ?? next.assemblies[0] ?? null
      beginSession(selected)
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
    if (busy.value || pendingDraft.value || !mayDiscard()) return
    const selected = data.value?.assemblies.find((item) => item.id === id)
    if (!selected) return
    // 用户已显式放弃未保存修改：直接作废草稿，不依赖快照比对。
    if (draftTimer) clearTimeout(draftTimer)
    clearDraftRecord()
    beginSession(selected)
    clearFeedback()
    tab.value = 'design'
  }

  function create() {
    if (busy.value || pendingDraft.value || !mayDiscard()) return
    if (draftTimer) clearTimeout(draftTimer)
    clearDraftRecord()
    beginSession(createAssembly())
    clearFeedback()
    tab.value = 'design'
  }

  function duplicate() {
    if (busy.value || !draft.value) return
    if (dirty.value) {
      error.value = '请先保存当前构造，再复制替代方案。'
      return
    }
    if (draftTimer) clearTimeout(draftTimer)
    clearDraftRecord()
    beginSession(duplicateAssembly(draft.value))
    alternativeId.value = draft.value.id
    tab.value = 'design'
    clearFeedback()
    notice.value = '已创建替代构造草稿，修改后保存即可比较。'
  }

  function update(patch: Partial<Assembly>) {
    if (!draft.value || !editable.value || busy.value || pendingDraft.value) return
    draft.value = { ...draft.value, ...patch }
    clearFeedback()
    scheduleDraft()
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
    const current = data.value.assemblies.find((item) => item.id === draft.value!.id)
    // 草稿基于的正式修订已被别的会话推进：必须让用户显式知情，不能静默覆盖。
    if (
      current &&
      sessionBaseRevision !== 0 &&
      current.revision > sessionBaseRevision &&
      !window.confirm(
        `该构造已由别处保存到修订 ${current.revision}（草稿基于修订 ${sessionBaseRevision}）。继续保存将用当前编辑覆盖最新正式版本。\n\n选择“取消”可改用“另存为新构造”保留两份内容。确定覆盖吗？`,
      )
    ) {
      return
    }
    const candidate = clone(draft.value)
    candidate.name = candidate.name.trim()
    candidate.revision = current ? current.revision + 1 : 1
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
      // 正式保存是唯一的正式写入入口；成功后同步内存基准并清除草稿存储。
      draft.value = clone(candidate)
      captureBase(candidate)
      draftSavedAt.value = ''
      draftWriteFailed.value = false
      clearDraftRecord()
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
      draft.value = clone(data.value!.assemblies.find((item) => item.id === id)!)
      captureBase(draft.value)
      clearDraftRecord()
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
      captureBase(draft.value)
      clearDraftRecord()
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
      captureBase(draft.value)
      clearDraftRecord()
    }
  }

  // ---- 草稿恢复 ----

  function presentDraftRecovery() {
    if (!data.value) return
    const record = readDraftRecord()
    if (!record) return
    const savedAssembly = data.value.assemblies.find((item) => item.id === record.assembly.id)
    if (savedAssembly) {
      const diff = diffAssemblies(savedAssembly, record.assembly, data.value.materials)
      // 草稿与正式版本内容一致且基准未前进（例如保存成功后崩溃），无需打扰用户。
      if (!diff.hasChanges && savedAssembly.revision === record.baseRevision) {
        clearDraftRecord()
        return
      }
      pendingDiff.value = diff
      draftStale.value = savedAssembly.revision !== record.baseRevision
      draftFinalized.value = savedAssembly.state === 'finalized'
    } else {
      pendingDiff.value = null
      draftStale.value = false
      draftFinalized.value = false
    }
    pendingSaved.value = savedAssembly ?? null
    pendingDraft.value = record
  }

  function recoverDraft() {
    const record = pendingDraft.value
    if (!record) return
    // 保留草稿自带的基准修订，过期状态必须延续到用户保存确认为止。
    sessionBaseRevision = record.baseRevision
    sessionBaseStamp = record.baseStamp
    sessionBaseline = JSON.stringify(record.assembly)
    sessionCreatedAt = record.createdAt
    draftSavedAt.value = ''
    draftWriteFailed.value = false
    draft.value = clone(record.assembly)
    pendingDraft.value = null
    pendingSaved.value = null
    pendingDiff.value = null
    tab.value = 'design'
    clearFeedback()
    notice.value = draftStale.value
      ? '已恢复过期草稿：正式版本已更新，保存时会再次要求确认，也可另存为新构造。'
      : '草稿已恢复到编辑区，确认后可保存或另存为新构造。'
  }

  function discardDraft() {
    const targetId = pendingDraft.value?.assembly.id
    clearDraftRecord()
    pendingDraft.value = null
    pendingSaved.value = null
    pendingDiff.value = null
    draftStale.value = false
    draftFinalized.value = false
    // 回到草稿所针对构造的最近正式版本；该构造已不存在时回到列表首个构造。
    const fallback =
      data.value?.assemblies.find((item) => item.id === targetId) ??
      data.value?.assemblies[0] ??
      null
    beginSession(fallback)
    clearFeedback()
    notice.value = '草稿已放弃，编辑区显示最近保存的正式版本。'
  }

  async function saveDraftAsNew() {
    const record = pendingDraft.value
    if (!record || !data.value || busy.value) return
    const candidate = clone(record.assembly)
    if (validateAssembly(candidate, data.value.materials).length) {
      error.value = '草稿存在未修正的问题，请先恢复到编辑区补全后再另存。'
      return
    }
    candidate.id = newId('envelope')
    candidate.name = `${candidate.name.trim().slice(0, 42) || '未命名构造'} · 草稿恢复`
    candidate.state = 'editing'
    candidate.revision = 1
    candidate.updatedAt = now()
    const saved = await act((next) => {
      if (next.assemblies.length >= 200) throw new Error('最多保存 200 个构造。')
      next.assemblies.push(candidate)
    }, '草稿已另存为新构造，原正式版本保持不变。')
    if (saved) {
      clearDraftRecord()
      pendingDraft.value = null
      pendingSaved.value = null
      pendingDiff.value = null
      draftStale.value = false
      draftFinalized.value = false
      beginSession(candidate)
      tab.value = 'design'
    }
  }

  function onStorage(event: StorageEvent) {
    if (
      event.storageArea === localStorage &&
      (event.key === persistenceKey || event.key === null)
    ) {
      externalChange.value = true
    }
  }

  function beforeUnload(event: BeforeUnloadEvent) {
    // 关闭前同步落盘最新草稿（独立草稿键，不经正式写入路径）。
    flushDraft()
    if (dirty.value) event.preventDefault()
  }

  function flushOnHidden() {
    if (document.visibilityState === 'hidden') flushDraft()
  }

  onMounted(() => {
    load(true)
    presentDraftRecovery()
    window.addEventListener('storage', onStorage)
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('pagehide', flushOnHidden)
    document.addEventListener('visibilitychange', flushOnHidden)
  })
  onUnmounted(() => {
    if (draftTimer) clearTimeout(draftTimer)
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('beforeunload', beforeUnload)
    window.removeEventListener('pagehide', flushOnHidden)
    document.removeEventListener('visibilitychange', flushOnHidden)
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
    draftStatus,
    pendingDraft,
    pendingSaved,
    pendingDiff,
    draftStale,
    draftFinalized,
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
    recoverDraft,
    discardDraft,
    saveDraftAsNew,
  }
}
