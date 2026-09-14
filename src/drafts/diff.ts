import type { Assembly, Layer, Surface } from '../assemblies/types'
import type { Material } from '../materials/types'
import { surfaceLabels } from '../assemblies/types'

/**
 * 草稿与最近保存版本的逐项比对。
 * 比对刻意忽略 revision 与 updatedAt：这两个字段只在正式保存时变化，
 * 不属于用户需要核对的编辑差异。
 */

export interface FieldChange {
  label: string
  saved: string
  draft: string
}

export type LayerStatus = 'added' | 'removed' | 'modified'

export interface LayerChange {
  key: string
  title: string
  status: LayerStatus
  /** 修改层的逐属性差异；新增/删除层为空。 */
  fields: FieldChange[]
}

export interface DraftDiff {
  fieldChanges: FieldChange[]
  layerChanges: LayerChange[]
  changeCount: number
}

function text(value: string): string {
  const trimmed = value.trim()
  return trimmed === '' ? '（空）' : trimmed
}

function surfaceText(value: Surface): string {
  return surfaceLabels[value] ?? String(value)
}

function statusText(value: Assembly['state']): string {
  return value === 'finalized' ? '已定稿' : '编辑中'
}

/** 参与内容比对的字段（排除 revision、updatedAt）。 */
const editableKeys: (keyof Assembly)[] = [
  'name',
  'surface',
  'area',
  'years',
  'carbonLimit',
  'thermalLimit',
  'note',
]

const fieldLabels: Record<string, string> = {
  name: '构造名称',
  surface: '建筑部位',
  area: '构造面积（平方米）',
  years: '计算年限（年）',
  carbonLimit: '碳强度目标（千克当量/平方米）',
  thermalLimit: '传热系数上限（瓦/平方米·开尔文）',
  note: '设计说明',
}

function fieldValue(assembly: Assembly, key: keyof Assembly): string {
  const value = assembly[key]
  if (key === 'name' || key === 'note') return text(String(value))
  if (key === 'surface') return surfaceText(value as Surface)
  return String(value)
}

function materialName(materials: Material[], materialId: string): string {
  return materials.find((material) => material.id === materialId)?.name ?? '已删除的材料'
}

const layerLabels: { key: keyof Layer; label: string; render: (layer: Layer) => string }[] = [
  { key: 'materialId', label: '材料', render: (layer) => layer.materialId },
  { key: 'thickness', label: '厚度（毫米）', render: (layer) => String(layer.thickness) },
  { key: 'loss', label: '施工损耗（%）', render: (layer) => String(layer.loss) },
  { key: 'lifespan', label: '替换寿命（年）', render: (layer) => String(layer.lifespan) },
]

/**
 * 计算草稿相对于保存版本的差异。
 * @param saved 最近保存的构造；新构造（origin 已删除或从未保存）传 null，
 *              此时保存侧统一显示“（无）”。
 */
export function diffDraft(
  draft: Assembly,
  saved: Assembly | null,
  materials: Material[],
): DraftDiff {
  const fieldChanges: FieldChange[] = []
  for (const key of editableKeys) {
    const draftValue = fieldValue(draft, key)
    const savedValue = saved ? fieldValue(saved, key) : '（无）'
    if (draftValue !== savedValue) {
      fieldChanges.push({ label: fieldLabels[key as string], saved: savedValue, draft: draftValue })
    }
  }
  if (!saved || draft.state !== saved.state) {
    fieldChanges.push({
      label: '构造状态',
      saved: saved ? statusText(saved.state) : '（无）',
      draft: statusText(draft.state),
    })
  }

  const layerChanges: LayerChange[] = []
  const savedLayers = saved?.layers ?? []
  const savedById = new Map(savedLayers.map((layer, index) => [layer.id, { layer, index }]))
  const draftById = new Map(draft.layers.map((layer, index) => [layer.id, { layer, index }]))
  const titles = new Map<string, string>()

  for (const { layer, index } of draftById.values()) {
    titles.set(layer.id, `第 ${index + 1} 层 · ${materialName(materials, layer.materialId)}`)
  }
  for (const { layer, index } of savedById.values()) {
    if (!titles.has(layer.id)) {
      titles.set(layer.id, `原第 ${index + 1} 层 · ${materialName(materials, layer.materialId)}`)
    }
  }

  // 草稿中的层：新增或被修改。
  for (const { layer, index } of draft.layers.map((layer, index) => ({ layer, index }))) {
    const before = savedById.get(layer.id)
    if (!before) {
      layerChanges.push({
        key: layer.id,
        title: `第 ${index + 1} 层 · ${materialName(materials, layer.materialId)}`,
        status: 'added',
        fields: [],
      })
      continue
    }
    const fields: FieldChange[] = []
    for (const item of layerLabels) {
      const draftValue =
        item.key === 'materialId' ? materialName(materials, layer.materialId) : item.render(layer)
      const savedValue =
        item.key === 'materialId'
          ? materialName(materials, before.layer.materialId)
          : item.render(before.layer)
      if (draftValue !== savedValue) {
        fields.push({ label: item.label, saved: savedValue, draft: draftValue })
      }
    }
    if (before.index !== index) {
      fields.push({
        label: '层位置',
        saved: `第 ${before.index + 1} 层`,
        draft: `第 ${index + 1} 层`,
      })
    }
    if (fields.length) {
      layerChanges.push({
        key: layer.id,
        title: titles.get(layer.id) ?? `第 ${index + 1} 层`,
        status: 'modified',
        fields,
      })
    }
  }

  // 保存版本中有、草稿中没有的层：被删除。
  for (const layer of savedLayers) {
    if (!draftById.has(layer.id)) {
      layerChanges.push({
        key: layer.id,
        title: titles.get(layer.id) ?? materialName(materials, layer.materialId),
        status: 'removed',
        fields: [],
      })
    }
  }

  return {
    fieldChanges,
    layerChanges,
    changeCount: fieldChanges.length + layerChanges.length,
  }
}
