import type { EnvelopeData } from './types'
import { persistenceKey } from './types'
import { seedData } from './seed'
import { decode } from './decode'
import { auditLimit, type AuditAction, type AuditTargetKind } from '../audit/audit'
import { currentActor } from '../audit/actor'
import { clone, newId, now } from '../shared/identity'

const quotaFailure = '浏览器保存失败，可能空间不足或存储被禁用。本次修改仍保留在编辑区。'

export function readData(): EnvelopeData {
  const raw = localStorage.getItem(persistenceKey)
  return raw === null ? seedData() : decode(raw)
}

/** 调用方在发起一次有意义变更时提供的审计意图。 */
export interface AuditIntent {
  action: AuditAction
  targetKind: AuditTargetKind
  targetId: string
  targetName: string
  /** 成功落库时的补充说明；默认空串。 */
  detail?: string
}

/**
 * 在锁内给数据追加一条审计。所有条目都经同一临界区、同一次 setItem 落库，
 * 因此互斥锁的串行顺序就是审计顺序：跨标签页并发也不会丢失或颠倒动作。
 */
function nextAudit(
  data: EnvelopeData,
  entry: {
    action: AuditAction
    outcome: 'committed' | 'rejected'
    targetKind: AuditTargetKind
    targetId: string
    targetName: string
    actor: string
    detail: string
    reason: string
  },
): void {
  const seq = data.audit.reduce((max, item) => Math.max(max, item.seq), 0) + 1
  data.audit.push({ seq, at: now(), ...entry })
  if (data.audit.length > auditLimit) data.audit.splice(0, data.audit.length - auditLimit)
}

function storageFull(cause: unknown): boolean {
  // QuotaExceededError 在不同浏览器里可能是 code 22 或 name 1014。
  return (
    (cause instanceof DOMException &&
      (cause.name === 'QuotaExceededError' ||
        cause.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        cause.code === 22 ||
        cause.code === 1014)) ||
    (cause instanceof Error && /quota|storage|空间/i.test(cause.message))
  )
}

/**
 * 写入数据并在空间不足时按“业务数据优先、日志从旧到新舍弃”的顺序降级重试：
 * 1. 先尝试完整写入（业务变更 + 全部审计）；
 * 2. 空间不足时反复丢弃最旧的一半审计后重试，新条目（含本次动作）最晚被舍弃；
 * 3. 只剩本次新条目仍放不下时，清空审计再试一次以保住业务变更。
 *
 * 每一次重试写入的仍是同键的一个完整状态，因此审计保留部分的相对顺序
 * 始终等于锁提交顺序，跨标签页不会颠倒。返回实际写入的数据；彻底失败时抛出
 * 统一的保存失败提示。
 */
function writeWithAuditDegradation(data: EnvelopeData): EnvelopeData {
  // 写回前先自检：损坏内容（含日志）不会进入存储。
  decode(JSON.stringify(data))
  const attempt = (candidate: EnvelopeData): boolean => {
    try {
      localStorage.setItem(persistenceKey, JSON.stringify(candidate))
      return true
    } catch (cause) {
      if (!storageFull(cause)) throw new Error(quotaFailure)
      return false
    }
  }
  const working = data
  while (true) {
    if (attempt(working)) return working
    if (working.audit.length === 0) throw new Error(quotaFailure)
    if (working.audit.length === 1) {
      // 只剩本次新条目仍放不下：先清空日志保住业务变更；再失败则整体失败。
      const businessOnly = clone(working)
      businessOnly.audit = []
      if (attempt(businessOnly)) return businessOnly
      throw new Error(quotaFailure)
    }
    // 截断最旧的一半，至少丢弃一条；新条目始终留在数组末尾。
    const drop = Math.max(1, Math.floor(working.audit.length / 2))
    working.audit.splice(0, drop)
  }
}

/**
 * 只记录一次被拒绝的尝试（校验失败、跨标签页冲突等），不修改业务数据。
 * 仍在同一互斥锁内追加，保证拒绝与成功动作共享同一条全局时间线。
 * 仅审计写入不更换修订标识，不影响其他标签页的并发保存校验。
 * 容量不足时从最旧日志开始舍弃；审计最终也写不进去时静默放弃，
 * 绝不干扰原有操作反馈。
 */
export async function recordRejection(intent: AuditIntent, reason: string): Promise<void> {
  if (!navigator.locks) return
  const actor = currentActor()
  try {
    await navigator.locks.request(persistenceKey, () => {
      const latest = readData()
      nextAudit(latest, {
        action: intent.action,
        outcome: 'rejected',
        targetKind: intent.targetKind,
        targetId: intent.targetId,
        targetName: intent.targetName,
        actor,
        detail: '',
        reason,
      })
      // 不变更 stamp：其他标签页不会因此被迫重新加载。
      writeWithAuditDegradation(latest)
    })
  } catch {
    // 审计写入失败不能影响原操作流程与提示。
  }
}

/**
 * 原子提交一次业务变更并追加成功审计。
 * 锁内核对修订标识；冲突或变更函数抛错时，同样在锁序列内追加“已拒绝”条目后
 * 把原始错误抛回给调用方，业务数据绝不部分写入。
 * 成功提交若遭遇存储容量上限，会优先保住业务变更、从最旧日志起截断重试；
 * 仍失败时沿用原有保存失败提示。
 */
export async function commitData(
  expectedStamp: string,
  change: (data: EnvelopeData) => void,
  intent: AuditIntent,
): Promise<EnvelopeData> {
  if (!navigator.locks) {
    throw new Error('当前浏览器无法提供安全写入，请使用新版浏览器并通过本机地址或安全连接访问。')
  }
  const actor = currentActor()
  return navigator.locks.request(persistenceKey, () => {
    const latest = readData()
    const reject = (reason: string): never => {
      nextAudit(latest, {
        action: intent.action,
        outcome: 'rejected',
        targetKind: intent.targetKind,
        targetId: intent.targetId,
        targetName: intent.targetName,
        actor,
        detail: '',
        reason,
      })
      // 拒绝只写日志：保持 stamp 不变，避免无谓的跨标签页重新加载提示。
      writeWithAuditDegradation(latest)
      throw new Error(reason)
    }
    if (latest.stamp !== expectedStamp) {
      return reject('另一标签页已修改设计。请重新加载保存版本，再重试本次修改。')
    }
    const candidate = clone(latest)
    try {
      change(candidate)
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : '操作未通过校验，已拒绝。'
      return reject(reason)
    }
    candidate.stamp = newId('revision')
    nextAudit(candidate, {
      action: intent.action,
      outcome: 'committed',
      targetKind: intent.targetKind,
      targetId: intent.targetId,
      targetName: intent.targetName,
      actor,
      detail: intent.detail ?? '',
      reason: '',
    })
    // 业务变更优先：容量不够时从最旧日志开始舍弃，新条目最后才丢弃；
    // 极端情况下允许只保住业务变更。返回实际写入的状态供内存同步。
    return writeWithAuditDegradation(candidate)
  })
}
