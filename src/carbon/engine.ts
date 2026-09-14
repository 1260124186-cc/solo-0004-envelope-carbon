import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { Calculation, LayerResult } from './types'
import type { Dec } from './decimal'
import { validateAssembly } from '../assemblies/validation'
import { validateMaterial } from '../materials/validation'
import { add, divByPowerOfTen, fromDouble, mul, oneDec, sumDec, toDouble } from './decimal'

export const calculationMethod = '材料质量法 1.0 · 初始生产与同因子替换'

export function replacementCycles(years: number, lifespan: number): number {
  return Math.max(0, Math.ceil(years / lifespan) - 1)
}

export interface ExactLayer {
  layerId: string
  mass: Dec
  initial: Dec
  replacement: Dec
  total: Dec
}

export interface Evaluation {
  calculation: Calculation
  exact: {
    layers: ExactLayer[]
    initial: Dec
    replacement: Dec
    intensity: Dec
    whole: Dec
  }
}

export function evaluate(assembly: Assembly, materials: Material[]): Evaluation {
  const issues = validateAssembly(assembly, materials)
  if (issues.length) throw new Error(issues.map((issue) => issue.text).join('\n'))
  const byId = new Map(materials.map((material) => [material.id, material]))
  const exactLayers: ExactLayer[] = []
  const layers: LayerResult[] = assembly.layers.map((layer) => {
    const material = byId.get(layer.materialId)
    if (!material) throw new Error('材料参数缺失，无法计算。')
    const errors = validateMaterial(material)
    if (errors.length) throw new Error(errors.join('\n'))
    const massDec = mul(
      divByPowerOfTen(fromDouble(layer.thickness), 3),
      fromDouble(material.density),
    )
    const lossFactor = add(oneDec, divByPowerOfTen(fromDouble(layer.loss), 2))
    const initialDec = mul(mul(massDec, fromDouble(material.factor)), lossFactor)
    const cycles = replacementCycles(assembly.years, layer.lifespan)
    const replacementDec = mul(initialDec, fromDouble(cycles))
    const totalDec = add(initialDec, replacementDec)
    exactLayers.push({
      layerId: layer.id,
      mass: massDec,
      initial: initialDec,
      replacement: replacementDec,
      total: totalDec,
    })
    return {
      layerId: layer.id,
      materialName: material.name,
      thickness: layer.thickness,
      mass: toDouble(massDec),
      initial: toDouble(initialDec),
      replacement: toDouble(replacementDec),
      cycles,
      total: toDouble(totalDec),
      resistance: layer.thickness / 1000 / material.conductivity,
      source: material.source,
    }
  })
  // 碳量按精确十进制汇总，保证初始+替换、逐层之和与总量严格一致；热阻为简化浮点算法。
  const initial = sumDec(exactLayers.map((layer) => layer.initial))
  const replacement = sumDec(exactLayers.map((layer) => layer.replacement))
  const intensity = sumDec(exactLayers.map((layer) => layer.total))
  const whole = mul(intensity, fromDouble(assembly.area))
  const thickness = sumDec(assembly.layers.map((layer) => fromDouble(layer.thickness)))
  const mass = sumDec(exactLayers.map((layer) => layer.mass))
  const resistance = 0.11 + 0.04 + layers.reduce((total, layer) => total + layer.resistance, 0)
  const intensityNumber = toDouble(intensity)
  const transmittance = 1 / resistance
  return {
    calculation: {
      layers,
      thickness: toDouble(thickness),
      mass: toDouble(mass),
      initial: toDouble(initial),
      replacement: toDouble(replacement),
      intensity: intensityNumber,
      whole: toDouble(whole),
      resistance,
      transmittance,
      carbonPass: intensityNumber <= assembly.carbonLimit,
      thermalPass: transmittance <= assembly.thermalLimit,
      method: calculationMethod,
    },
    exact: { layers: exactLayers, initial, replacement, intensity, whole },
  }
}

export function calculate(assembly: Assembly, materials: Material[]): Calculation {
  return evaluate(assembly, materials).calculation
}
