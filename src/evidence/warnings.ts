import type { Assembly } from '../assemblies/types'
import type { Evidence, PropertyKey } from './types'
import { propertyLabels, statusLabels } from './types'
import type { Material } from '../materials/types'

export interface ObsoleteWarning {
  evidenceId: string
  title: string
  year: string
  url: string
  materials: { name: string; properties: PropertyKey[] }[]
  message: string
}

// 汇总某个构造当前引用的材料中，哪些物性仍挂在“不再适用”的依据上。
// 只负责提示；计算引擎与历史计算书不受影响，继续使用既有材料数值。
export function obsoleteWarnings(
  assembly: Assembly,
  evidence: Evidence[],
  materials: Material[],
): ObsoleteWarning[] {
  const used = new Map<string, Material>()
  for (const layer of assembly.layers) {
    const material = materials.find((item) => item.id === layer.materialId)
    if (material) used.set(material.id, material)
  }
  const nameOf = (id: string) => used.get(id)?.name ?? '未知材料'
  return evidence
    .filter((item) => item.status === 'obsolete')
    .map((item) => {
      const touched = item.links
        .filter((link) => used.has(link.materialId))
        .map((link) => ({ name: nameOf(link.materialId), properties: [...link.properties] }))
      if (!touched.length) return null
      const detail = touched
        .map(
          (entry) =>
            `${entry.name}（${entry.properties.map((key) => propertyLabels[key]).join('、')}）`,
        )
        .join('、')
      return {
        evidenceId: item.id,
        title: item.title,
        year: item.year,
        url: item.url,
        materials: touched,
        message: `物性依据《${item.title}》（${item.year} 年）已标为${statusLabels.obsolete}，本构造仍在引用其关联物性：${detail}。计算结果保持原值，请核实后另建带来源的新材料。`,
      }
    })
    .filter((item): item is ObsoleteWarning => item !== null)
}
