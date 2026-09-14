import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { PhaseSnapshot, SnapshotInput } from './types'
import { validateSnapshotInput } from './validation'
import { clone, newId, now } from '../shared/identity'

export function createSnapshot(
  assemblies: Assembly[],
  materials: Material[],
  input: SnapshotInput,
): PhaseSnapshot {
  const errors = validateSnapshotInput(input, assemblies)
  if (errors.length) throw new Error(errors.join('\n'))
  const entries = input.assemblyIds.map((id) => {
    const assembly = assemblies.find((item) => item.id === id)!
    const used = new Set(assembly.layers.map((layer) => layer.materialId))
    return {
      assemblyId: assembly.id,
      assemblyRevision: assembly.revision,
      assembly: clone(assembly),
      materials: clone(materials.filter((material) => used.has(material.id))),
    }
  })
  return {
    id: newId('phase-snapshot'),
    name: input.name.trim(),
    note: input.note.trim(),
    createdAt: now(),
    entries,
  }
}
