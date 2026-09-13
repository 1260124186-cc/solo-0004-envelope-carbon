import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { CarbonDocument } from './types'
import { requireEditable } from '../assemblies/validation'
import { calculate } from '../carbon/engine'
import { clone, newId, now } from '../shared/identity'

export function createDocument(assembly: Assembly, materials: Material[]): CarbonDocument {
  requireEditable(assembly)
  const result = calculate(assembly, materials)
  const used = new Map<string, Set<number>>()
  for (const layer of assembly.layers) {
    const revisions = used.get(layer.materialId) ?? new Set<number>()
    revisions.add(layer.materialRevision)
    used.set(layer.materialId, revisions)
  }
  const frozen = materials
    .filter((material) => used.has(material.id))
    .map((material) => ({
      ...material,
      revisions: material.revisions.filter((revision) =>
        used.get(material.id)?.has(revision.revision),
      ),
    }))
  return {
    id: newId('carbon-document'),
    assemblyId: assembly.id,
    createdAt: now(),
    assembly: clone({ ...assembly, state: 'finalized' }),
    materials: clone(frozen),
    result: clone(result),
  }
}
