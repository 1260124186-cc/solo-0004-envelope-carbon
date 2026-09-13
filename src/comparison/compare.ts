import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { ThermalBasis } from '../thermal/types'
import type { Calculation } from '../carbon/types'
import { calculate } from '../carbon/engine'

export interface Comparison {
  baseline: Calculation
  alternative: Calculation
  carbonDelta: number
  wholeDelta: number
  thermalDelta: number
  percent: number | null
  thermalComparable: boolean
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
  bases: ThermalBasis[] = [],
): Comparison {
  const reasons = comparableReasons(baseline, alternative)
  if (reasons.length) throw new Error(reasons.join('\n'))
  const a = calculate(baseline, materials, bases)
  const b = calculate(alternative, materials, bases)
  const thermalComparable =
    a.surface.inner === b.surface.inner && a.surface.outer === b.surface.outer
  const basisLabel = (calculation: Calculation) => calculation.surface.basisName ?? '默认口径'
  return {
    baseline: a,
    alternative: b,
    carbonDelta: b.intensity - a.intensity,
    wholeDelta: b.whole - a.whole,
    thermalDelta: b.transmittance - a.transmittance,
    percent: a.intensity === 0 ? null : ((b.intensity - a.intensity) / a.intensity) * 100,
    thermalComparable,
    reasons: [
      `采用相同的 ${baseline.area} 平方米构造面积。`,
      `采用相同的 ${baseline.years} 年计算期。`,
      thermalComparable
        ? `热工计算口径一致（${basisLabel(a)}），传热系数可直接比较。`
        : `基准采用「${basisLabel(a)}」、替代采用「${basisLabel(b)}」，表面热阻设置不同，传热系数不能直接横向比较。`,
      '差值均为替代构造减去基准构造，负值代表减少。',
      '目标值仅辅助方案选择，不替代项目合规判定。',
    ],
  }
}
