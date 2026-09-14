import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import type { Assembly, Layer } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { EnvelopeData } from '../persistence/types'
import { createAssembly, createLayer, duplicateAssembly, moveLayer } from '../assemblies/factory'
import { requireEditable, validateAssembly } from '../assemblies/validation'
import { EditHistory } from '../assemblies/editHistory'
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
  const history = shallowRef<EditHistory | null>(null)
  const historyTick = shallowRef(0)
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
  const canUndo = computed(
    () =>
      historyTick.value >= 0 && editable.value && !busy.value && Boolean(history.value?.canUndo()),
  )
  const canRedo = computed(
    () =>
      historyTick.value >= 0 && editable.value && !busy.value && Boolean(history.value?.canRedo()),
  )
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

  /**
   * 接受一个构造进入当前编辑，并以它为边界建立全新的撤销历史。
   * 历史只服务当前编辑：切换构造、新建、复制、重新加载都会清空旧历史。
   */
  function adopt(next: Assembly | null): void {
    draft.value = next ? clone(next) : null
    history.value = next ? new EditHistory(next) : null
    historyTick.value += 1
  }

  /** 应用一次编辑：记录历史、更新草稿。非空 coalesce 用于同一输入框的连续输入合并。 */
  function commit(next: Assembly, coalesce: string | null = null): void {
    const before = draft.value
    if (!before) return
    history.value?.record(before, next, coalesce)
    draft.value = next
    historyTick.value += 1
  }

  function load(initial = false) {
    if (!initial && !mayDiscard()) return
    try {
      const next = readData()
      const selectedId = draft.value?.id
      data.value = next
      adopt(next.assemblies.find((item) => item.id === selectedId) ?? next.assemblies[0] ?? null)
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
    adopt(selected)
    clearFeedback()
    tab.value = 'design'
  }

  function create() {
    if (busy.value || !mayDiscard()) return
    adopt(createAssembly())
    clearFeedback()
    tab.value = 'design'
  }

  function duplicate() {
    if (busy.value || !draft.value) return
    if (dirty.value) {
      error.value = '请先保存当前构造，再复制替代方案。'
      return
    }
    const copy = duplicateAssembly(draft.value)
    baselineId.value = draft.value.id
    adopt(copy)
    alternativeId.value = copy.id
    tab.value = 'design'
    clearFeedback()
    notice.value = '已创建替代构造草稿，修改后保存即可比较。'
  }

  function update(patch: Partial<Assembly>, coalesce: string | null = null) {
    if (!draft.value || !editable.value || busy.value) return
    commit({ ...draft.value, ...patch }, coalesce)
    clearFeedback()
  }

  function addMaterial(material: Material) {
    if (!draft.value || !editable.value || busy.value) return
    if (draft.value.layers.length >= 20) {
      error.value = '单个构造最多包含 20 层。'
      return
    }
    clearFeedback()
    commit({ ...draft.value, layers: [...draft.value.layers, createLayer(material)] })
  }

  function updateLayer(id: string, patch: Partial<Layer>, coalesce: string | null = null) {
    if (!draft.value || !editable.value || busy.value) return
    commit(
      {
        ...draft.value,
        layers: draft.value.layers.map((layer) =>
          layer.id === id ? { ...layer, ...patch } : layer,
        ),
      },
      coalesce,
    )
    clearFeedback()
  }

  function removeLayer(id: string) {
    if (!draft.value || !editable.value || busy.value) return
    commit({ ...draft.value, layers: draft.value.layers.filter((layer) => layer.id !== id) })
    clearFeedback()
  }

  function move(id: string, direction: -1 | 1) {
    if (!draft.value || !editable.value || busy.value) return
    commit({ ...draft.value, layers: moveLayer(draft.value.layers, id, direction) })
    clearFeedback()
  }

  /**
   * 撤销一步：回到记录的修改前快照。历史栈本身不直接改草稿，
   * 所有派生状态（dirty、校验发现、计算结果）随草稿统一恢复，
   * 因此不会出现界面回退而保存按钮仍判定有改动的脱节。
   */
  function undo() {
    if (!draft.value || !history.value || !canUndo.value) return
    const previous = history.value.undo(draft.value)
    if (!previous) return
    draft.value = previous
    historyTick.value += 1
    clearFeedback()
  }

  /** 重做一步；重做后若再做新修改，commit 会自动清空失效的重做记录。 */
  function redo() {
    if (!draft.value || !history.value || !canRedo.value) return
    const next = history.value.redo(draft.value)
    if (!next) return
    draft.value = next
    historyTick.value += 1
    clearFeedback()
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
    if (saved) {
      // 保存点就是历史边界：以已保存版本重建历史，撤销可回到此处，
      // 此时无未保存修改、dirty 与计算结果都随草稿同步恢复。
      adopt(candidate)
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
      adopt(data.value!.assemblies.find((item) => item.id === id)!)
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
      // 重新开启编辑是新的历史边界：旧编辑会话的撤销栈不带入新一轮编辑。
      adopt(data.value!.assemblies.find((item) => item.id === id)!)
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
      adopt(data.value!.assemblies.find((item) => item.id === draft.value!.id)!)
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

  function onKeydown(event: KeyboardEvent) {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return
    const key = event.key.toLowerCase()
    const redoShortcut = key === 'y' || (key === 'z' && event.shiftKey)
    if (key !== 'z' && !redoShortcut) return
    // 焦点在可编辑控件内时让浏览器处理原生撤销/重做，避免打断同一输入框内的文本操作。
    const target = event.target as HTMLElement | null
    const tag = target?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
      return
    }
    if (redoShortcut) {
      if (!canRedo.value) return
      event.preventDefault()
      redo()
    } else {
      if (!canUndo.value) return
      event.preventDefault()
      undo()
    }
  }

  onMounted(() => {
    load(true)
    window.addEventListener('storage', onStorage)
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('keydown', onKeydown)
  })
  onUnmounted(() => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('beforeunload', beforeUnload)
    window.removeEventListener('keydown', onKeydown)
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
    canUndo,
    canRedo,
    findings,
    result,
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
    undo,
    redo,
    save,
    finalize,
    reopen,
    addCustomMaterial,
    alignAlternative,
  }
}
