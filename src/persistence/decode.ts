import type { EnvelopeData } from './types'
import { validateAssembly } from '../assemblies/validation'
import { validateMaterial } from '../materials/validation'
import { confirmFindings, validateDecision } from '../decisions/validation'
import { calculate } from '../carbon/engine'

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
    // 决策记录为后增模块，旧版本存储中没有该字段，按空表迁移。
    const storedDecisions: unknown = parsed.decisions === undefined ? [] : parsed.decisions
    if (!Array.isArray(storedDecisions)) throw new Error('存储结构不完整。')
    const data = { ...parsed, decisions: storedDecisions } as unknown as EnvelopeData
    if (
      data.assemblies.length > 200 ||
      data.materials.length > 500 ||
      data.documents.length > 1000 ||
      data.decisions.length > 200
    ) {
      throw new Error('存储条目超出当前版本容量。')
    }
    assertUnique(data.assemblies, '构造')
    assertUnique(data.materials, '材料')
    assertUnique(data.documents, '计算书')
    assertUnique(data.decisions, '决策记录')
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
    const revisions = new Set<string>()
    for (const decision of data.decisions) {
      if (!['draft', 'confirmed'].includes(decision.state)) throw new Error('决策状态无效。')
      if (typeof decision.groupId !== 'string' || !decision.groupId) {
        throw new Error('决策分组无效。')
      }
      if (!Number.isInteger(decision.revision) || decision.revision < 1) {
        throw new Error('决策修订号无效。')
      }
      const key = `${decision.groupId}:${decision.revision}`
      if (revisions.has(key)) throw new Error('决策修订号重复。')
      revisions.add(key)
      if (
        !Number.isFinite(Date.parse(decision.createdAt)) ||
        !Number.isFinite(Date.parse(decision.updatedAt))
      ) {
        throw new Error('决策时间无效。')
      }
      if (decision.state === 'confirmed' && !Number.isFinite(Date.parse(decision.confirmedAt))) {
        throw new Error('决策确认时间无效。')
      }
      if (decision.state === 'draft' && decision.confirmedAt !== '') {
        throw new Error('决策确认时间无效。')
      }
      if (!Array.isArray(decision.options)) throw new Error('决策引用无效。')
      const problems =
        decision.state === 'confirmed'
          ? confirmFindings(decision, data.documents)
          : validateDecision(decision, data.documents)
      if (problems.length) throw new Error('决策记录内容无效。')
    }
    return data
  } catch (error) {
    const detail = error instanceof Error ? error.message : '未知结构错误'
    throw new Error(`无法读取已保存的设计：${detail} 原数据未被覆盖。`)
  }
}
