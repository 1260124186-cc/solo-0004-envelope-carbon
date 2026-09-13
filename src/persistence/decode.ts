import type { EnvelopeData } from './types'
import { validateAssembly } from '../assemblies/validation'
import { validateMaterial } from '../materials/validation'
import { calculate } from '../carbon/engine'
import { auditLimit, isAuditAction, isAuditOutcome, type AuditEntry } from '../audit/audit'

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertUnique(items: { id: string }[], label: string): void {
  const ids = new Set<string>()
  for (const item of items) {
    if (typeof item.id !== 'string' || !item.id || ids.has(item.id)) {
      throw new Error(`${label}标识缺失或重复。`)
    }
    ids.add(item.id)
  }
}

function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max
}

/**
 * 审计日志只追加、且不允许阻断历史设计读取：
 * 缺失字段按空日志处理，单条结构异常则丢弃该条，超出容量只保留最新条目。
 */
function sanitizeAudit(value: unknown): AuditEntry[] {
  if (!Array.isArray(value)) return []
  const entries: AuditEntry[] = []
  for (const item of value) {
    if (!object(item)) continue
    if (
      !Number.isInteger(item.seq) ||
      (item.seq as number) < 1 ||
      !text(item.at, 40) ||
      !Number.isFinite(Date.parse(item.at as string)) ||
      !isAuditAction(item.action) ||
      !isAuditOutcome(item.outcome) ||
      !['assembly', 'material', 'comparison'].includes(item.targetKind as string) ||
      !text(item.targetId, 120) ||
      !text(item.targetName, 120) ||
      !text(item.actor, 80) ||
      !text(item.detail, 300) ||
      !text(item.reason, 300)
    ) {
      continue
    }
    entries.push({
      seq: item.seq as number,
      at: item.at,
      action: item.action,
      outcome: item.outcome,
      targetKind: item.targetKind as AuditEntry['targetKind'],
      targetId: item.targetId,
      targetName: item.targetName,
      actor: item.actor,
      detail: item.detail,
      reason: item.reason,
    })
  }
  return entries.length > auditLimit ? entries.slice(entries.length - auditLimit) : entries
}

export function decode(raw: string): EnvelopeData {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!object(parsed) || parsed.schema !== 1 || typeof parsed.stamp !== 'string') {
      throw new Error('存储版本不受支持。')
    }
    if (
      !Array.isArray(parsed.assemblies) ||
      !Array.isArray(parsed.materials) ||
      !Array.isArray(parsed.documents)
    ) {
      throw new Error('存储结构不完整。')
    }
    const data = parsed as unknown as EnvelopeData
    if (
      data.assemblies.length > 200 ||
      data.materials.length > 500 ||
      data.documents.length > 1000
    ) {
      throw new Error('存储条目超出当前版本容量。')
    }
    data.audit = sanitizeAudit(parsed.audit)
    assertUnique(data.assemblies, '构造')
    assertUnique(data.materials, '材料')
    assertUnique(data.documents, '计算书')
    for (const material of data.materials) {
      if (typeof material.custom !== 'boolean' || validateMaterial(material).length) {
        throw new Error('材料参数无效。')
      }
    }
    for (const assembly of data.assemblies) {
      if (!['editing', 'finalized'].includes(assembly.state)) throw new Error('构造状态无效。')
      if (!Number.isInteger(assembly.revision) || assembly.revision < 1)
        throw new Error('修订号无效。')
      if (!Number.isFinite(Date.parse(assembly.updatedAt))) throw new Error('构造时间无效。')
      if (validateAssembly(assembly, data.materials).length) throw new Error('构造参数无效。')
    }
    for (const document of data.documents) {
      if (document.assemblyId !== document.assembly.id || document.assembly.state !== 'finalized') {
        throw new Error('计算书与冻结构造不一致。')
      }
      if (!Number.isFinite(Date.parse(document.createdAt))) throw new Error('计算书时间无效。')
      if (
        JSON.stringify(calculate(document.assembly, document.materials)) !==
        JSON.stringify(document.result)
      ) {
        throw new Error('计算书结果与冻结输入不一致。')
      }
    }
    return data
  } catch (error) {
    const detail = error instanceof Error ? error.message : '未知结构错误'
    throw new Error(`无法读取已保存的设计：${detail} 原数据未被覆盖。`)
  }
}
