import type { Assembly } from '../assemblies/types'
import type { Material, MaterialKind } from '../materials/types'
import type { Breakdown, BreakdownCheck, BreakdownKind, BreakdownLayer } from './types'
import type { Dec } from '../carbon/decimal'
import { evaluate } from '../carbon/engine'
import { add, equal, fromDouble, mul, sumDec, toDouble } from '../carbon/decimal'

const kindOrder: MaterialKind[] = ['structure', 'insulation', 'finish']

function check(id: string, label: string, pass: boolean): BreakdownCheck {
  return { id, label, pass }
}

// 对已保存构造做贡献分解：初始生产与计算期内替换两段，按构造层与材料类别归集。
// 全部分解与计算面板共用同一精确引擎，对账恒等式在精确十进制下验证，任一不成立即抛错。
export function decompose(assembly: Assembly, materials: Material[]): Breakdown {
  const { calculation, exact } = evaluate(assembly, materials)
  const materialById = new Map(materials.map((material) => [material.id, material]))
  const exactByLayerId = new Map(exact.layers.map((layer) => [layer.layerId, layer]))
  const resultByLayerId = new Map(calculation.layers.map((layer) => [layer.layerId, layer]))
  const area = fromDouble(assembly.area)
  const shareOf = (total: number) =>
    calculation.intensity === 0 ? 0 : total / calculation.intensity

  const layers: BreakdownLayer[] = assembly.layers.map((layer, index) => {
    const material = materialById.get(layer.materialId)
    if (!material) throw new Error('材料参数缺失，无法分解。')
    const exactLayer = exactByLayerId.get(layer.id)
    const result = resultByLayerId.get(layer.id)
    if (!exactLayer || !result) throw new Error('构造层缺失，无法分解。')
    return {
      layerId: layer.id,
      order: index + 1,
      materialId: material.id,
      materialName: material.name,
      kind: material.kind,
      thickness: layer.thickness,
      cycles: result.cycles,
      initial: result.initial,
      replacement: result.replacement,
      total: result.total,
      whole: toDouble(mul(exactLayer.total, area)),
      share: shareOf(result.total),
    }
  })

  const buckets = new Map<
    MaterialKind,
    { initials: Dec[]; replacements: Dec[]; totals: Dec[]; sources: BreakdownKind['sources'] }
  >()
  for (const layer of layers) {
    const exactLayer = exactByLayerId.get(layer.layerId)!
    let bucket = buckets.get(layer.kind)
    if (!bucket) {
      bucket = { initials: [], replacements: [], totals: [], sources: [] }
      buckets.set(layer.kind, bucket)
    }
    bucket.initials.push(exactLayer.initial)
    bucket.replacements.push(exactLayer.replacement)
    bucket.totals.push(exactLayer.total)
    bucket.sources.push({
      layerId: layer.layerId,
      order: layer.order,
      materialName: layer.materialName,
      total: layer.total,
    })
  }
  const kinds: BreakdownKind[] = []
  const kindTotals: Dec[] = []
  const kindInitials: Dec[] = []
  const kindReplacements: Dec[] = []
  for (const kind of kindOrder) {
    const bucket = buckets.get(kind)
    if (!bucket) continue
    const initial = sumDec(bucket.initials)
    const replacement = sumDec(bucket.replacements)
    const total = sumDec(bucket.totals)
    kindInitials.push(initial)
    kindReplacements.push(replacement)
    kindTotals.push(total)
    const totalNumber = toDouble(total)
    kinds.push({
      kind,
      initial: toDouble(initial),
      replacement: toDouble(replacement),
      total: totalNumber,
      whole: toDouble(mul(total, area)),
      share: shareOf(totalNumber),
      sources: bucket.sources,
    })
  }

  const layerWholes = exact.layers.map((layer) => mul(layer.total, area))
  const kindWholes = kindTotals.map((total) => mul(total, area))
  const checks: BreakdownCheck[] = [
    check(
      'phase',
      '初始生产 + 计算期内替换 = 生命周期强度',
      equal(add(exact.initial, exact.replacement), exact.intensity),
    ),
    check(
      'layer-initial',
      '各层初始生产之和 = 初始生产合计',
      equal(sumDec(exact.layers.map((layer) => layer.initial)), exact.initial),
    ),
    check(
      'layer-replacement',
      '各层替换之和 = 替换合计',
      equal(sumDec(exact.layers.map((layer) => layer.replacement)), exact.replacement),
    ),
    check(
      'layer-total',
      '各层合计之和 = 生命周期强度',
      equal(sumDec(exact.layers.map((layer) => layer.total)), exact.intensity),
    ),
    check(
      'layer-split',
      '每层初始 + 替换 = 该层合计',
      exact.layers.every((layer) => equal(add(layer.initial, layer.replacement), layer.total)),
    ),
    check(
      'kind-initial',
      '各类别初始之和 = 初始生产合计',
      equal(sumDec(kindInitials), exact.initial),
    ),
    check(
      'kind-replacement',
      '各类别替换之和 = 替换合计',
      equal(sumDec(kindReplacements), exact.replacement),
    ),
    check(
      'kind-total',
      '各类别合计之和 = 生命周期强度',
      equal(sumDec(kindTotals), exact.intensity),
    ),
    check(
      'whole-scale',
      '生命周期强度 × 面积 = 整个构造隐含碳',
      equal(mul(exact.intensity, area), exact.whole),
    ),
    check(
      'layer-whole',
      '各层总量贡献之和 = 整个构造隐含碳',
      equal(sumDec(layerWholes), exact.whole),
    ),
    check(
      'kind-whole',
      '各类别总量贡献之和 = 整个构造隐含碳',
      equal(sumDec(kindWholes), exact.whole),
    ),
  ]
  const failed = checks.find((item) => !item.pass)
  if (failed) throw new Error(`贡献分解对账失败：${failed.label}`)

  return {
    assemblyId: assembly.id,
    revision: assembly.revision,
    area: assembly.area,
    years: assembly.years,
    initial: calculation.initial,
    replacement: calculation.replacement,
    intensity: calculation.intensity,
    whole: calculation.whole,
    layers,
    kinds,
    checks,
    method: calculation.method,
  }
}
