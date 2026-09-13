import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import type { Assembly, Layer } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { EnvelopeData } from '../persistence/types'
import type { EnvelopeScheme } from '../schemes/types'
import { createAssembly, createLayer, duplicateAssembly, moveLayer } from '../assemblies/factory'
import { requireEditable, validateAssembly } from '../assemblies/validation'
import { validateMaterial } from '../materials/validation'
import { calculate } from '../carbon/engine'
import { createDocument } from '../documents/create'
import { assemblyChecksum, createEntry, createScheme } from '../schemes/factory'
import { validateScheme } from '../schemes/validation'
import { evaluateScheme } from '../schemes/engine'
import { commitData, readData } from '../persistence/repository'
import { persistenceKey } from '../persistence/types'
import { clone, newId, now } from '../shared/identity'

export type WorkspaceTab = 'design' | 'compare' | 'schemes' | 'documents' | 'materials'

export function useWorkspace() {
  const data = shallowRef<EnvelopeData | null>(null)
  const draft = ref<Assembly | null>(null)
  const schemeDraft = ref<EnvelopeScheme | null>(null)
  const tab = shallowRef<WorkspaceTab>('design')
  const notice = shallowRef('')
  const error = shallowRef('')
  const busy = shallowRef(false)
  const externalChange = shallowRef(false)
  const fatal = shallowRef('')
  const baselineId = shallowRef('')
  const alternativeId = shallowRef('')
  const persisted = computed(() =>
    data.value?.assemblies.find((item) => item.id === draft.value?.id),
  )
  const dirty = computed(() =>
    Boolean(draft.value && JSON.stringify(draft.value) !== JSON.stringify(persisted.value)),
  )
  const persistedScheme = computed(() =>
    data.value?.schemes.find((item) => item.id === schemeDraft.value?.id),
  )
  const schemeDirty = computed(() =>
    Boolean(
      schemeDraft.value &&
        JSON.stringify(schemeDraft.value) !== JSON.stringify(persistedScheme.value),
    ),
  )
  const anyDirty = computed(() => dirty.value || schemeDirty.value)
  const editable = computed(() => draft.value?.state === 'editing')
  const findings = computed(() =>
    draft.value ? validateAssembly(draft.value, data.value?.materials ?? []) : [],
  )
  const result = computed(() => {
    if (!draft.value || !data.value || findings.value.length) return null
    return calculate(draft.value, data.value.materials)
  })
  const schemeFindings = computed(() =>
    schemeDraft.value ? validateScheme(schemeDraft.value) : [],
  )
  const schemeEvaluation = computed(() =>
    schemeDraft.value && data.value
      ? evaluateScheme(schemeDraft.value, data.value.assemblies)
      : null,
  )
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
    if (dirty.value) {
      return window.confirm('当前构造有未保存的修改，是否放弃这些修改？')
    }
    if (schemeDirty.value) {
      return window.confirm('当前围护组合有未保存的修改，是否放弃这些修改？')
    }
    return true
  }

  function load(initial = false) {
    if (!initial && !mayDiscard()) return
    try {
      const next = readData()
      const selectedId = draft.value?.id
      const selectedSchemeId = schemeDraft.value?.id
      data.value = next
      draft.value = clone(
        next.assemblies.find((item) => item.id === selectedId) ?? next.assemblies[0] ?? null,
      )
      schemeDraft.value = clone(
        next.schemes.find((item) => item.id === selectedSchemeId) ?? next.schemes[0] ?? null,
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
    if (saved) draft.value = clone(candidate)
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
    }
  }

  function selectScheme(id: string) {
    if (busy.value || !mayDiscard()) return
    const selected = data.value?.schemes.find((item) => item.id === id)
    if (!selected) return
    schemeDraft.value = clone(selected)
    clearFeedback()
    tab.value = 'schemes'
  }

  function createSchemeDraft() {
    if (busy.value || !mayDiscard()) return
    if (!data.value || data.value.assemblies.length === 0) {
      error.value = '请先在构造编辑中保存至少一个构造，再建立围护组合。'
      return
    }
    schemeDraft.value = createScheme()
    clearFeedback()
    tab.value = 'schemes'
  }

  function updateScheme(patch: Partial<EnvelopeScheme>) {
    if (!schemeDraft.value || busy.value) return
    schemeDraft.value = { ...schemeDraft.value, ...patch }
    clearFeedback()
  }

  function addSchemeEntry(assemblyId: string) {
    if (!schemeDraft.value || !data.value || busy.value) return
    if (schemeDraft.value.entries.length >= 50) {
      error.value = '单个组合最多包含 50 个部位。'
      return
    }
    const assembly = data.value.assemblies.find((item) => item.id === assemblyId)
    if (!assembly) {
      error.value = '所选构造不存在，请重新选择。'
      return
    }
    schemeDraft.value = {
      ...schemeDraft.value,
      entries: [...schemeDraft.value.entries, createEntry(assembly, data.value.materials)],
    }
    clearFeedback()
  }

  function updateSchemeEntry(entryId: string, area: number) {
    if (!schemeDraft.value) return
    // 只修改组合内面积，绝不写回被引用的原构造。
    updateScheme({
      entries: schemeDraft.value.entries.map((entry) =>
        entry.id === entryId ? { ...entry, area } : entry,
      ),
    })
  }

  function removeSchemeEntry(entryId: string) {
    if (!schemeDraft.value) return
    updateScheme({
      entries: schemeDraft.value.entries.filter((entry) => entry.id !== entryId),
    })
  }

  /** 保留冻结版本：不改动快照与结果，仅记录已确认，避免重复提示。 */
  function keepSchemeEntry(entryId: string) {
    if (!schemeDraft.value || !data.value) return
    const entry = schemeDraft.value.entries.find((item) => item.id === entryId)
    if (!entry) return
    const live = data.value.assemblies.find((item) => item.id === entry.assemblyId)
    // 原构造仍在：确认当前最新校验值；已删除：以冻结校验值作为已确认标记。
    const acknowledged = live ? assemblyChecksum(live) : entry.checksum
    updateScheme({
      entries: schemeDraft.value.entries.map((item) =>
        item.id === entryId ? { ...item, acknowledgedChecksum: acknowledged } : item,
      ),
    })
    notice.value = `已保留「${entry.name}」引用时的冻结版本（修订 ${entry.revision}），组合结果不变；保存后提示不再出现。`
    error.value = ''
  }

  /** 更新引用：用原构造当前版本替换快照，结果随之改变，需用户显式确认。 */
  function updateSchemeEntryReference(entryId: string) {
    if (!schemeDraft.value || !data.value) return
    const entry = schemeDraft.value.entries.find((item) => item.id === entryId)
    const live = data.value.assemblies.find((item) => item.id === entry?.assemblyId)
    if (!schemeDraft.value || !entry || !live) return
    const refreshed = createEntry(live, data.value.materials, entry.area)
    refreshed.id = entry.id
    updateScheme({
      entries: schemeDraft.value.entries.map((item) => (item.id === entryId ? refreshed : item)),
    })
    notice.value = `已将「${live.name}」更新为修订 ${live.revision} 的当前版本，结果已按新版本重算；确认后请保存组合。`
    error.value = ''
  }

  async function saveScheme() {
    if (!schemeDraft.value || !data.value) return
    if (schemeFindings.value.length) {
      error.value = schemeFindings.value[0].text
      return
    }
    const candidate = clone(schemeDraft.value)
    candidate.name = candidate.name.trim()
    candidate.revision += 1
    candidate.updatedAt = now()
    const saved = await act((next) => {
      const index = next.schemes.findIndex((item) => item.id === candidate.id)
      if (index >= 0) {
        next.schemes[index] = candidate
      } else {
        if (next.schemes.length >= 100) throw new Error('最多保存 100 个围护组合。')
        next.schemes.push(candidate)
      }
    }, '围护组合已保存，引用版本与面积均已固定。')
    if (saved) schemeDraft.value = clone(candidate)
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
    if (anyDirty.value) event.preventDefault()
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
    schemeDraft,
    tab,
    notice,
    error,
    fatal,
    busy,
    externalChange,
    dirty,
    schemeDirty,
    anyDirty,
    editable,
    findings,
    result,
    schemeFindings,
    schemeEvaluation,
    selectedDocuments,
    baselineId,
    alternativeId,
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
    selectScheme,
    createSchemeDraft,
    updateScheme,
    addSchemeEntry,
    updateSchemeEntry,
    removeSchemeEntry,
    keepSchemeEntry,
    updateSchemeEntryReference,
    saveScheme,
  }
}
