import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { CarbonDocument } from './types'
import { requireEditable } from '../assemblies/validation'
import { calculate } from '../carbon/engine'
import { clone, newId, now } from '../shared/identity'
import { usedMaterialSnapshot } from './preview'

export function createDocument(assembly: Assembly, materials: Material[]): CarbonDocument {
  requireEditable(assembly)
  const result = calculate(assembly, materials)
  return {
    id: newId('carbon-document'),
    assemblyId: assembly.id,
    createdAt: now(),
    assembly: clone({ ...assembly, state: 'finalized' }),
    materials: clone(usedMaterialSnapshot(assembly, materials)),
    result: clone(result),
  }
}
