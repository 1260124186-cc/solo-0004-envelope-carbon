import type { Assembly } from '../assemblies/types'
import type { Calculation } from '../carbon/types'
import type { Material } from '../materials/types'
import type { Compliance, ComplianceRule } from '../compliance/types'

export interface CarbonDocument {
  id: string
  assemblyId: string
  createdAt: string
  assembly: Assembly
  materials: Material[]
  result: Calculation
  /**
   * 以下三项为规则功能上线时新增。规则功能上线前生成的历史计算书没有这些字段，
   * 读取时由解码层按冻结输入与原字段口径补建，历史数值保持不变。
   */
  ruleId?: string
  rule?: ComplianceRule | null
  compliance?: Compliance
}
