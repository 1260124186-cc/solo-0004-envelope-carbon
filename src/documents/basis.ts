import type { CarbonDocument } from './types'
import type { Compliance, ComplianceRule } from '../compliance/types'
import { evaluateLegacy } from '../compliance/engine'

/**
 * 读取计算书冻结的判定依据。规则功能上线前生成的历史计算书没有快照，
 * 按其冻结输入与原字段口径现算一份用于展示；数值不会被修改。
 */
export function documentCompliance(document: CarbonDocument): Compliance {
  if (document.compliance) return document.compliance
  return evaluateLegacy(document.assembly, document.result)
}

export type DocumentRuleState = 'legacy' | 'active' | 'deactivated' | 'missing'

/**
 * 历史计算书引用规则的“当前”状态（区别于冻结快照里定稿时的状态）：
 * 规则事后被停用或删除，历史判定依据保持不变，但页面需要如实提示现状。
 */
export function documentRuleState(
  document: CarbonDocument,
  rules: ComplianceRule[],
): DocumentRuleState {
  const compliance = documentCompliance(document)
  if (compliance.mode !== 'rule' || !compliance.ruleId) return 'legacy'
  const current = rules.find((rule) => rule.id === compliance.ruleId)
  if (!current) return 'missing'
  return current.active ? 'active' : 'deactivated'
}
