import type { Assembly } from '../assemblies/types'
import type { Calculation } from '../carbon/types'
import type { Material } from '../materials/types'
import type { ThermalBasis } from '../thermal/types'

export interface CarbonDocument {
  id: string
  assemblyId: string
  createdAt: string
  assembly: Assembly
  materials: Material[]
  thermalBasis: ThermalBasis | null
  result: Calculation
}
