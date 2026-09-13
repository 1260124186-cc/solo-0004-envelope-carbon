import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import { calculate } from '../carbon/engine'
import { clone, newId, now } from '../shared/identity'
import { propertyLabels, propertyUnits } from './types'
import type {
  Crossing,
  MaterialProperty,
  ParameterOption,
  SensitivityRun,
  SweepParameter,
  SweepPoint,
} from './types'

export const maxPoints = 200
export const maxRuns = 100

// 与构造、材料校验保持一致的物理边界
const bounds: Record<'thickness' | MaterialProperty, { min: number; max: number }> = {
  thickness: { min: 0.1, max: 2000 },
  density: { min: 1, max: 30000 },
  conductivity: { min: 0.001, max: 500 },
  factor: { min: 0, max: 100 },
}

export function parameterOptions(assembly: Assembly, materials: Material[]): ParameterOption[] {
  const options: ParameterOption[] = []
  assembly.layers.forEach((layer, index) => {
    const material = materials.find((item) => item.id === layer.materialId)
    if (!material) return
    options.push({
      key: `thickness:${layer.id}`,
      parameter: { kind: 'thickness', layerId: layer.id },
      label: `第 ${index + 1} 层 · ${material.name} · 厚度`,
      unit: '毫米',
      ...bounds.thickness,
      current: layer.thickness,
      layers: 1,
    })
  })
  const seen = new Set<string>()
  for (const layer of assembly.layers) {
    if (seen.has(layer.materialId)) continue
    seen.add(layer.materialId)
    const material = materials.find((item) => item.id === layer.materialId)
    if (!material) continue
    const layers = assembly.layers.filter((item) => item.materialId === material.id).length
    for (const kind of ['density', 'conductivity', 'factor'] as MaterialProperty[]) {
      options.push({
        key: `${kind}:${material.id}`,
        parameter: { kind, materialId: material.id },
        label: `${material.name} · ${propertyLabels[kind]}`,
        unit: propertyUnits[kind],
        ...bounds[kind],
        current: material[kind],
        layers,
      })
    }
  }
  return options
}

export function sameParameter(a: SweepParameter, b: SweepParameter): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'thickness' && b.kind === 'thickness') return a.layerId === b.layerId
  if (a.kind !== 'thickness' && b.kind !== 'thickness') return a.materialId === b.materialId
  return false
}

export function currentValue(
  assembly: Assembly,
  materials: Material[],
  parameter: SweepParameter,
): number | undefined {
  if (parameter.kind === 'thickness') {
    return assembly.layers.find((layer) => layer.id === parameter.layerId)?.thickness
  }
  return materials.find((material) => material.id === parameter.materialId)?.[parameter.kind]
}

function tidy(value: number): number {
  return Number(value.toPrecision(3))
}

export function suggestedRange(option: ParameterOption): {
  lower: number
  upper: number
  step: number
} {
  let lower = Math.max(option.min, option.current * 0.5)
  let upper = Math.min(option.max, option.current * 1.5)
  if (!(upper > lower)) {
    lower = option.min
    upper = option.max
  }
  return { lower: tidy(lower), upper: tidy(upper), step: tidy((upper - lower) / 20) }
}

export function sweepValues(lower: number, upper: number, step: number): number[] {
  const values: number[] = []
  const epsilon = Math.abs(step) * 1e-9
  for (let value = lower; value <= upper + epsilon; value += step) {
    values.push(value)
    if (values.length > maxPoints) return values
  }
  if (values.length && upper - values[values.length - 1] > epsilon) values.push(upper)
  return values
}

export function rangeProblems(
  option: ParameterOption,
  lower: number,
  upper: number,
  step: number,
): string[] {
  if (![lower, upper, step].every((value) => Number.isFinite(value))) {
    return ['请完整填写下限、上限和步长。']
  }
  const problems: string[] = []
  if (lower < option.min || upper > option.max) {
    problems.push(`扫描范围需在 ${option.min} 至 ${option.max} ${option.unit} 之间。`)
  }
  if (lower >= upper) problems.push('下限需小于上限。')
  if (step <= 0) problems.push('步长需大于 0。')
  if (problems.length) return problems
  if (sweepValues(lower, upper, step).length > maxPoints) {
    problems.push(`候选点超过 ${maxPoints} 个，请增大步长或缩小范围。`)
  }
  return problems
}

function applyParameter(
  assembly: Assembly,
  materials: Material[],
  parameter: SweepParameter,
  value: number,
): { assembly: Assembly; materials: Material[] } {
  if (parameter.kind === 'thickness') {
    // 只改克隆构造中所选的一层，同材料的其他层保持原厚度
    const candidate = clone(assembly)
    const layer = candidate.layers.find((item) => item.id === parameter.layerId)
    if (!layer) throw new Error('扫描的构造层不存在。')
    layer.thickness = value
    return { assembly: candidate, materials }
  }
  // 同一材料被多层引用时，物性变化同时作用于全部引用层，其余参数保持不变
  if (!materials.some((item) => item.id === parameter.materialId)) {
    throw new Error('扫描的材料不存在。')
  }
  const swept = materials.map((item) =>
    item.id === parameter.materialId ? { ...item, [parameter.kind]: value } : item,
  )
  return { assembly, materials: swept }
}

export function findCrossings(
  points: SweepPoint[],
  carbonLimit: number,
  thermalLimit: number,
): Crossing[] {
  const crossings: Crossing[] = []
  const scan = (
    metric: Crossing['metric'],
    read: (point: SweepPoint) => number,
    passed: (point: SweepPoint) => boolean,
    limit: number,
  ) => {
    for (let index = 1; index < points.length; index += 1) {
      const before = points[index - 1]
      const after = points[index]
      if (passed(before) === passed(after)) continue
      const m1 = read(before)
      const m2 = read(after)
      let at: number
      if (m1 === limit) at = before.value
      else if (m2 === limit) at = after.value
      else at = before.value + ((limit - m1) * (after.value - before.value)) / (m2 - m1)
      crossings.push({
        metric,
        at,
        fromValue: before.value,
        toValue: after.value,
        direction: passed(after) ? 'into' : 'out',
      })
    }
  }
  scan(
    'carbon',
    (point) => point.intensity,
    (point) => point.carbonPass,
    carbonLimit,
  )
  scan(
    'thermal',
    (point) => point.transmittance,
    (point) => point.thermalPass,
    thermalLimit,
  )
  return crossings
}

export function runSweep(
  assembly: Assembly,
  materials: Material[],
  option: ParameterOption,
  lower: number,
  upper: number,
  step: number,
): { points: SweepPoint[]; crossings: Crossing[] } {
  if (rangeProblems(option, lower, upper, step).length) throw new Error('扫描范围无效。')
  const points = sweepValues(lower, upper, step).map((value) => {
    const candidate = applyParameter(assembly, materials, option.parameter, value)
    const result = calculate(candidate.assembly, candidate.materials)
    return {
      value,
      intensity: result.intensity,
      transmittance: result.transmittance,
      carbonPass: result.carbonPass,
      thermalPass: result.thermalPass,
    }
  })
  return { points, crossings: findCrossings(points, assembly.carbonLimit, assembly.thermalLimit) }
}

export function createRun(
  assembly: Assembly,
  materials: Material[],
  option: ParameterOption,
  lower: number,
  upper: number,
  step: number,
): SensitivityRun {
  const { points, crossings } = runSweep(assembly, materials, option, lower, upper, step)
  const used = new Set(assembly.layers.map((layer) => layer.materialId))
  return {
    id: newId('sensitivity-run'),
    createdAt: now(),
    assemblyId: assembly.id,
    parameter: clone(option.parameter),
    label: option.label,
    unit: option.unit,
    lower,
    upper,
    step,
    assembly: clone(assembly),
    materials: clone(materials.filter((material) => used.has(material.id))),
    points,
    crossings,
  }
}

export function verifyRun(run: SensitivityRun): boolean {
  try {
    const option = parameterOptions(run.assembly, run.materials).find((item) =>
      sameParameter(item.parameter, run.parameter),
    )
    if (!option) return false
    const { points, crossings } = runSweep(
      run.assembly,
      run.materials,
      option,
      run.lower,
      run.upper,
      run.step,
    )
    return (
      JSON.stringify(points) === JSON.stringify(run.points) &&
      JSON.stringify(crossings) === JSON.stringify(run.crossings)
    )
  } catch {
    return false
  }
}
