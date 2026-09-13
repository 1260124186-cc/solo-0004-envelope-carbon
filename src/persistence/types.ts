import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { CarbonDocument } from '../documents/types'

export interface EnvelopeData {
  schema: 1
  stamp: string
  assemblies: Assembly[]
  materials: Material[]
  documents: CarbonDocument[]
}

export const persistenceKey = 'solo-0004-envelope-carbon:design:v1'

export const capacityLimits = {
  assemblies: 200,
  materials: 500,
  documents: 1000,
} as const
