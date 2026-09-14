import type { Assembly } from '../assemblies/types'
import type { Calculation } from '../carbon/types'
import type { Compliance, ComplianceRule, RuleValues } from './types'
import { ruleMetrics } from './types'

export function ruleValues(result: Calculation): RuleValues {
  return {
    intensity: result.intensity,
    whole: result.whole,
    transmittance: result.transmittance,
    thickness: result.thickness,
  }
}

/**
 * 按规则快照判定。调用方必须传入定稿/计算时冻结的规则内容，
 * 规则后续被修改或停用都不会改变这里的判定结果。
 */
export function evaluateRule(rule: ComplianceRule, result: Calculation): Compliance {
  const values = ruleValues(result)
  const conditions = rule.conditions.map((condition) => {
    const meta = ruleMetrics[condition.metric]
    const actual = values[condition.metric]
    return {
      metric: condition.metric,
      label: meta.label,
      unit: meta.unit,
      actual,
      limit: condition.value,
      // 与历史口径一致采用“小于等于”，边界值判定为达标。
      pass: actual <= condition.value,
    }
  })
  return {
    mode: 'rule',
    ruleId: rule.id,
    ruleName: rule.name,
    ruleActive: rule.active,
    pass: conditions.every((condition) => condition.pass),
    conditions,
  }
}

/** 兼容口径：没有选择规则时继续按构造自带的碳强度目标与传热系数上限判定。 */
export function evaluateLegacy(assembly: Assembly, result: Calculation): Compliance {
  return {
    mode: 'legacy',
    ruleId: null,
    ruleName: '',
    ruleActive: false,
    pass: result.carbonPass && result.thermalPass,
    conditions: [
      {
        metric: 'intensity',
        label: ruleMetrics.intensity.label,
        unit: ruleMetrics.intensity.unit,
        actual: result.intensity,
        limit: assembly.carbonLimit,
        pass: result.carbonPass,
      },
      {
        metric: 'transmittance',
        label: ruleMetrics.transmittance.label,
        unit: ruleMetrics.transmittance.unit,
        actual: result.transmittance,
        limit: assembly.thermalLimit,
        pass: result.thermalPass,
      },
    ],
  }
}

/**
 * 实时判定（编辑中、未冻结场景）。规则存在即按其条件计算，
 * ruleActive 反映规则当前是否启用（停用规则的结果仅供参考，界面会提示重选）；
 * 规则缺失时回退原字段口径并保留标识线索。
 * 历史计算书不走此函数，只读取定稿时冻结的判定快照。
 */
export function evaluateCompliance(
  assembly: Assembly,
  result: Calculation,
  rule: ComplianceRule | null | undefined,
): Compliance {
  if (assembly.ruleId && rule) return evaluateRule(rule, result)
  if (assembly.ruleId) {
    // 正常流程只停用不删除；走到这里说明存储中规则已缺失。
    return {
      ...evaluateLegacy(assembly, result),
      ruleId: assembly.ruleId,
      ruleName: '已不存在的规则',
      ruleActive: false,
    }
  }
  return evaluateLegacy(assembly, result)
}
