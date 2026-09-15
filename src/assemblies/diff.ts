import type { Assembly } from './types'
import { surfaceLabels } from './types'
import type { Material } from '../materials/types'
import { number } from '../shared/format'

export interface FieldChange {
  label: string
  before: string
  after: string
}

export interface LayerChange {
  id: string
  badges: string[]
  title: string
  details: string[]
}

export interface AssemblyDiff {
  fields: FieldChange[]
  layers: LayerChange[]
  materialsAdded: string[]
  materialsRemoved: string[]
}

export interface SummaryField {
  label: string
  value: string
}

export interface AssemblySummary {
  fields: SummaryField[]
  layers: string[]
  materials: string[]
}

function materialName(materials: Material[], id: string): string {
  return materials.find((material) => material.id === id)?.name ?? '未知材料'
}

function truncate(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return '（空）'
  return trimmed.length > 30 ? `${trimmed.slice(0, 30)}…` : trimmed
}

function layerParams(thickness: number, loss: number, lifespan: number): string {
  return `厚度 ${number(thickness)} 毫米 · 损耗 ${number(loss)}% · 替换寿命 ${number(lifespan)} 年`
}

export function diffAssembly(
  draft: Assembly,
  saved: Assembly,
  materials: Material[],
): AssemblyDiff {
  const fields: FieldChange[] = []
  const compare = (label: string, before: string, after: string) => {
    if (before !== after) fields.push({ label, before, after })
  }
  compare('构造名称', saved.name.trim(), draft.name.trim())
  compare('建筑部位', surfaceLabels[saved.surface], surfaceLabels[draft.surface])
  compare('构造面积（平方米）', number(saved.area), number(draft.area))
  compare('计算年限（年）', number(saved.years), number(draft.years))
  compare('碳强度目标（千克当量/平方米）', number(saved.carbonLimit), number(draft.carbonLimit))
  compare(
    '传热系数上限（瓦/平方米·开尔文）',
    number(saved.thermalLimit),
    number(draft.thermalLimit),
  )
  compare('设计说明', truncate(saved.note), truncate(draft.note))

  const draftPosition = new Map(draft.layers.map((layer, index) => [layer.id, index]))
  const savedPosition = new Map(saved.layers.map((layer, index) => [layer.id, index]))
  // 只在保留层的相对顺序中判断移动，避免新增、删除造成的位移误报。
  const draftOrder = draft.layers
    .filter((layer) => savedPosition.has(layer.id))
    .map((layer) => layer.id)
  const savedOrder = saved.layers
    .filter((layer) => draftPosition.has(layer.id))
    .map((layer) => layer.id)
  const moved = new Set(draftOrder.filter((id, index) => savedOrder[index] !== id))

  const layers: LayerChange[] = []
  for (const [index, layer] of draft.layers.entries()) {
    const name = materialName(materials, layer.materialId)
    const previous = saved.layers.find((item) => item.id === layer.id)
    if (!previous) {
      layers.push({
        id: layer.id,
        badges: ['新增'],
        title: `第 ${index + 1} 层 · ${name}`,
        details: [layerParams(layer.thickness, layer.loss, layer.lifespan)],
      })
      continue
    }
    const details: string[] = []
    if (previous.materialId !== layer.materialId) {
      details.push(`材料 ${materialName(materials, previous.materialId)} → ${name}`)
    }
    if (previous.thickness !== layer.thickness) {
      details.push(`厚度 ${number(previous.thickness)} → ${number(layer.thickness)} 毫米`)
    }
    if (previous.loss !== layer.loss) {
      details.push(`施工损耗 ${number(previous.loss)}% → ${number(layer.loss)}%`)
    }
    if (previous.lifespan !== layer.lifespan) {
      details.push(`替换寿命 ${number(previous.lifespan)} → ${number(layer.lifespan)} 年`)
    }
    const badges: string[] = []
    if (details.length) badges.push('修改')
    if (moved.has(layer.id)) {
      badges.push('顺序')
      details.push(`顺序 第 ${savedPosition.get(layer.id)! + 1} 层 → 第 ${index + 1} 层`)
    }
    if (!details.length) continue
    layers.push({ id: layer.id, badges, title: `第 ${index + 1} 层 · ${name}`, details })
  }
  for (const [index, layer] of saved.layers.entries()) {
    if (draftPosition.has(layer.id)) continue
    layers.push({
      id: layer.id,
      badges: ['删除'],
      title: `第 ${index + 1} 层 · ${materialName(materials, layer.materialId)}`,
      details: [layerParams(layer.thickness, layer.loss, layer.lifespan)],
    })
  }

  const referenced = (assembly: Assembly) =>
    new Set(assembly.layers.map((layer) => layer.materialId))
  const before = referenced(saved)
  const after = referenced(draft)
  const materialsAdded = [...after]
    .filter((id) => !before.has(id))
    .map((id) => materialName(materials, id))
  const materialsRemoved = [...before]
    .filter((id) => !after.has(id))
    .map((id) => materialName(materials, id))

  return { fields, layers, materialsAdded, materialsRemoved }
}

export function summarizeAssembly(draft: Assembly, materials: Material[]): AssemblySummary {
  const fields: SummaryField[] = [
    { label: '构造名称', value: draft.name.trim() || '（未命名）' },
    { label: '建筑部位', value: surfaceLabels[draft.surface] },
    { label: '构造面积', value: `${number(draft.area)} 平方米` },
    { label: '计算年限', value: `${number(draft.years)} 年` },
    { label: '碳强度目标', value: `${number(draft.carbonLimit)} 千克当量/平方米` },
    { label: '传热系数上限', value: `${number(draft.thermalLimit)} 瓦/平方米·开尔文` },
  ]
  if (draft.note.trim()) fields.push({ label: '设计说明', value: truncate(draft.note) })
  return {
    fields,
    layers: draft.layers.map(
      (layer, index) =>
        `第 ${index + 1} 层 · ${materialName(materials, layer.materialId)} · ${layerParams(layer.thickness, layer.loss, layer.lifespan)}`,
    ),
    materials: [...new Set(draft.layers.map((layer) => materialName(materials, layer.materialId)))],
  }
}
