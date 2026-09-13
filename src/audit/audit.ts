// 只追加审计日志的领域定义。条目与设计数据共用同一存储键，
// 在同一互斥锁临界区写入，因此 seq 即跨标签页的全局提交顺序。

export type AuditAction =
  | 'assembly-save'
  | 'assembly-create'
  | 'material-create'
  | 'assembly-finalize'
  | 'assembly-reopen'
  | 'comparison-align'

export type AuditOutcome = 'committed' | 'rejected'

export type AuditTargetKind = 'assembly' | 'material' | 'comparison'

export interface AuditEntry {
  /** 锁内分配的全局连续序号，从 1 开始，即落库先后顺序。 */
  seq: number
  /** 发生时间，锁内生成，使用 ISO 8601 UTC 时间。 */
  at: string
  action: AuditAction
  outcome: AuditOutcome
  targetKind: AuditTargetKind
  /** 涉及的构造、材料标识；口径对齐为「基准标识 → 替代标识」。 */
  targetId: string
  /** 动作发生时的名称快照，便于在标识删除后仍可阅读。 */
  targetName: string
  /** 操作者：浏览器稳定标识#标签页会话标识。 */
  actor: string
  /** 成功时的补充说明，如“新建构造”“修订 3”。 */
  detail: string
  /** 被拒绝或冲突时的原因；成功落库为空串。 */
  reason: string
}

/** 审计条目最多保留条数；超出后只丢弃最旧条目，不阻止新写入。 */
export const auditLimit = 2000

export const actionLabels: Record<AuditAction, string> = {
  'assembly-save': '保存构造',
  'assembly-create': '新建构造',
  'material-create': '新建材料',
  'assembly-finalize': '生成定稿',
  'assembly-reopen': '重新开启编辑',
  'comparison-align': '对齐比较口径',
}

export const outcomeLabels: Record<AuditOutcome, string> = {
  committed: '成功',
  rejected: '已拒绝',
}

export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(actionLabels, value)
}

export function isAuditOutcome(value: unknown): value is AuditOutcome {
  return value === 'committed' || value === 'rejected'
}
