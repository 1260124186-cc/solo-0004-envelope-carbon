import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import { calculate } from '../carbon/engine'
import { clone, newId, now } from '../shared/identity'
import { comparableReasons } from './compare'
import type { ComparisonRecord } from './types'

function usedMaterials(assembly: Assembly, materials: Material[]): Material[] {
  const byId = new Map(materials.map((material) => [material.id, material]))
  return assembly.layers
    .map((layer) => byId.get(layer.materialId))
    .filter((material): material is Material => Boolean(material))
}

/**
 * 基于两个已保存构造生成不可变的比较记录。
 * 入参必须来自持久化后的构造集合，调用方负责排除编辑草稿；
 * 构造与材料均按当前值深拷贝冻结，之后修改不会改变记录。
 */
export function saveComparison(
  baseline: Assembly,
  alternative: Assembly,
  materials: Material[],
): ComparisonRecord {
  const reasons = comparableReasons(baseline, alternative)
  if (reasons.length) throw new Error(reasons.join('\n'))
  const baselineResult = calculate(baseline, materials)
  const alternativeResult = calculate(alternative, materials)
  return {
    id: newId('comparison-record'),
    createdAt: now(),
    baseline: {
      assembly: clone(baseline),
      materials: clone(usedMaterials(baseline, materials)),
      result: clone(baselineResult),
    },
    alternative: {
      assembly: clone(alternative),
      materials: clone(usedMaterials(alternative, materials)),
      result: clone(alternativeResult),
    },
    carbonDelta: alternativeResult.intensity - baselineResult.intensity,
    wholeDelta: alternativeResult.whole - baselineResult.whole,
    thermalDelta: alternativeResult.transmittance - baselineResult.transmittance,
    percent:
      baselineResult.intensity === 0
        ? null
        : ((alternativeResult.intensity - baselineResult.intensity) / baselineResult.intensity) *
          100,
  }
}
