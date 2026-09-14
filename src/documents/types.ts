import type { Assembly } from '../assemblies/types'
import type { Calculation } from '../carbon/types'
import type { Material } from '../materials/types'
import type { ThicknessUnit } from '../shared/thickness'

export interface CarbonDocument {
  id: string
  assemblyId: string
  createdAt: string
  assembly: Assembly
  materials: Material[]
  result: Calculation
  // 定稿时的厚度展示单位；早期存档缺省为毫米，由存储解码补齐。
  thicknessUnit: ThicknessUnit
}
