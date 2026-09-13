import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { CarbonDocument } from '../documents/types'
import type { ConstructionTemplate } from '../templates/types'

export interface EnvelopeData {
  schema: 1
  stamp: string
  assemblies: Assembly[]
  materials: Material[]
  documents: CarbonDocument[]
  templates: ConstructionTemplate[]
}

export const persistenceKey = 'solo-0004-envelope-carbon:design:v1'
