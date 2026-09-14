import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { CarbonDocument } from '../documents/types'
import type { BreakdownSnapshot } from '../breakdown/types'

export interface EnvelopeData {
  schema: 2
  stamp: string
  assemblies: Assembly[]
  materials: Material[]
  documents: CarbonDocument[]
  breakdowns: BreakdownSnapshot[]
}

export const persistenceKey = 'solo-0004-envelope-carbon:design:v1'
