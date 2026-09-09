import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { Calculation } from '../carbon/types'
import { calculate } from '../carbon/engine'

export interface Comparison {
  baseline: Calculation
  alternative: Calculation
  carbonDelta: number
  wholeDelta: number
  thermalDelta: number
  percent: number | null
  reasons: string[]
}

export function comparableReasons(baseline: Assembly, alternative: Assembly): string[] {
  const reasons: string[] = []
  if (baseline.id === alternative.id) reasons.push('请选择两个不同的构造。')
  if (baseline.surface !== alternative.surface) reasons.push('建筑部位不同，无法直接比较。')
  if (baseline.area !== alternative.area) reasons.push('构造面积不同，请先统一计算口径。')
  if (baseline.years !== alternative.years) reasons.push('计算年限不同，请先统一计算口径。')
  return reasons
}

export function compare(
  baseline: Assembly,
  alternative: Assembly,
  materials: Material[],
): Comparison {
  const reasons = comparableReasons(baseline, alternative)
  if (reasons.length) throw new Error(reasons.join('\n'))
  const a = calculate(baseline, materials)
  const b = calculate(alternative, materials)
  return {
    baseline: a,
    alternative: b,
    carbonDelta: b.intensity - a.intensity,
    wholeDelta: b.whole - a.whole,
    thermalDelta: b.transmittance - a.transmittance,
    percent: a.intensity === 0 ? null : ((b.intensity - a.intensity) / a.intensity) * 100,
    reasons: [
      `采用相同的 ${baseline.area} 平方米构造面积。`,
      `采用相同的 ${baseline.years} 年计算期。`,
      '差值均为替代构造减去基准构造，负值代表减少。',
      '目标值仅辅助方案选择，不替代项目合规判定。',
    ],
  }
}
