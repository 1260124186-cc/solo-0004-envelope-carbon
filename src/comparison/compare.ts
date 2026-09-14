import type { Assembly, Surface } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { Calculation } from '../carbon/types'
import { calculate } from '../carbon/engine'
import { validateAssembly } from '../assemblies/validation'
import { surfaceLabels } from '../assemblies/types'
import { clone } from '../shared/identity'
import { number } from '../shared/format'

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

export type CaliberKey = 'surface' | 'area' | 'years'

export interface CaliberChange {
  key: CaliberKey
  label: string
  baseline: string
  current: string
  changed: boolean
}

/** 逐项列出基准与某构造在部位、面积、年限上的口径差异；未变化的项也会列出。 */
export function caliberChanges(baseline: Assembly, target: Assembly): CaliberChange[] {
  return [
    {
      key: 'surface',
      label: '建筑部位',
      baseline: surfaceLabels[baseline.surface],
      current: surfaceLabels[target.surface],
      changed: baseline.surface !== target.surface,
    },
    {
      key: 'area',
      label: '构造面积（平方米）',
      baseline: number(baseline.area),
      current: number(target.area),
      changed: baseline.area !== target.area,
    },
    {
      key: 'years',
      label: '计算年限（年）',
      baseline: number(baseline.years),
      current: number(target.years),
      changed: baseline.years !== target.years,
    },
  ]
}

/** 返回按基准统一部位、面积、年限后的构造副本，不改动入参，也不涉及修订号与时间戳。 */
export function alignedAssembly(baseline: Assembly, target: Assembly): Assembly {
  const copy = clone(target)
  copy.surface = baseline.surface as Surface
  copy.area = baseline.area
  copy.years = baseline.years
  return copy
}

export type PreviewMetricKey = 'intensity' | 'whole' | 'replacement' | 'initial' | 'transmittance'

export const previewMetricRows: { key: PreviewMetricKey; label: string }[] = [
  { key: 'intensity', label: '生命周期强度（千克当量/平方米）' },
  { key: 'whole', label: '整个构造隐含碳（千克当量）' },
  { key: 'initial', label: '初始隐含碳（千克当量/平方米）' },
  { key: 'replacement', label: '替换隐含碳（千克当量/平方米）' },
  { key: 'transmittance', label: '传热系数（瓦/平方米·开尔文）' },
]

export interface PreviewMetric {
  key: PreviewMetricKey
  label: string
  before: number | null
  after: number | null
}

export interface LayerCycleNote {
  layerId: string
  materialName: string
  before: number
  after: number
}

export interface AlignmentPreview {
  changes: CaliberChange[]
  metrics: PreviewMetric[]
  cycleNotes: LayerCycleNote[]
  errors: string[]
}

class CalculationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CalculationError'
  }
}

function safeCalculate(assembly: Assembly, materials: Material[]): Calculation | CalculationError {
  try {
    return calculate(assembly, materials)
  } catch (cause) {
    return new CalculationError(cause instanceof Error ? cause.message : '无法计算该构造。')
  }
}

/**
 * 只读预览：计算某构造按基准统一口径后，关键结果会如何变化。
 * 不修改任何构造；当前或对齐后无法计算时，以错误文本逐项说明。
 */
export function previewAlignment(
  baseline: Assembly,
  target: Assembly,
  materials: Material[],
): AlignmentPreview {
  const changes = caliberChanges(baseline, target)
  const beforeOutcome = safeCalculate(target, materials)
  const aligned = alignedAssembly(baseline, target)
  const errors = validateAssembly(aligned, materials).map((finding) => finding.text)
  const afterOutcome = errors.length ? new CalculationError('') : safeCalculate(aligned, materials)
  if (afterOutcome instanceof CalculationError && afterOutcome.message) {
    errors.push(afterOutcome.message)
  }
  const before = beforeOutcome instanceof CalculationError ? null : beforeOutcome
  const after = afterOutcome instanceof CalculationError ? null : afterOutcome

  const metrics: PreviewMetric[] = previewMetricRows.map((row) => ({
    key: row.key,
    label: row.label,
    before: before ? before[row.key] : null,
    after: after ? after[row.key] : null,
  }))

  const cycleNotes: LayerCycleNote[] = []
  if (baseline.years !== target.years && before && after) {
    const beforeCycles = new Map(before.layers.map((layer) => [layer.layerId, layer.cycles]))
    for (const layer of after.layers) {
      const beforeCyclesForLayer = beforeCycles.get(layer.layerId) ?? 0
      if (beforeCyclesForLayer !== layer.cycles) {
        cycleNotes.push({
          layerId: layer.layerId,
          materialName: layer.materialName,
          before: beforeCyclesForLayer,
          after: layer.cycles,
        })
      }
    }
  }

  return { changes, metrics, cycleNotes, errors }
}
