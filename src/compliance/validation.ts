import type { ComplianceRule, RuleCondition, RuleMetric } from './types'
import { metricOrder, ruleMetrics } from './types'
import { inRange } from '../assemblies/validation'

export function validateRuleCondition(condition: RuleCondition): string {
  const meta = ruleMetrics[condition.metric as RuleMetric]
  if (!meta) return '条件引用的计算字段无效。'
  if (!inRange(condition.value, meta.min, meta.max)) {
    return `${meta.label}上限需在 ${meta.min} 至 ${meta.max} 之间。`
  }
  return ''
}

/** 校验规则内容；规则标识的唯一性由保存入口在存储事务内核对。 */
export function validateComplianceRule(rule: ComplianceRule): string[] {
  const errors: string[] = []
  if (!rule.name.trim() || rule.name.length > 40) {
    errors.push('规则名称需为 1 至 40 个字符。')
  }
  if (rule.description.length > 300) errors.push('规则说明最多 300 个字符。')
  if (!Array.isArray(rule.conditions) || rule.conditions.length < 1) {
    errors.push('请至少添加一个达标条件。')
  } else if (rule.conditions.length > 4) {
    errors.push('一条规则最多包含四个条件。')
  } else {
    const metrics = new Set<RuleMetric>()
    for (const condition of rule.conditions) {
      const issue = validateRuleCondition(condition)
      if (issue) {
        errors.push(issue)
        continue
      }
      if (metrics.has(condition.metric)) {
        errors.push(`${ruleMetrics[condition.metric].label}在规则中重复。`)
      }
      metrics.add(condition.metric)
    }
  }
  return errors
}

/** 供存储解码使用：保证条件字段顺序与取值可被引擎安全消费。 */
export function normalizeConditions(conditions: unknown): RuleCondition[] {
  if (!Array.isArray(conditions)) return []
  return conditions
    .filter(
      (condition): condition is RuleCondition =>
        typeof condition === 'object' &&
        condition !== null &&
        typeof (condition as RuleCondition).metric === 'string' &&
        metricOrder.includes((condition as RuleCondition).metric) &&
        typeof (condition as RuleCondition).value === 'number',
    )
    .map((condition) => ({ metric: condition.metric, value: condition.value }))
}
