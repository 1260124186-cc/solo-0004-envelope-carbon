import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { Assembly, Finding, Layer } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { EnvelopeData } from '../persistence/types'
import { createAssembly, createLayer, duplicateAssembly, moveLayer } from '../assemblies/factory'
import { validateAssembly } from '../assemblies/validation'
import { calculate } from '../carbon/engine'
import type { Calculation } from '../carbon/types'
import type { CarbonDocument } from '../documents/types'
import { clone } from '../shared/identity'
import type { FeedbackChannel } from './feedback'

const MAX_LAYERS = 20

export interface DraftEditor {
  draft: Ref<Assembly | null>
  dirty: ComputedRef<boolean>
  editable: ComputedRef<boolean>
  findings: ComputedRef<Finding[]>
  result: ComputedRef<Calculation | null>
  selectedDocuments: ComputedRef<CarbonDocument[]>
  mayDiscard: () => boolean
  hydrate: (data: EnvelopeData, preferredId?: string) => void
  select: (data: EnvelopeData, id: string) => boolean
  create: () => boolean
  duplicate: () => { baselineId: string; alternativeId: string } | null
  update: (patch: Partial<Assembly>) => void
  addLayer: (material: Material) => void
  updateLayer: (id: string, patch: Partial<Layer>) => void
  removeLayer: (id: string) => void
  moveLayer: (id: string, direction: -1 | 1) => void
}

/**
 * 构造编辑动作：拥有当前编辑草稿及其派生视图（脏标记、可编辑性、校验结果、
 * 计算结果、关联计算书），只在内存中改动草稿，不接触持久化提交。
 */
export function useDraftEditor(
  getData: () => EnvelopeData | null,
  isBusy: () => boolean,
  feedback: FeedbackChannel,
): DraftEditor {
  const draft = ref<Assembly | null>(null)

  const persisted = computed(() =>
    getData()?.assemblies.find((item) => item.id === draft.value?.id),
  )
  const dirty = computed(
    () => Boolean(draft.value) && JSON.stringify(draft.value) !== JSON.stringify(persisted.value),
  )
  const editable = computed(() => draft.value?.state === 'editing')
  const findings = computed<Finding[]>(() =>
    draft.value ? validateAssembly(draft.value, getData()?.materials ?? []) : [],
  )
  const result = computed<Calculation | null>(() => {
    if (!draft.value || !getData() || findings.value.length) return null
    return calculate(draft.value, getData()!.materials)
  })
  const selectedDocuments = computed<CarbonDocument[]>(
    () =>
      getData()
        ?.documents.filter((document) => document.assemblyId === draft.value?.id)
        .slice()
        .reverse() ?? [],
  )

  function mayDiscard(): boolean {
    return !dirty.value || window.confirm('当前构造有未保存的修改，是否放弃这些修改？')
  }

  function hydrate(data: EnvelopeData, preferredId = draft.value?.id): void {
    draft.value = clone(
      data.assemblies.find((item) => item.id === preferredId) ?? data.assemblies[0] ?? null,
    )
  }

  function select(data: EnvelopeData, id: string): boolean {
    if (isBusy() || !mayDiscard()) return false
    const selected = data.assemblies.find((item) => item.id === id)
    if (!selected) return false
    draft.value = clone(selected)
    feedback.clear()
    return true
  }

  function create(): boolean {
    if (isBusy() || !mayDiscard()) return false
    draft.value = createAssembly()
    feedback.clear()
    return true
  }

  function duplicate(): { baselineId: string; alternativeId: string } | null {
    if (isBusy() || !draft.value) return null
    if (dirty.value) {
      feedback.fail('请先保存当前构造，再复制替代方案。')
      return null
    }
    const baselineId = draft.value.id
    draft.value = duplicateAssembly(draft.value)
    feedback.clear()
    feedback.succeed('已创建替代构造草稿，修改后保存即可比较。')
    return { baselineId, alternativeId: draft.value.id }
  }

  function update(patch: Partial<Assembly>): void {
    if (!draft.value || !editable.value || isBusy()) return
    draft.value = { ...draft.value, ...patch }
    feedback.clear()
  }

  function addLayer(material: Material): void {
    if (!draft.value || !editable.value || isBusy()) return
    if (draft.value.layers.length >= MAX_LAYERS) {
      feedback.fail('单个构造最多包含 20 层。')
      return
    }
    update({ layers: [...draft.value.layers, createLayer(material)] })
  }

  function updateLayer(id: string, patch: Partial<Layer>): void {
    if (!draft.value) return
    update({
      layers: draft.value.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
    })
  }

  function removeLayer(id: string): void {
    if (!draft.value) return
    update({ layers: draft.value.layers.filter((layer) => layer.id !== id) })
  }

  function move(id: string, direction: -1 | 1): void {
    if (!draft.value) return
    update({ layers: moveLayer(draft.value.layers, id, direction) })
  }

  return {
    draft,
    dirty,
    editable,
    findings,
    result,
    selectedDocuments,
    mayDiscard,
    hydrate,
    select,
    create,
    duplicate,
    update,
    addLayer,
    updateLayer,
    removeLayer,
    moveLayer: move,
  }
}
