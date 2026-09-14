import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { ThicknessUnit } from '../shared/thickness'
import type { CarbonDocument } from './types'
import { requireEditable } from '../assemblies/validation'
import { calculate } from '../carbon/engine'
import { clone, newId, now } from '../shared/identity'

export function createDocument(
  assembly: Assembly,
  materials: Material[],
  thicknessUnit: ThicknessUnit = 'mm',
): CarbonDocument {
  requireEditable(assembly)
  const result = calculate(assembly, materials)
  const used = new Set(assembly.layers.map((layer) => layer.materialId))
  return {
    id: newId('carbon-document'),
    assemblyId: assembly.id,
    createdAt: now(),
    assembly: clone({ ...assembly, state: 'finalized' }),
    materials: clone(materials.filter((material) => used.has(material.id))),
    result: clone(result),
    thicknessUnit,
  }
}
