import type { Assembly } from '../assemblies/types'
import type { Material, MaterialKind } from '../materials/types'

export interface BreakdownLayer {
  layerId: string
  order: number
  materialId: string
  materialName: string
  kind: MaterialKind
  thickness: number
  cycles: number
  initial: number
  replacement: number
  total: number
  whole: number
  share: number
}

export interface BreakdownKindSource {
  layerId: string
  order: number
  materialName: string
  total: number
}

export interface BreakdownKind {
  kind: MaterialKind
  initial: number
  replacement: number
  total: number
  whole: number
  share: number
  sources: BreakdownKindSource[]
}

export interface BreakdownCheck {
  id: string
  label: string
  pass: boolean
}

export interface Breakdown {
  assemblyId: string
  revision: number
  area: number
  years: number
  initial: number
  replacement: number
  intensity: number
  whole: number
  layers: BreakdownLayer[]
  kinds: BreakdownKind[]
  checks: BreakdownCheck[]
  method: string
}

export interface BreakdownSnapshot {
  id: string
  assemblyId: string
  createdAt: string
  assembly: Assembly
  materials: Material[]
  breakdown: Breakdown
}
