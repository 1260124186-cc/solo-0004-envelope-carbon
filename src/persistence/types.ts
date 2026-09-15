import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { CarbonDocument } from '../documents/types'

export interface EnvelopeData {
  schema: 1
  stamp: string
  assemblies: Assembly[]
  materials: Material[]
  documents: CarbonDocument[]
  /** 已归档构造的标识。归档只是从工作列表隐藏，实体与计算书仍在存储中。 */
  archives: string[]
}

export const persistenceKey = 'solo-0004-envelope-carbon:design:v1'
