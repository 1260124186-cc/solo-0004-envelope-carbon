import type { CarbonDocument } from './types'
import type { Compliance } from '../compliance/types'
import { evaluateLegacy } from '../compliance/engine'

/**
 * 读取计算书冻结的判定依据。规则功能上线前生成的历史计算书没有快照，
 * 按其冻结输入与原字段口径现算一份用于展示；数值不会被修改。
 */
export function documentCompliance(document: CarbonDocument): Compliance {
  if (document.compliance) return document.compliance
  return evaluateLegacy(document.assembly, document.result)
}
