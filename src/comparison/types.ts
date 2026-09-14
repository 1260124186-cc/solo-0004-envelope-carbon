import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { Calculation } from '../carbon/types'

/**
 * 保存的比较结果：冻结比较时两个已保存构造的副本、
 * 当时涉及的材料物性，以及各自的计算结果与差值。
 * 导出报告只能读取本记录，不读取当前草稿或材料目录。
 */
export interface ComparisonRecord {
  id: string
  createdAt: string
  baseline: {
    assembly: Assembly
    materials: Material[]
    result: Calculation
  }
  alternative: {
    assembly: Assembly
    materials: Material[]
    result: Calculation
  }
  /** 生命周期强度差值（替代 − 基准），千克二氧化碳当量/平方米 */
  carbonDelta: number
  /** 整个构造隐含碳差值（替代 − 基准），千克二氧化碳当量 */
  wholeDelta: number
  /** 传热系数差值（替代 − 基准），瓦/(平方米·开尔文) */
  thermalDelta: number
  /** 生命周期强度相对基准的变化百分比；基准强度为零时为 null */
  percent: number | null
}
