import type { Material } from './types'
import { inRange } from '../assemblies/validation'

export function validateMaterial(material: Material): string[] {
  const errors: string[] = []
  if (!material.name.trim() || material.name.length > 40) {
    errors.push('材料名称需为 1 至 40 个字符。')
  }
  if (!['structure', 'insulation', 'finish'].includes(material.kind)) {
    errors.push('材料类别无效。')
  }
  if (!inRange(material.density, 1, 30000)) {
    errors.push('密度需在 1 至 30,000 千克每立方米之间。')
  }
  if (!inRange(material.conductivity, 0.001, 500)) {
    errors.push('导热系数需在 0.001 至 500 之间。')
  }
  if (!inRange(material.factor, 0, 100)) {
    errors.push('单位质量碳因子需在 0 至 100 之间。')
  }
  if (!inRange(material.lifespan, 1, 150) || !Number.isInteger(material.lifespan)) {
    errors.push('参考寿命需为 1 至 150 的整数。')
  }
  if (!material.source.trim() || material.source.length > 200) {
    errors.push('请填写不超过 200 个字符的参数来源。')
  }
  if (material.description.length > 500) errors.push('材料说明最多 500 个字符。')
  return errors
}
