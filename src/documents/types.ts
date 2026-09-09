import type { Assembly } from '../assemblies/types'
import type { Calculation } from '../carbon/types'
import type { Material } from '../materials/types'

export interface CarbonDocument {
  id: string
  assemblyId: string
  createdAt: string
  assembly: Assembly
  materials: Material[]
  result: Calculation
}
