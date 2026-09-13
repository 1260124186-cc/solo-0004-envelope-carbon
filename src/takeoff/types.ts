import type { AssemblyState, Surface } from '../assemblies/types'
import type { MaterialKind } from '../materials/types'

export type TakeoffMode = 'assembly' | 'material'

/** 单个构造层在清单中的一条归属明细，用量均为该构造面积上的总量。 */
export interface TakeoffLine {
  layerId: string
  assemblyId: string
  assemblyName: string
  surface: string
  area: number
  years: number
  /** 室外至室内的层位序号，自 1 起。 */
  position: number
  materialId: string
  materialName: string
  kind: MaterialKind
  source: string
  thickness: number
  loss: number
  lifespan: number
  cycles: number
  /** 厚度 × 面积，立方米。 */
  volume: number
  /** 厚度 × 密度 × 面积，千克（未计损耗）。 */
  mass: number
  initial: number
  replacement: number
  total: number
}

/** 同一计算年限口径下的合计；替换与生命周期合计只能在同口径内给出。 */
export interface CaliberTotal {
  years: number
  assemblyNames: string[]
  /** 涉及的不同面积之和（每个构造只计一次），平方米。 */
  coveredArea: number
  lineCount: number
  volume: number
  mass: number
  initial: number
  replacement: number
  total: number
}

/** 按构造分组视图中的一个构造段。 */
export interface AssemblyTakeoff {
  assemblyId: string
  name: string
  revision: number
  state: AssemblyState
  surface: Surface
  area: number
  years: number
  note: string
  lines: TakeoffLine[]
  /** 各层毫米厚度之和，仅表示该构造自身的构造总厚。 */
  thicknessSum: number
  volume: number
  mass: number
  initial: number
  replacement: number
  total: number
}

/** 同一种材料在某一个年限口径下的小计。 */
export interface MaterialCaliber {
  years: number
  assemblyNames: string[]
  lineCount: number
  coveredArea: number
  volume: number
  mass: number
  initial: number
  replacement: number
  total: number
}

/** 同一种材料跨构造、跨层的合并结果；归属保留在 lines 中。 */
export interface MaterialTakeoff {
  materialId: string
  materialName: string
  kind: MaterialKind
  source: string
  lines: TakeoffLine[]
  calibers: MaterialCaliber[]
  uniformYears: boolean
  /** 出现在几个构造。 */
  assemblyCount: number
  thicknessByAssembly: {
    assemblyId: string
    assemblyName: string
    years: number
    thickness: number
  }[]
  volume: number
  mass: number
  /** 初始碳与年限无关，跨口径也可合计；替换与生命周期合计仅在同口径时给出。 */
  initial: number
}

/** 已保存但无法纳入清单的构造及其原因。 */
export interface ExcludedAssembly {
  assemblyId: string
  name: string
  reasons: string[]
}

export interface TakeoffReport {
  generatedAt: string
  mode: TakeoffMode
  assemblySections: AssemblyTakeoff[]
  materialSections: MaterialTakeoff[]
  caliberTotals: CaliberTotal[]
  /** 全部入选构造是否共用同一计算年限。 */
  uniformYears: boolean
  selectedCount: number
  totalArea: number
  volume: number
  mass: number
  initial: number
  excluded: ExcludedAssembly[]
  method: string
  notes: string[]
}
