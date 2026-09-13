import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { FactorRange, ScenarioStudy } from './types'
import { clone, newId, now } from '../shared/identity'
import { rangeForMaterial } from './engine'

/** 从已保存构造成立研究：冻结构造与所用材料物性，碳因子范围先取目录参考值。 */
export function createStudy(assembly: Assembly, materials: Material[]): ScenarioStudy {
  const usedIds = new Set(assembly.layers.map((layer) => layer.materialId))
  const used = materials.filter((material) => usedIds.has(material.id))
  const ranges: Record<string, FactorRange> = {}
  for (const material of used) ranges[material.id] = rangeForMaterial(material)
  const timestamp = now()
  return {
    id: newId('scenario'),
    name: `${assembly.name.slice(0, 42)} · 碳因子情景`,
    sourceAssemblyId: assembly.id,
    note: '',
    ranges,
    snapshot: {
      assembly: clone(assembly),
      materials: clone(used),
      assemblyRevision: assembly.revision,
      assemblyUpdatedAt: assembly.updatedAt,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}
