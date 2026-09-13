import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'

export type MaterialProperty = 'density' | 'conductivity' | 'factor'

export type SweepParameter =
  | { kind: 'thickness'; layerId: string }
  | { kind: MaterialProperty; materialId: string }

export interface SweepPoint {
  value: number
  intensity: number
  transmittance: number
  carbonPass: boolean
  thermalPass: boolean
}

export interface Crossing {
  metric: 'carbon' | 'thermal'
  at: number
  fromValue: number
  toValue: number
  direction: 'into' | 'out'
}

export interface SensitivityRun {
  id: string
  createdAt: string
  assemblyId: string
  parameter: SweepParameter
  label: string
  unit: string
  lower: number
  upper: number
  step: number
  assembly: Assembly
  materials: Material[]
  points: SweepPoint[]
  crossings: Crossing[]
}

export interface ParameterOption {
  key: string
  parameter: SweepParameter
  label: string
  unit: string
  min: number
  max: number
  current: number
  layers: number
}

export const propertyLabels: Record<MaterialProperty, string> = {
  density: '密度',
  conductivity: '导热系数',
  factor: '单位质量碳因子',
}

export const propertyUnits: Record<MaterialProperty, string> = {
  density: '千克/立方米',
  conductivity: '瓦/(米·开尔文)',
  factor: '千克当量/千克',
}
