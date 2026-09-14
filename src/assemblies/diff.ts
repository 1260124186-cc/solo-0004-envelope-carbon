import type { Assembly, Layer } from './types'
import { surfaceLabels } from './types'
import type { Material } from '../materials/types'
import { number } from '../shared/format'

export interface AssemblyDifference {
  label: string
  draft: string
  saved: string
}

function materialName(materials: Material[], id: string): string {
  return materials.find((material) => material.id === id)?.name ?? '（材料已不存在）'
}

function describeLayer(materials: Material[], layer: Layer): string {
  return `${materialName(materials, layer.materialId)} · 厚度 ${number(layer.thickness)} 毫米`
}

export function diffAssemblies(
  draft: Assembly,
  saved: Assembly,
  materials: Material[],
): AssemblyDifference[] {
  const differences: AssemblyDifference[] = []
  const add = <T>(label: string, draftValue: T, savedValue: T, format: (value: T) => string) => {
    if (draftValue !== savedValue) {
      differences.push({ label, draft: format(draftValue), saved: format(savedValue) })
    }
  }
  const text = (value: string) => value
  add('构造名称', draft.name, saved.name, text)
  add('建筑部位', draft.surface, saved.surface, (value) => surfaceLabels[value])
  add('构造面积（平方米）', draft.area, saved.area, number)
  add('计算年限（年）', draft.years, saved.years, number)
  add('碳强度目标', draft.carbonLimit, saved.carbonLimit, number)
  add('传热系数上限', draft.thermalLimit, saved.thermalLimit, number)
  add('设计说明', draft.note, saved.note, (value) => value || '（空）')
  const count = Math.max(draft.layers.length, saved.layers.length)
  for (let index = 0; index < count; index += 1) {
    const draftLayer = draft.layers[index]
    const savedLayer = saved.layers[index]
    const prefix = `第 ${index + 1} 层`
    if (draftLayer && savedLayer) {
      add(`${prefix}材料`, draftLayer.materialId, savedLayer.materialId, (id) =>
        materialName(materials, id),
      )
      add(`${prefix}厚度（毫米）`, draftLayer.thickness, savedLayer.thickness, number)
      add(`${prefix}损耗率（%）`, draftLayer.loss, savedLayer.loss, number)
      add(`${prefix}替换寿命（年）`, draftLayer.lifespan, savedLayer.lifespan, number)
    } else if (draftLayer) {
      differences.push({
        label: prefix,
        draft: describeLayer(materials, draftLayer),
        saved: '（无此层）',
      })
    } else if (savedLayer) {
      differences.push({
        label: prefix,
        draft: '（无此层）',
        saved: describeLayer(materials, savedLayer),
      })
    }
  }
  return differences
}
