import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { CarbonDocument } from '../documents/types'
import type { SensitivityRun } from '../sensitivity/types'

export interface EnvelopeData {
  schema: 1
  stamp: string
  assemblies: Assembly[]
  materials: Material[]
  documents: CarbonDocument[]
  analyses: SensitivityRun[]
}

export const persistenceKey = 'solo-0004-envelope-carbon:design:v1'
