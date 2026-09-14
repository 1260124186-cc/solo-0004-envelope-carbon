import type { Assembly } from '../assemblies/types'
import { surfaceLabels } from '../assemblies/types'
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

export interface OverviewEntry {
  assembly: Assembly
  comparison: Comparison | null
  exclusions: string[]
}

export interface ComparisonOverview {
  baseline: Calculation
  entries: OverviewEntry[]
  notes: string[]
}

export function comparableReasons(baseline: Assembly, alternative: Assembly): string[] {
  const reasons: string[] = []
  if (baseline.id === alternative.id) reasons.push('请选择两个不同的构造。')
  if (baseline.surface !== alternative.surface) reasons.push('建筑部位不同，无法直接比较。')
  if (baseline.area !== alternative.area) reasons.push('构造面积不同，请先统一计算口径。')
  if (baseline.years !== alternative.years) reasons.push('计算年限不同，请先统一计算口径。')
  return reasons
}

function toComparison(a: Calculation, b: Calculation, baseline: Assembly): Comparison {
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

export function compare(
  baseline: Assembly,
  alternative: Assembly,
  materials: Material[],
): Comparison {
  const reasons = comparableReasons(baseline, alternative)
  if (reasons.length) throw new Error(reasons.join('\n'))
  return toComparison(calculate(baseline, materials), calculate(alternative, materials), baseline)
}

export function exclusionReasons(baseline: Assembly, alternative: Assembly): string[] {
  const reasons: string[] = []
  if (baseline.id === alternative.id) reasons.push('与基准构造相同，不能作为自己的替代。')
  if (baseline.surface !== alternative.surface) {
    reasons.push(
      `建筑部位不一致：基准为「${surfaceLabels[baseline.surface]}」，该构造为「${surfaceLabels[alternative.surface]}」。`,
    )
  }
  if (baseline.area !== alternative.area) {
    reasons.push(
      `构造面积不一致：基准为 ${baseline.area} 平方米，该构造为 ${alternative.area} 平方米。`,
    )
  }
  if (baseline.years !== alternative.years) {
    reasons.push(`计算年限不一致：基准为 ${baseline.years} 年，该构造为 ${alternative.years} 年。`)
  }
  return reasons
}

export function compareAlternatives(
  baseline: Assembly,
  alternatives: Assembly[],
  materials: Material[],
): ComparisonOverview {
  const base = calculate(baseline, materials)
  const entries = alternatives.map((assembly) => {
    const exclusions = exclusionReasons(baseline, assembly)
    if (exclusions.length) return { assembly, comparison: null, exclusions }
    return {
      assembly,
      comparison: toComparison(base, calculate(assembly, materials), baseline),
      exclusions: [],
    }
  })
  return {
    baseline: base,
    entries,
    notes: [
      `统一采用基准的 ${baseline.area} 平方米构造面积与 ${baseline.years} 年计算期。`,
      '差值与相对比例均以基准构造为参照，负值代表替代构造更低。',
      '每次增减或更换方案后，全表按最近保存的构造重新计算。',
      '目标值仅辅助方案选择，不替代项目合规判定。',
    ],
  }
}
