import type { Evidence, EvidenceLink, PropertyKey } from './types'
import { statusOrder } from './types'
import type { Material } from '../materials/types'

export const propertyKeys: PropertyKey[] = ['density', 'conductivity', 'factor']

// 依据只登记文字与网址，不下载外部资料、不上传附件，也不做在线验证；
// 因此仅做基本格式检查，由设计者自行核对资料可达性。
export function validateEvidenceInput(input: Evidence, materials: Material[]): string[] {
  const errors: string[] = []
  if (!input.title.trim() || input.title.trim().length > 80) {
    errors.push('资料名称需为 1 至 80 个字符。')
  }
  const year = Number(input.year)
  if (!/^\d{4}$/.test(input.year.trim()) || !Number.isInteger(year) || year < 1900 || year > 2100) {
    errors.push('请填写 1900 至 2100 之间的四位年份。')
  }
  if (input.url.length > 300) {
    errors.push('来源网址最多 300 个字符。')
  } else if (input.url.trim()) {
    let parsed: URL | null = null
    try {
      parsed = new URL(input.url.trim())
    } catch {
      parsed = null
    }
    if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
      errors.push('来源网址需以 http:// 或 https:// 开头。')
    }
  }
  if (!input.scope.trim() || input.scope.length > 200) {
    errors.push('请填写不超过 200 个字符的适用材料范围。')
  }
  if (input.note.length > 500) errors.push('补充说明最多 500 个字符。')
  if (!statusOrder.includes(input.status)) errors.push('依据状态无效。')
  if (!input.links.length) {
    errors.push('请至少关联一项现有材料物性。')
  }
  if (input.links.length > materials.length) errors.push('关联材料数量异常。')
  const seen = new Set<string>()
  for (const link of input.links) {
    if (!materials.some((material) => material.id === link.materialId)) {
      errors.push('存在已被删除材料的关联，请重新选择材料。')
      break
    }
    if (seen.has(link.materialId)) {
      errors.push('同一材料只能出现一条关联。')
      break
    }
    seen.add(link.materialId)
  }
  if (input.links.some((link) => link.properties.length === 0)) {
    errors.push('每条材料关联至少选择一项物性。')
  }
  if (
    input.links.some(
      (link) =>
        link.properties.length > propertyKeys.length ||
        link.properties.some((key) => !propertyKeys.includes(key)),
    )
  ) {
    errors.push('关联物性无效。')
  }
  return errors
}

export function emptyLink(material: Material): EvidenceLink {
  return { materialId: material.id, properties: [...propertyKeys] }
}

export function normalizeEvidence(
  input: Evidence,
  materials: Material[],
  stamp: { createdAt: string; updatedAt: string },
): Evidence {
  const known = new Set(materials.map((material) => material.id))
  const links = input.links
    .filter((link) => known.has(link.materialId))
    .map((link) => ({
      materialId: link.materialId,
      properties: propertyKeys.filter((key) => link.properties.includes(key)),
    }))
    .filter((link) => link.properties.length > 0)
  return {
    ...input,
    id: input.id,
    title: input.title.trim(),
    year: input.year.trim(),
    url: input.url.trim(),
    scope: input.scope.trim(),
    note: input.note.trim(),
    links,
    createdAt: stamp.createdAt,
    updatedAt: stamp.updatedAt,
  }
}
