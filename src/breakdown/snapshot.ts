import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { BreakdownSnapshot } from './types'
import { decompose } from './decompose'
import { clone, newId, now } from '../shared/identity'

// 快照冻结保存时的构造修订与所用材料物性，后续编辑不影响已保存的分解。
export function createBreakdownSnapshot(
  assembly: Assembly,
  materials: Material[],
): BreakdownSnapshot {
  const breakdown = decompose(assembly, materials)
  const used = new Set(assembly.layers.map((layer) => layer.materialId))
  return {
    id: newId('breakdown'),
    assemblyId: assembly.id,
    createdAt: now(),
    assembly: clone(assembly),
    materials: clone(materials.filter((material) => used.has(material.id))),
    breakdown: clone(breakdown),
  }
}
