import type { Assembly } from '../assemblies/types'
import type { Calculation } from '../carbon/types'
import type { Material } from '../materials/types'

export interface PlanEntry {
  layerId: string
  layerIndex: number
  layerLabel: string
  materialId: string
  materialName: string
  thickness: number
  lifespan: number
  carbon: number
  wholeCarbon: number
  source: string
}

export interface PlanYear {
  year: number
  phase: 'initial' | 'replacement'
  entries: PlanEntry[]
  total: number
  wholeTotal: number
}

export interface ReplacementPlan {
  id: string
  assemblyId: string
  createdAt: string
  assembly: Assembly
  materials: Material[]
  result: Calculation
  years: PlanYear[]
}
