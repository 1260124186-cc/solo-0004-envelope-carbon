import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'

export interface SnapshotEntry {
  assemblyId: string
  assemblyRevision: number
  assembly: Assembly
  materials: Material[]
}

export interface PhaseSnapshot {
  id: string
  name: string
  note: string
  createdAt: string
  entries: SnapshotEntry[]
}

export interface SnapshotInput {
  name: string
  note: string
  assemblyIds: string[]
}
