import type { Material, RevisionInput } from './types'
import { inRange } from '../assemblies/validation'

export const maxRevisionsPerMaterial = 100

export function validateRevisionInput(input: RevisionInput): string[] {
  const errors: string[] = []
  if (!inRange(input.density, 1, 30000)) {
    errors.push('密度需在 1 至 30,000 千克每立方米之间。')
  }
  if (!inRange(input.conductivity, 0.001, 500)) {
    errors.push('导热系数需在 0.001 至 500 之间。')
  }
  if (!inRange(input.factor, 0, 100)) {
    errors.push('单位质量碳因子需在 0 至 100 之间。')
  }
  if (!inRange(input.lifespan, 1, 150) || !Number.isInteger(input.lifespan)) {
    errors.push('参考寿命需为 1 至 150 的整数。')
  }
  if (!input.source.trim() || input.source.length > 200) {
    errors.push('请填写不超过 200 个字符的参数来源。')
  }
  if (input.note.length > 200) errors.push('修订说明最多 200 个字符。')
  return errors
}

export function validateMaterial(material: Material): string[] {
  const errors: string[] = []
  if (!material.name.trim() || material.name.length > 40) {
    errors.push('材料名称需为 1 至 40 个字符。')
  }
  if (!['structure', 'insulation', 'finish'].includes(material.kind)) {
    errors.push('材料类别无效。')
  }
  if (material.description.length > 500) errors.push('材料说明最多 500 个字符。')
  if (!Array.isArray(material.revisions) || material.revisions.length === 0) {
    errors.push('材料至少需要一个参数版本。')
    return errors
  }
  if (material.revisions.length > maxRevisionsPerMaterial) {
    errors.push(`单个材料最多 ${maxRevisionsPerMaterial} 个版本。`)
  }
  const numbers = new Set<number>()
  for (const revision of material.revisions) {
    if (
      !Number.isInteger(revision.revision) ||
      revision.revision < 1 ||
      numbers.has(revision.revision)
    ) {
      errors.push('材料版本号需为不重复的正整数。')
      break
    }
    numbers.add(revision.revision)
  }
  for (const revision of material.revisions) {
    errors.push(...validateRevisionInput(revision))
    if (!Number.isFinite(Date.parse(revision.createdAt))) {
      errors.push('材料版本时间无效。')
    }
  }
  return errors
}
