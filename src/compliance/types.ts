import type { Calculation } from '../carbon/types'

/** 可用于达标条件的计算结果字段（内部计算均为未舍入数值）。 */
export type RuleMetric = 'intensity' | 'whole' | 'transmittance' | 'thickness'

export interface MetricMeta {
  key: RuleMetric
  label: string
  shortLabel: string
  unit: string
  min: number
  max: number
}

export const ruleMetrics: Record<RuleMetric, MetricMeta> = {
  intensity: {
    key: 'intensity',
    label: '生命周期隐含碳强度',
    shortLabel: '碳强度',
    unit: '千克二氧化碳当量/平方米',
    min: 1,
    max: 100000,
  },
  whole: {
    key: 'whole',
    label: '整个构造隐含碳',
    shortLabel: '构造总碳',
    unit: '千克二氧化碳当量',
    min: 1,
    max: 10000000000,
  },
  transmittance: {
    key: 'transmittance',
    label: '简化传热系数',
    shortLabel: '传热系数',
    unit: '瓦/(平方米·开尔文)',
    min: 0.01,
    max: 10,
  },
  thickness: {
    key: 'thickness',
    label: '构造总厚度',
    shortLabel: '总厚度',
    unit: '毫米',
    min: 0.1,
    max: 40000,
  },
}

export const metricOrder: RuleMetric[] = ['intensity', 'whole', 'transmittance', 'thickness']

/** 单条上限条件：对应计算结果 ≤ value 即满足。各条件之间为“与”关系。 */
export interface RuleCondition {
  metric: RuleMetric
  value: number
}

export interface ComplianceRule {
  id: string
  name: string
  description: string
  conditions: RuleCondition[]
  active: boolean
  /** 随产品提供的示例规则不可修改或停用；设计团队自建规则为 false。 */
  builtIn: boolean
  createdAt: string
  updatedAt: string
}

export interface ConditionOutcome {
  metric: RuleMetric
  label: string
  unit: string
  actual: number
  limit: number
  pass: boolean
}

export interface Compliance {
  /** 实际使用的判定口径；历史数据没有规则标识时为 legacy。 */
  mode: 'legacy' | 'rule'
  /** 规则判定时所用规则的标识（历史计算书随快照保留）。 */
  ruleId: string | null
  /** 判定时的规则名称；停用规则后仍据此显示历史依据。 */
  ruleName: string
  /** 规则在判定时是否处于启用状态，随历史计算书冻结。 */
  ruleActive: boolean
  pass: boolean
  conditions: ConditionOutcome[]
}

export type RuleValues = Pick<Calculation, RuleMetric>
