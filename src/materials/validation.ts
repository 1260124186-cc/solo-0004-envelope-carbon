import type { Material } from './types'
import { inRange } from '../assemblies/validation'

export type MaterialField =
  | 'name'
  | 'kind'
  | 'density'
  | 'conductivity'
  | 'factor'
  | 'lifespan'
  | 'source'
  | 'description'

export const materialFieldOrder: MaterialField[] = [
  'name',
  'kind',
  'density',
  'conductivity',
  'factor',
  'lifespan',
  'source',
  'description',
]

export function validateMaterialFields(material: Material): Record<MaterialField, string | null> {
  const issues: Record<MaterialField, string | null> = {
    name: null,
    kind: null,
    density: null,
    conductivity: null,
    factor: null,
    lifespan: null,
    source: null,
    description: null,
  }
  if (!material.name.trim() || material.name.length > 40) {
    issues.name = '材料名称需为 1 至 40 个字符。'
  }
  if (!['structure', 'insulation', 'finish'].includes(material.kind)) {
    issues.kind = '材料类别无效。'
  }
  if (!inRange(material.density, 1, 30000)) {
    issues.density = '密度需在 1 至 30,000 千克每立方米之间。'
  }
  if (!inRange(material.conductivity, 0.001, 500)) {
    issues.conductivity = '导热系数需在 0.001 至 500 之间。'
  }
  if (!inRange(material.factor, 0, 100)) {
    issues.factor = '单位质量碳因子需在 0 至 100 之间。'
  }
  if (!inRange(material.lifespan, 1, 150) || !Number.isInteger(material.lifespan)) {
    issues.lifespan = '参考寿命需为 1 至 150 的整数。'
  }
  if (!material.source.trim() || material.source.length > 200) {
    issues.source = '请填写不超过 200 个字符的参数来源。'
  }
  if (material.description.length > 500) issues.description = '材料说明最多 500 个字符。'
  return issues
}

export function validateMaterial(material: Material): string[] {
  const fields = validateMaterialFields(material)
  return materialFieldOrder
    .map((field) => fields[field])
    .filter((issue): issue is string => issue !== null)
}
