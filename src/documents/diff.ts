import type { Layer, Surface } from '../assemblies/types'
import type { LayerResult } from '../carbon/types'
import type { Material } from '../materials/types'
import type { CarbonDocument } from './types'

// 两版对照的唯一数据依据是两份计算书各自冻结的 assembly / materials / result。
// 本模块刻意不引入 carbon.engine 与材料目录：旧版参数不允许用当前目录重算。

export interface ValueChange<T> {
  before: T
  after: T
}

export interface NumericChange extends ValueChange<number> {
  delta: number
}

export interface FrozenLayer {
  layer: Layer
  material: Material | undefined
  result: LayerResult | undefined
}

export type LayerChangeKind = 'matched' | 'added' | 'removed'

export interface LayerParameterChange extends NumericChange {
  key: 'thickness' | 'loss' | 'lifespan'
  label: string
  unit: string
}

export interface LayerPropertyChange extends ValueChange<string | number> {
  key: 'density' | 'conductivity' | 'factor' | 'lifespan' | 'source'
  label: string
}

export interface LayerDiff {
  layerId: string
  kind: LayerChangeKind
  before: FrozenLayer | null
  after: FrozenLayer | null
  beforePosition: number | null
  afterPosition: number | null
  moved: boolean
  replacedMaterial: boolean
  parameterChanges: LayerParameterChange[]
  propertyChanges: LayerPropertyChange[]
  cyclesChange: ValueChange<number> | null
  carbonChange: NumericChange | null
  unchanged: boolean
}

export type ResultKey =
  | 'initial'
  | 'replacement'
  | 'intensity'
  | 'whole'
  | 'transmittance'
  | 'thickness'

export interface ResultChange extends NumericChange {
  key: ResultKey
  label: string
  unit: string
}

export interface PassChange extends ValueChange<boolean> {
  key: 'carbonPass' | 'thermalPass'
  label: string
}

export interface DocumentDiff {
  before: CarbonDocument
  after: CarbonDocument
  surface: ValueChange<Surface>
  area: NumericChange
  years: ValueChange<number>
  layers: LayerDiff[]
  results: ResultChange[]
  passChanges: PassChange[]
  intensityPercent: number | null
}

const parameterMetas = [
  { key: 'thickness', label: '厚度', unit: '毫米' },
  { key: 'loss', label: '施工损耗', unit: '%' },
  { key: 'lifespan', label: '替换寿命', unit: '年' },
] as const

const propertyMetas = [
  { key: 'density', label: '密度' },
  { key: 'conductivity', label: '导热系数' },
  { key: 'factor', label: '单位质量碳因子' },
  { key: 'lifespan', label: '材料参考寿命' },
  { key: 'source', label: '参数来源' },
] as const

const resultMetas: { key: ResultKey; label: string; unit: string }[] = [
  { key: 'initial', label: '初始隐含碳', unit: '千克当量/平方米' },
  { key: 'replacement', label: '替换隐含碳', unit: '千克当量/平方米' },
  { key: 'intensity', label: '生命周期强度', unit: '千克当量/平方米' },
  { key: 'whole', label: '整个构造隐含碳', unit: '千克二氧化碳当量' },
  { key: 'transmittance', label: '传热系数', unit: '瓦/(平方米·开尔文)' },
  { key: 'thickness', label: '构造总厚度', unit: '毫米' },
]

function changed<T>(before: T, after: T): boolean {
  return !Object.is(before, after)
}

function numericChange(before: number, after: number): NumericChange {
  return { before, after, delta: after - before }
}

function freezeAt(document: CarbonDocument, layer: Layer): FrozenLayer {
  return {
    layer,
    material: document.materials.find((item) => item.id === layer.materialId),
    result: document.result.layers.find((item) => item.layerId === layer.id),
  }
}

function diffMatchedLayer(
  layerId: string,
  before: FrozenLayer,
  after: FrozenLayer,
  beforePosition: number,
  afterPosition: number,
  moved: boolean,
): LayerDiff {
  const parameterChanges = parameterMetas.flatMap<LayerParameterChange>((meta) => {
    const oldValue = before.layer[meta.key]
    const newValue = after.layer[meta.key]
    return changed(oldValue, newValue)
      ? [
          {
            key: meta.key,
            label: meta.label,
            unit: meta.unit,
            before: oldValue,
            after: newValue,
            delta: newValue - oldValue,
          },
        ]
      : []
  })
  const replacedMaterial = changed(before.layer.materialId, after.layer.materialId)
  const propertyChanges =
    before.material && after.material
      ? propertyMetas.flatMap<LayerPropertyChange>((meta) => {
          const oldValue = before.material![meta.key]
          const newValue = after.material![meta.key]
          return changed(oldValue, newValue)
            ? [{ key: meta.key, label: meta.label, before: oldValue, after: newValue }]
            : []
        })
      : []
  const cyclesChange =
    before.result && after.result && changed(before.result.cycles, after.result.cycles)
      ? { before: before.result.cycles, after: after.result.cycles }
      : null
  const carbonChange =
    before.result && after.result ? numericChange(before.result.total, after.result.total) : null
  const unchanged =
    !moved &&
    !replacedMaterial &&
    parameterChanges.length === 0 &&
    propertyChanges.length === 0 &&
    !cyclesChange &&
    (carbonChange ? carbonChange.delta === 0 : true)
  return {
    layerId,
    kind: 'matched',
    before,
    after,
    beforePosition,
    afterPosition,
    moved,
    replacedMaterial,
    parameterChanges,
    propertyChanges,
    cyclesChange,
    carbonChange,
    unchanged,
  }
}

export function diffDocuments(before: CarbonDocument, after: CarbonDocument): DocumentDiff {
  if (before.id === after.id) throw new Error('请选择两个不同的版本。')

  const beforeEntries = before.assembly.layers.map((layer, position) => ({
    layer,
    position,
    view: freezeAt(before, layer),
  }))
  const afterEntries = after.assembly.layers.map((layer, position) => ({
    layer,
    position,
    view: freezeAt(after, layer),
  }))
  const beforeMap = new Map(beforeEntries.map((entry) => [entry.layer.id, entry]))
  const afterMap = new Map(afterEntries.map((entry) => [entry.layer.id, entry]))

  // 只按层的稳定标识匹配，绝不按显示行号配对。
  // 用保留层在各自版本中的相对排名判断调序：
  // 插入或删除造成的整体行号平移不会改变相对排名，因此不会被误报为调序。
  const commonBefore = beforeEntries.filter((entry) => afterMap.has(entry.layer.id))
  const commonAfter = afterEntries.filter((entry) => beforeMap.has(entry.layer.id))
  const rankBefore = new Map(commonBefore.map((entry, rank) => [entry.layer.id, rank]))
  const rankAfter = new Map(commonAfter.map((entry, rank) => [entry.layer.id, rank]))

  const layers: LayerDiff[] = afterEntries.map((entry) => {
    const old = beforeMap.get(entry.layer.id)
    if (!old) {
      return {
        layerId: entry.layer.id,
        kind: 'added',
        before: null,
        after: entry.view,
        beforePosition: null,
        afterPosition: entry.position,
        moved: false,
        replacedMaterial: false,
        parameterChanges: [],
        propertyChanges: [],
        cyclesChange: null,
        carbonChange: entry.view.result
          ? { before: 0, after: entry.view.result.total, delta: entry.view.result.total }
          : null,
        unchanged: false,
      }
    }
    return diffMatchedLayer(
      entry.layer.id,
      old.view,
      entry.view,
      old.position,
      entry.position,
      rankBefore.get(entry.layer.id) !== rankAfter.get(entry.layer.id),
    )
  })
  for (const entry of beforeEntries) {
    if (!afterMap.has(entry.layer.id)) {
      layers.push({
        layerId: entry.layer.id,
        kind: 'removed',
        before: entry.view,
        after: null,
        beforePosition: entry.position,
        afterPosition: null,
        moved: false,
        replacedMaterial: false,
        parameterChanges: [],
        propertyChanges: [],
        cyclesChange: null,
        carbonChange: entry.view.result
          ? { before: entry.view.result.total, after: 0, delta: -entry.view.result.total }
          : null,
        unchanged: false,
      })
    }
  }

  const results: ResultChange[] = resultMetas.map((meta) => ({
    ...numericChange(before.result[meta.key], after.result[meta.key]),
    key: meta.key,
    label: meta.label,
    unit: meta.unit,
  }))
  const passMetas: { key: PassChange['key']; label: string }[] = [
    { key: 'carbonPass', label: '碳强度目标' },
    { key: 'thermalPass', label: '传热上限' },
  ]
  const passChanges = passMetas.flatMap<PassChange>((meta) => {
    const oldValue = before.result[meta.key]
    const newValue = after.result[meta.key]
    return changed(oldValue, newValue)
      ? [{ key: meta.key, label: meta.label, before: oldValue, after: newValue }]
      : []
  })
  const intensityBefore = before.result.intensity
  const intensityAfter = after.result.intensity
  return {
    before,
    after,
    surface: { before: before.assembly.surface, after: after.assembly.surface },
    area: numericChange(before.assembly.area, after.assembly.area),
    years: { before: before.assembly.years, after: after.assembly.years },
    layers,
    results,
    passChanges,
    intensityPercent:
      intensityBefore === 0 ? null : ((intensityAfter - intensityBefore) / intensityBefore) * 100,
  }
}
