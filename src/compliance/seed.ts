import type { ComplianceRule } from './types'

/**
 * 内置示例规则，与初始构造配套。
 * 内置物性均为教学示例，规则阈值同样只用于方案比较。
 */
export function seedRules(): ComplianceRule[] {
  const timestamp = '2026-01-01T00:00:00.000Z'
  return [
    {
      id: 'rule-courtyard-baseline',
      name: '教学样例 · 外墙低碳口径',
      description:
        '示例外墙的组合判定口径：同时约束生命周期碳强度与简化传热系数。阈值为教学示例，不代表项目合规要求。',
      conditions: [
        { metric: 'intensity', value: 150 },
        { metric: 'transmittance', value: 0.6 },
      ],
      active: true,
      builtIn: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]
}
