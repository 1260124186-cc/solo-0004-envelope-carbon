import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import type { Assembly, Layer } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { EnvelopeData } from '../persistence/types'
import { createAssembly, createLayer, duplicateAssembly, moveLayer } from '../assemblies/factory'
import { requireEditable, validateAssembly } from '../assemblies/validation'
import { validateMaterial } from '../materials/validation'
import { calculate } from '../carbon/engine'
import { createDocument } from '../documents/create'
import { buildFreezePreview, type FreezePreview } from '../documents/preview'
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
  const freezePreview = shallowRef<FreezePreview | null>(null)
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
      const selectedId = draft.value?.id
      data.value = next
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

  function openFinalizePreview() {
    if (!draft.value || !data.value || busy.value) return
    if (dirty.value || !persisted.value) {
      error.value = '请先保存当前构造，再生成定稿；未保存草稿不会进入冻结预览。'
      return
    }
    if (externalChange.value) {
      error.value = '检测到另一标签页已修改设计。请重新加载保存版本后，再查看冻结预览。'
      return
    }

    let latest: EnvelopeData
    try {
      latest = readData()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '无法读取当前已保存的构造。'
      return
    }
    if (latest.stamp !== data.value.stamp) {
      externalChange.value = true
      error.value = '另一标签页已修改设计。请重新加载保存版本后，再查看冻结预览。'
      return
    }

    const savedAssembly = latest.assemblies.find((item) => item.id === draft.value?.id)
    if (!savedAssembly) {
      error.value = '当前构造尚未保存，无法生成冻结预览。'
      return
    }
    if (JSON.stringify(savedAssembly) !== JSON.stringify(persisted.value)) {
      externalChange.value = true
      error.value = '已保存构造与当前版本不一致。请重新加载后再生成定稿。'
      return
    }
    freezePreview.value = buildFreezePreview(savedAssembly, latest)
    clearFeedback()
  }

  function cancelFinalize() {
    if (busy.value) return
    freezePreview.value = null
    clearFeedback()
  }

  async function confirmFinalize() {
    const preview = freezePreview.value
    if (!preview || !preview.canFinalize || !data.value || busy.value) return
    const id = preview.assembly.id
    const saved = await act((next) => {
      const assembly = next.assemblies.find((item) => item.id === id)
      if (!assembly) throw new Error('构造不存在。')
      const nextPreview = buildFreezePreview(assembly, next)
      if (!nextPreview.canFinalize) {
        throw new Error(
          nextPreview.issues.map((issue) => `${issue.location}：${issue.text}`).join('\n'),
        )
      }
      const document = createDocument(assembly, next.materials)
      next.documents.push(document)
      assembly.state = 'finalized'
      assembly.updatedAt = now()
    }, '计算书已定稿，构造现为只读。')
    if (saved) {
      freezePreview.value = null
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
    freezePreview,
    dirty,
    editable,
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
    save,
    openFinalizePreview,
    cancelFinalize,
    confirmFinalize,
    reopen,
    addCustomMaterial,
    alignAlternative,
  }
}
