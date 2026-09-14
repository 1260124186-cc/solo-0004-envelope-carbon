import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { SnapshotEntry } from './types'

export interface EntryReference {
  assembly: 'current' | 'changed' | 'missing'
  currentRevision: number | null
  missingMaterials: string[]
}

export function entryReference(
  entry: SnapshotEntry,
  assemblies: Assembly[],
  materials: Material[],
): EntryReference {
  const live = assemblies.find((assembly) => assembly.id === entry.assemblyId)
  const catalogue = new Set(materials.map((material) => material.id))
  return {
    assembly: !live
      ? 'missing'
      : JSON.stringify(live) === JSON.stringify(entry.assembly)
        ? 'current'
        : 'changed',
    currentRevision: live?.revision ?? null,
    missingMaterials: entry.materials
      .filter((material) => !catalogue.has(material.id))
      .map((material) => material.name),
  }
}
