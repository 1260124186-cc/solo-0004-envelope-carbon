import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { ThermalBasis } from '../thermal/types'
import type { CarbonDocument } from './types'
import { requireEditable } from '../assemblies/validation'
import { calculate } from '../carbon/engine'
import { clone, newId, now } from '../shared/identity'

export function createDocument(
  assembly: Assembly,
  materials: Material[],
  bases: ThermalBasis[] = [],
): CarbonDocument {
  requireEditable(assembly)
  const result = calculate(assembly, materials, bases)
  const basis = bases.find((item) => item.id === assembly.thermalBasisId) ?? null
  const used = new Set(assembly.layers.map((layer) => layer.materialId))
  return {
    id: newId('carbon-document'),
    assemblyId: assembly.id,
    createdAt: now(),
    assembly: clone({ ...assembly, state: 'finalized' }),
    materials: clone(materials.filter((material) => used.has(material.id))),
    thermalBasis: basis ? clone(basis) : null,
    result: clone(result),
  }
}
