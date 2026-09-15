import type { Assembly, Layer } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { Calculation, LayerResult } from './types'
import { validateAssembly } from '../assemblies/validation'
import { validateMaterial } from '../materials/validation'

export const calculationMethod = '材料质量法 1.0 · 初始生产与同因子替换'

export interface LayerCarbonBasis {
  mass: number
  initial: number
}

export function layerCarbonBasis(layer: Layer, material: Material): LayerCarbonBasis {
  const mass = (layer.thickness / 1000) * material.density
  const initial = mass * material.factor * (1 + layer.loss / 100)
  return { mass, initial }
}

export function replacementYears(years: number, lifespan: number): number[] {
  const schedule: number[] = []
  for (let cycle = 1; cycle * lifespan < years; cycle += 1) schedule.push(cycle * lifespan)
  return schedule
}

export function replacementCycles(years: number, lifespan: number): number {
  return replacementYears(years, lifespan).length
}

export function calculate(assembly: Assembly, materials: Material[]): Calculation {
  const issues = validateAssembly(assembly, materials)
  if (issues.length) throw new Error(issues.map((issue) => issue.text).join('\n'))
  const byId = new Map(materials.map((material) => [material.id, material]))
  const layers: LayerResult[] = assembly.layers.map((layer) => {
    const material = byId.get(layer.materialId)
    if (!material) throw new Error('材料参数缺失，无法计算。')
    const errors = validateMaterial(material)
    if (errors.length) throw new Error(errors.join('\n'))
    const { mass, initial } = layerCarbonBasis(layer, material)
    const cycles = replacementCycles(assembly.years, layer.lifespan)
    const replacement = initial * cycles
    return {
      layerId: layer.id,
      materialName: material.name,
      thickness: layer.thickness,
      mass,
      initial,
      replacement,
      cycles,
      total: initial + replacement,
      resistance: layer.thickness / 1000 / material.conductivity,
      source: material.source,
    }
  })
  const sum = (field: 'thickness' | 'mass' | 'initial' | 'replacement' | 'total' | 'resistance') =>
    layers.reduce((total, layer) => total + layer[field], 0)
  const resistance = 0.11 + 0.04 + sum('resistance')
  const intensity = sum('total')
  const transmittance = 1 / resistance
  return {
    layers,
    thickness: sum('thickness'),
    mass: sum('mass'),
    initial: sum('initial'),
    replacement: sum('replacement'),
    intensity,
    whole: intensity * assembly.area,
    resistance,
    transmittance,
    carbonPass: intensity <= assembly.carbonLimit,
    thermalPass: transmittance <= assembly.thermalLimit,
    method: calculationMethod,
  }
}
