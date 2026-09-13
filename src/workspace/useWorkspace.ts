import { onMounted, shallowRef } from 'vue'
import type { Assembly, Layer } from '../assemblies/types'
import type { Material } from '../materials/types'
import { useFeedback } from './feedback'
import { usePersistence } from './persistence'
import { useDraftEditor } from './draftEditor'
import { useDocumentLifecycle } from './documentLifecycle'
import { useMaterialCatalog } from './materialCatalog'
import { useComparisonAlignment } from './comparisonAlignment'
import { useBrowserEvents } from './browserEvents'

export type WorkspaceTab = 'design' | 'compare' | 'documents' | 'materials'

/**
 * 工作区组合根：只保留页面级状态（当前标签页、比较选择）和各模块的接线，
 * 不再承载具体编辑、提交、定稿逻辑。
 * 依赖方向：组合根 → 命令模块（定稿/材料/比较）→ 草稿编辑器、持久化协调 →
 * feedback 通道与既有领域/持久化模块；模块之间不直接互相持有。
 */
export function useWorkspace() {
  const feedback = useFeedback()
  const persistence = usePersistence(feedback)
  const getData = () => persistence.data.value
  const isBusy = () => feedback.busy.value
  const editor = useDraftEditor(getData, isBusy, feedback)
  const lifecycle = useDocumentLifecycle(editor, persistence.commit, getData, feedback)
  const catalog = useMaterialCatalog(persistence.commit, feedback)
  const comparison = useComparisonAlignment(
    editor,
    persistence.commit,
    getData,
    () => baselineId.value,
    () => alternativeId.value,
    feedback,
  )

  const tab = shallowRef<WorkspaceTab>('design')
  const baselineId = shallowRef('')
  const alternativeId = shallowRef('')

  function load(initial = false) {
    if (!initial && !editor.mayDiscard()) return
    if (persistence.read()) {
      const data = getData()!
      editor.hydrate(data)
      baselineId.value = data.assemblies[0]?.id ?? ''
      alternativeId.value = data.assemblies[1]?.id ?? ''
      if (!initial) feedback.succeed('已重新加载保存版本。')
    }
  }

  function select(id: string) {
    if (getData() && editor.select(getData()!, id)) tab.value = 'design'
  }

  function create() {
    if (editor.create()) tab.value = 'design'
  }

  function duplicate() {
    const ids = editor.duplicate()
    if (!ids) return
    baselineId.value = ids.baselineId
    alternativeId.value = ids.alternativeId
    tab.value = 'design'
  }

  function update(patch: Partial<Assembly>) {
    editor.update(patch)
  }

  function addMaterial(material: Material) {
    editor.addLayer(material)
  }

  function updateLayer(id: string, patch: Partial<Layer>) {
    editor.updateLayer(id, patch)
  }

  function removeLayer(id: string) {
    editor.removeLayer(id)
  }

  function move(id: string, direction: -1 | 1) {
    editor.moveLayer(id, direction)
  }

  async function save() {
    await lifecycle.save()
  }

  async function finalize() {
    if (await lifecycle.finalize()) tab.value = 'documents'
  }

  async function reopen() {
    if (await lifecycle.reopen()) tab.value = 'design'
  }

  async function addCustomMaterial(input: Material): Promise<boolean> {
    return catalog.addCustomMaterial(input)
  }

  async function alignAlternative() {
    await comparison.alignAlternative()
  }

  const { data } = persistence
  const { draft, dirty, editable, findings, result, selectedDocuments } = editor
  const { notice, error, fatal, busy, externalChange } = feedback

  useBrowserEvents({
    onStorage: persistence.onStorage,
    shouldWarnBeforeUnload: () => dirty.value,
  })

  onMounted(() => load(true))

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
