import type { ComplianceRule, RuleCondition, RuleMetric } from './types'
import { ruleMetrics } from './types'
import { clone, newId, now } from '../shared/identity'

const defaultLimits: Record<RuleMetric, number> = {
  intensity: 150,
  whole: 15000,
  transmittance: 0.6,
  thickness: 300,
}

export function createCondition(metric: RuleMetric): RuleCondition {
  return { metric, value: defaultLimits[metric] }
}

export function createRule(): ComplianceRule {
  const timestamp = now()
  return {
    id: newId('compliance-rule'),
    name: '',
    description: '',
    conditions: [createCondition('intensity')],
    active: true,
    builtIn: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export interface RuleDraft {
  name: string
  description: string
  conditions: RuleCondition[]
}

/** 从现有规则复制出可编辑草稿，用于新建相似规则。 */
export function draftFromRule(rule: ComplianceRule): RuleDraft {
  return {
    name: `${rule.name.slice(0, 36)} · 副本`,
    description: rule.description,
    conditions: clone(rule.conditions),
  }
}

export function blankDraft(): RuleDraft {
  return { name: '', description: '', conditions: [createCondition('intensity')] }
}

/** 规则条件的中文表述，用于计算书与界面展示历史判定依据。 */
export function describeCondition(metric: RuleMetric, value: number): string {
  const meta = ruleMetrics[metric]
  return `${meta.label} ≤ ${value} ${meta.unit}`
}
