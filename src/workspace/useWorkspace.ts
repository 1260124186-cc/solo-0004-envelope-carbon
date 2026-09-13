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
import type { ConstructionTemplate } from '../templates/types'
import { templateCapacity } from '../templates/types'
import { createTemplate, instantiateTemplate } from '../templates/factory'
import {
  missingTemplateMaterials,
  unavailableTemplateMessage,
  validateTemplate,
} from '../templates/validation'
import { clone, newId, now } from '../shared/identity'

export type WorkspaceTab = 'design' | 'compare' | 'documents' | 'materials' | 'templates'

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
  const templateDraft = ref<ConstructionTemplate | null>(null)
  const previewId = shallowRef('')
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
      templateDraft.value = null
      previewId.value = ''
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

  // —— 构造模板 ——

  const templateFindings = computed(() =>
    templateDraft.value ? validateTemplate(templateDraft.value) : [],
  )

  /** 从当前构造截取层组合，进入模板表单；不继承面积、名称、定稿状态或计算书。 */
  function captureTemplate() {
    if (busy.value || !draft.value || !data.value) return
    // 模板来源仅限已持久化的构造：未保存草稿保存后刷新即丢失，不能落成模板。
    if (dirty.value || !persisted.value) {
      error.value = '当前构造尚未保存，请先保存构造，再把它的材料层组合存为模板。'
      return
    }
    if (!draft.value.layers.length) {
      error.value = '当前构造还没有材料层，无法保存为模板。'
      return
    }
    templateDraft.value = createTemplate(
      draft.value,
      draft.value.name.trim() ? draft.value.name.slice(0, 50) : '未命名模板',
      draft.value.surface,
      draft.value.note.trim().slice(0, 500),
    )
    clearFeedback()
    tab.value = 'templates'
  }

  function blankTemplate() {
    if (busy.value) return
    const stamp = now()
    templateDraft.value = {
      id: '',
      name: '',
      surface: 'wall',
      usage: '',
      layers: [],
      createdAt: stamp,
      updatedAt: stamp,
    }
    clearFeedback()
  }

  function editTemplate(id: string) {
    if (busy.value) return
    const target = data.value?.templates.find((item) => item.id === id)
    if (!target) return
    templateDraft.value = clone(target)
    clearFeedback()
  }

  function cancelTemplateForm() {
    templateDraft.value = null
    clearFeedback()
  }

  function updateTemplateDraft(patch: Partial<ConstructionTemplate>) {
    if (!templateDraft.value || busy.value) return
    templateDraft.value = { ...templateDraft.value, ...patch }
    clearFeedback()
  }

  function updateTemplateLayer(index: number, patch: Partial<Layer>) {
    if (!templateDraft.value) return
    const layers = templateDraft.value.layers.map((layer, current) =>
      current === index ? { ...layer, ...patch } : layer,
    )
    templateDraft.value = { ...templateDraft.value, layers }
  }

  function removeTemplateLayer(index: number) {
    if (!templateDraft.value) return
    templateDraft.value = {
      ...templateDraft.value,
      layers: templateDraft.value.layers.filter((_, current) => current !== index),
    }
  }

  function moveTemplateLayer(index: number, direction: -1 | 1) {
    if (!templateDraft.value) return
    const destination = index + direction
    const layers = [...templateDraft.value.layers]
    if (destination < 0 || destination >= layers.length) return
    const current = layers[index]
    layers[index] = layers[destination]
    layers[destination] = current
    templateDraft.value = { ...templateDraft.value, layers }
  }

  function addTemplateLayer(material: Material) {
    if (!templateDraft.value || busy.value) return
    if (templateDraft.value.layers.length >= 20) {
      error.value = '单个模板最多包含 20 层。'
      return
    }
    templateDraft.value = {
      ...templateDraft.value,
      layers: [
        ...templateDraft.value.layers,
        {
          materialId: material.id,
          thickness: material.kind === 'structure' ? 200 : 20,
          loss: 3,
          lifespan: material.lifespan,
        },
      ],
    }
  }

  async function saveTemplate() {
    if (!templateDraft.value || !data.value || busy.value) return
    const candidate = clone(templateDraft.value)
    candidate.name = candidate.name.trim()
    candidate.usage = candidate.usage.trim()
    if (validateTemplate(candidate).length) {
      error.value = validateTemplate(candidate)[0].text
      return
    }
    // 新截取的模板在保存前也带有客户端标识，是否“已保存”以内存集合为准。
    const isExisting = data.value.templates.some((item) => item.id === candidate.id)
    const saved = await act(
      (next) => {
        const index = next.templates.findIndex((item) => item.id === candidate.id)
        if (index >= 0) {
          // 模板修改只覆盖模板自身；由旧模板生成的构造是独立副本，不受影响。
          candidate.createdAt = next.templates[index].createdAt
          candidate.updatedAt = now()
          next.templates[index] = candidate
        } else {
          if (next.templates.length >= templateCapacity) {
            throw new Error(`最多保存 ${templateCapacity} 个构造模板。`)
          }
          candidate.id = newId('tpl')
          candidate.updatedAt = now()
          next.templates.push(candidate)
        }
      },
      isExisting ? '构造模板已更新，已由它生成的构造保持不变。' : '构造模板已保存。',
    )
    if (saved) templateDraft.value = null
  }

  async function deleteTemplate(id: string) {
    if (busy.value) return
    const target = data.value?.templates.find((item) => item.id === id)
    if (!target) return
    if (
      !window.confirm(
        `删除模板「${target.name}」后无法恢复。已由该模板生成的构造是独立副本，不会被删除。是否继续？`,
      )
    ) {
      return
    }
    const saved = await act((next) => {
      next.templates = next.templates.filter((item) => item.id !== id)
    }, '构造模板已删除，已生成的构造保持不变。')
    if (saved && templateDraft.value?.id === id) templateDraft.value = null
    if (previewId.value === id) previewId.value = ''
  }

  function openPreview(id: string) {
    if (busy.value) return
    if (!data.value?.templates.some((item) => item.id === id)) return
    clearFeedback()
    previewId.value = id
  }

  function closePreview() {
    previewId.value = ''
    clearFeedback()
  }

  const previewTemplate = computed(
    () => data.value?.templates.find((item) => item.id === previewId.value) ?? null,
  )

  const previewMissing = computed(() =>
    previewTemplate.value && data.value
      ? missingTemplateMaterials(previewTemplate.value.layers, data.value.materials)
      : [],
  )

  /** 先预览再套用；材料引用不可用时阻止，并指出具体哪一层需要处理。 */
  function applyPreview() {
    if (busy.value || !previewTemplate.value || !data.value) return
    const template = previewTemplate.value
    const missing = missingTemplateMaterials(template.layers, data.value.materials)
    if (missing.length) {
      error.value = unavailableTemplateMessage(template.layers, data.value.materials)
      return
    }
    if (!mayDiscard()) return
    draft.value = instantiateTemplate(template)
    previewId.value = ''
    tab.value = 'design'
    clearFeedback()
    notice.value = `已由模板「${template.name}」生成独立的编辑中构造，可继续调整层、面积与年限。`
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
    templateDraft,
    templateFindings,
    previewId,
    previewTemplate,
    previewMissing,
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
    captureTemplate,
    blankTemplate,
    editTemplate,
    cancelTemplateForm,
    updateTemplateDraft,
    updateTemplateLayer,
    removeTemplateLayer,
    moveTemplateLayer,
    addTemplateLayer,
    saveTemplate,
    deleteTemplate,
    openPreview,
    closePreview,
    applyPreview,
  }
}
