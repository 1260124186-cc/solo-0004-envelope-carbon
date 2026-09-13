import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { PlanEntry, PlanYear, ReplacementPlan } from './types'
import { calculate } from '../carbon/engine'
import { clone, newId, now } from '../shared/identity'

/** 构造层在替换计划中的显示名：同一种材料出现在不同层时用层位区分。 */
export function layerLabel(index: number, materialName: string): string {
  return `第 ${index + 1} 层 · ${materialName}`
}

/**
 * 按年份排列材料替换记录。
 * 第零年为初始材料生产；替换发生在寿命整数倍年份上，
 * 恰好落在计算期终点（year === years）的替换按计算规则排除。
 */
export function buildPlanYears(assembly: Assembly, materials: Material[]): PlanYear[] {
  const result = calculate(assembly, materials)
  const byId = new Map(materials.map((material) => [material.id, material]))
  const entryOf = (layerResult: (typeof result.layers)[number], index: number): PlanEntry => {
    const layer = assembly.layers[index]
    const material = byId.get(layer.materialId)!
    return {
      layerId: layer.id,
      layerIndex: index,
      layerLabel: layerLabel(index, layerResult.materialName),
      materialId: material.id,
      materialName: layerResult.materialName,
      thickness: layer.thickness,
      lifespan: layer.lifespan,
      carbon: layerResult.initial,
      wholeCarbon: layerResult.initial * assembly.area,
      source: material.source,
    }
  }
  const initial: PlanYear = {
    year: 0,
    phase: 'initial',
    entries: result.layers.map((layer, index) => entryOf(layer, index)),
    total: result.initial,
    wholeTotal: result.initial * assembly.area,
  }
  const groups = new Map<number, PlanEntry[]>()
  result.layers.forEach((layer, index) => {
    for (let k = 1; k <= layer.cycles; k++) {
      const year = k * assembly.layers[index].lifespan
      if (year >= assembly.years) continue
      const entries = groups.get(year) ?? []
      entries.push(entryOf(layer, index))
      groups.set(year, entries)
    }
  })
  const replacements: PlanYear[] = [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, entries]) => {
      const ordered = entries.slice().sort((a, b) => a.layerIndex - b.layerIndex)
      const total = ordered.reduce((sum, entry) => sum + entry.carbon, 0)
      return {
        year,
        phase: 'replacement' as const,
        entries: ordered,
        total,
        wholeTotal: total * assembly.area,
      }
    })
  return [initial, ...replacements]
}

/** 计划累计隐含碳必须与对应构造的生命周期结果一致。 */
export function planMatchesResult(plan: ReplacementPlan): boolean {
  const intensity = plan.years.reduce((sum, record) => sum + record.total, 0)
  return (
    Math.abs(intensity - plan.result.intensity) < 1e-9 &&
    Math.abs(intensity * plan.assembly.area - plan.result.whole) < 1e-6
  )
}

export function createPlan(assembly: Assembly, materials: Material[]): ReplacementPlan {
  const result = calculate(assembly, materials)
  const years = buildPlanYears(assembly, materials)
  const used = new Set(assembly.layers.map((layer) => layer.materialId))
  const plan: ReplacementPlan = {
    id: newId('replacement-plan'),
    assemblyId: assembly.id,
    createdAt: now(),
    assembly: clone(assembly),
    materials: clone(materials.filter((material) => used.has(material.id))),
    result: clone(result),
    years: clone(years),
  }
  if (!planMatchesResult(plan)) throw new Error('替换计划累计与生命周期结果不一致。')
  return plan
}
