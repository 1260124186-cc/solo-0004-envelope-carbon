import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { CarbonDocument } from '../documents/types'
import type { AuditEntry } from '../audit/audit'

export interface EnvelopeData {
  schema: 1
  stamp: string
  assemblies: Assembly[]
  materials: Material[]
  documents: CarbonDocument[]
  /**
   * 只追加审计日志，与业务数据同键同锁原子写入。
   * 历史保存版本不含该字段，读取时按空数组补齐，不改变既有数据格式。
   */
  audit: AuditEntry[]
}

export const persistenceKey = 'solo-0004-envelope-carbon:design:v1'
