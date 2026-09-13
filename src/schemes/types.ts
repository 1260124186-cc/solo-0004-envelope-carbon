import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { Finding } from '../assemblies/types'

/** 组合中单个部位的引用：面积属于组合，引用版本通过快照冻结 */
export interface SchemeEntry {
  id: string
  assemblyId: string
  /** 该部位在本组合中的实际面积，不写回原构造 */
  area: number
  /** 加入或最后一次更新引用时的构造修订号，仅用于展示 */
  revision: number
  /** 加入时的构造名称，用于原构造被删除后仍可辨识 */
  name: string
  /** 冻结的构造快照，保存后不会随原构造变化 */
  snapshot: Assembly
  /** 快照使用到的材料参数 */
  materials: Material[]
  /** 快照内容校验值，用于发现原构造是否被修改 */
  checksum: string
  /** 用户选择「保留原版本」时确认的最新校验值；再次出现新版本会重新提示 */
  acknowledgedChecksum?: string
}

export interface EnvelopeScheme {
  id: string
  name: string
  note: string
  entries: SchemeEntry[]
  revision: number
  updatedAt: string
}

export type DriftStatus = 'current' | 'modified' | 'missing'

export interface EntryEvaluation {
  entry: SchemeEntry
  /** 对冻结快照进行的计算结果，原构造后续修改不影响该结果 */
  intensity: number
  whole: number
  initial: number
  replacement: number
  years: number
  status: DriftStatus
  /** 用户已显式选择「保留冻结版本」，此时不再重复提示 */
  acknowledged: boolean
  liveName: string
}

export interface SchemeEvaluation {
  entries: EntryEvaluation[]
  totalArea: number
  /** 各部分隐含碳之和；年限口径不一致时为 null，不允许直接混算 */
  totalCarbon: number | null
  /** 按总面积折算的组合强度；年限口径不一致时为 null */
  intensity: number | null
  /** 组合内出现的不同计算年限集合 */
  yearSets: number[]
  consistent: boolean
  findings: Finding[]
}
