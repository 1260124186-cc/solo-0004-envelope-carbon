import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { CarbonDocument } from '../documents/types'
import type { ThermalBasis } from '../thermal/types'

export interface EnvelopeData {
  schema: 1
  stamp: string
  assemblies: Assembly[]
  materials: Material[]
  bases: ThermalBasis[]
  documents: CarbonDocument[]
}

export const persistenceKey = 'solo-0004-envelope-carbon:design:v1'
