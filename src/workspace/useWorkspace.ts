import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import type { Assembly, Layer } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { EnvelopeData } from '../persistence/types'
import { createAssembly, createLayer, duplicateAssembly, moveLayer } from '../assemblies/factory'
import { requireEditable, validateAssembly } from '../assemblies/validation'
import { archiveBlockReason, archiveBlockText, archiveId, restoreId } from '../assemblies/archive'
import { validateMaterial } from '../materials/validation'
import { calculate } from '../carbon/engine'
import { createDocument } from '../documents/create'
import { commitData, readData } from '../persistence/repository'
import { persistenceKey } from '../persistence/types'
import { clone, newId, now } from '../shared/identity'

export type WorkspaceTab = 'design' | 'compare' | 'documents' | 'materials'

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
  /** 归档只影响可见性：选择器与比较只看到未归档构造，实体全部保留在存储中。 */
  const visibleAssemblies = computed(() =>
    (data.value?.assemblies ?? []).filter((item) => !data.value!.archives.includes(item.id)),
  )
  const archivedAssemblies = computed(() =>
    (data.value?.assemblies ?? []).filter((item) => data.value!.archives.includes(item.id)),
  )
  const draftArchived = computed(() =>
    Boolean(draft.value && data.value?.archives.includes(draft.value.id)),
  )

  function clearFeedback() {
    notice.value = ''
    error.value = ''
  }

  function mayDiscard(): boolean {
    return !dirty.value || window.confirm('当前构造有未保存的修改，是否放弃这些修改？')
  }

  function load(initial = false) {
    if (!initial && !mayDiscard()) return
    try {
      const next = readData()
      const visible = next.assemblies.filter((item) => !next.archives.includes(item.id))
      const selectedId = draft.value?.id
      // 重新载入后只保留仍可见的当前构造；若已被其他标签页归档则回到列表首个。
      const reopened = visible.find((item) => item.id === selectedId)
      data.value = next
      draft.value = clone(reopened ?? visible[0] ?? null)
      const preferBaseline = baselineId.value
      const preferAlternative = alternativeId.value
      const choose = (preferred: string, fallbackIndex: number) =>
        visible.find((item) => item.id === preferred)?.id ?? visible[fallbackIndex]?.id ?? ''
      baselineId.value = choose(preferBaseline, 0)
      alternativeId.value = choose(preferAlternative, 1)
      if (baselineId.value === alternativeId.value) alternativeId.value = visible[1]?.id ?? ''
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
    const selected = visibleAssemblies.value.find((item) => item.id === id)
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
    if (busy.value || !draft.value || blockArchivedDraft()) return
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

  /** 归档构造不可编辑：必须先恢复，恢复不改变定稿状态与历史计算书。 */
  function blockArchivedDraft(): boolean {
    if (draft.value && data.value?.archives.includes(draft.value.id)) {
      error.value = '该构造已归档并从工作列表隐藏。请先恢复，再继续编辑；恢复不会改变定稿与计算书。'
      return true
    }
    return false
  }

  function update(patch: Partial<Assembly>) {
    if (!draft.value || !editable.value || busy.value || blockArchivedDraft()) return
    draft.value = { ...draft.value, ...patch }
    clearFeedback()
  }

  function addMaterial(material: Material) {
    if (!draft.value || !editable.value || busy.value || blockArchivedDraft()) return
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
    if (!draft.value || !data.value || !editable.value || blockArchivedDraft()) return
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
    if (blockArchivedDraft()) return
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
    if (!draft.value || blockArchivedDraft()) return
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

  /**
   * 归档：只把构造标识移入隐藏列表，不触碰构造实体、定稿状态和计算书。
   * 正在编辑区打开的编辑中构造、方案比较当前选中的构造都拒绝归档。
   */
  async function archive(id: string) {
    if (!data.value) return
    const reason = archiveBlockReason({
      assemblies: data.value.assemblies,
      archives: data.value.archives,
      id,
      openDraftId: draft.value?.id ?? null,
      draftState: draft.value?.state ?? null,
      baselineId: baselineId.value,
      alternativeId: alternativeId.value,
    })
    if (reason) {
      error.value = archiveBlockText[reason]
      return
    }
    const saved = await act((next) => {
      const assembly = next.assemblies.find((item) => item.id === id)
      if (!assembly) throw new Error('构造不存在。')
      if (next.archives.includes(id)) throw new Error('该构造已经归档。')
      if (id === baselineId.value || id === alternativeId.value)
        throw new Error('该构造正参与方案比较，请先在方案比较中改选其他构造。')
      next.archives = archiveId(next.archives, id)
    }, '构造已归档，从当前列表隐藏；构造与历史计算书均保留，可在归档管理中恢复。')
    if (saved && draft.value?.id === id) {
      const next = data.value!
      const visible = next.assemblies.filter((item) => !next.archives.includes(item.id))
      draft.value = clone(visible[0] ?? null)
    }
    if (saved) {
      // 归档构造不再能作为比较选择；清空对应槽位，留给用户重新选择。
      if (baselineId.value === id) baselineId.value = ''
      if (alternativeId.value === id) alternativeId.value = ''
    }
  }

  /** 恢复：只把标识移出归档列表，构造按原身份（状态、修订、计算书）回到工作列表。 */
  async function restore(id: string) {
    if (!data.value) return
    const assembly = data.value.assemblies.find((item) => item.id === id)
    if (!assembly) {
      error.value = '构造不存在，无法恢复。'
      return
    }
    const saved = await act((next) => {
      if (!next.archives.includes(id)) throw new Error('该构造不在归档中。')
      next.archives = restoreId(next.archives, id)
    }, '构造已恢复，按原身份回到当前构造列表；定稿与计算书状态均未改变。')
    if (saved && (!draft.value || draft.value.id === id)) {
      draft.value = clone(data.value!.assemblies.find((item) => item.id === id)!)
    }
  }

  /** 显式打开一个归档构造，主要用于查看其历史计算书；定稿构造仍保持只读。 */
  function viewArchived(id: string) {
    if (busy.value || !mayDiscard()) return
    const assembly = data.value?.assemblies.find((item) => item.id === id)
    if (!assembly || !data.value?.archives.includes(id)) return
    draft.value = clone(assembly)
    clearFeedback()
    tab.value = 'documents'
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
      if (next.archives.includes(a.id) || next.archives.includes(b.id))
        throw new Error('选择中包含已归档构造，请先在归档管理中恢复后再比较。')
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

  function onStorage(event: StorageEvent) {
    if (
      event.storageArea === localStorage &&
      (event.key === persistenceKey || event.key === null)
    ) {
      externalChange.value = true
    }
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
    visibleAssemblies,
    archivedAssemblies,
    draftArchived,
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
    archive,
    restore,
    viewArchived,
    addCustomMaterial,
    alignAlternative,
  }
}
