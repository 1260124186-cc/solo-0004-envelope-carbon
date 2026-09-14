import type { EnvelopeData } from './types'
import { validateAssembly } from '../assemblies/validation'
import { validateMaterial } from '../materials/validation'
import { calculate } from '../carbon/engine'
import { evaluateLegacy, evaluateRule } from '../compliance/engine'
import { normalizeConditions, validateComplianceRule } from '../compliance/validation'
import { seedRules } from '../compliance/seed'
import type { ComplianceRule } from '../compliance/types'
import { clone } from '../shared/identity'

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

/** 规则内容严格校验；历史版本没有 rules 字段时补入内置示例规则（不改动任何既有数值）。 */
function decodeRules(raw: unknown): ComplianceRule[] {
  if (raw === undefined) return seedRules()
  if (!Array.isArray(raw)) throw new Error('达标规则结构不完整。')
  if (raw.length > 100) throw new Error('达标规则超出当前版本容量。')
  return raw.map((entry, index) => {
    if (!object(entry)) throw new Error(`第 ${index + 1} 条达标规则结构无效。`)
    const rule: ComplianceRule = {
      id: String(entry.id ?? ''),
      name: String(entry.name ?? ''),
      description: typeof entry.description === 'string' ? entry.description : '',
      conditions: normalizeConditions(entry.conditions),
      active: entry.active !== false,
      builtIn: entry.builtIn === true,
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
      updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '',
    }
    if (validateComplianceRule(rule).length) throw new Error(`第 ${index + 1} 条达标规则内容无效。`)
    if (
      !Number.isFinite(Date.parse(rule.createdAt)) ||
      !Number.isFinite(Date.parse(rule.updatedAt))
    ) {
      throw new Error(`第 ${index + 1} 条达标规则时间无效。`)
    }
    return rule
  })
}

/** 旧版本构造没有 ruleId 字段，补空串后继续走原字段判定，不改动其它任何值。 */
function migrateAssembly(raw: Record<string, unknown>): void {
  if (typeof raw.ruleId !== 'string') raw.ruleId = ''
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
    const rules = decodeRules(parsed.rules)
    const data = parsed as unknown as EnvelopeData
    data.rules = rules
    if (
      data.assemblies.length > 200 ||
      data.materials.length > 500 ||
      data.documents.length > 1000
    ) {
      throw new Error('存储条目超出当前版本容量。')
    }
    assertUnique(data.assemblies, '构造')
    assertUnique(data.materials, '材料')
    assertUnique(data.documents, '计算书')
    assertUnique(data.rules, '达标规则')
    const ruleById = new Map(data.rules.map((rule) => [rule.id, rule]))
    for (const material of data.materials) {
      if (typeof material.custom !== 'boolean' || validateMaterial(material).length) {
        throw new Error('材料参数无效。')
      }
    }
    for (const assembly of data.assemblies) {
      migrateAssembly(assembly as unknown as Record<string, unknown>)
      if (!['editing', 'finalized'].includes(assembly.state)) throw new Error('构造状态无效。')
      if (!Number.isInteger(assembly.revision) || assembly.revision < 1)
        throw new Error('修订号无效。')
      if (!Number.isFinite(Date.parse(assembly.updatedAt))) throw new Error('构造时间无效。')
      if (validateAssembly(assembly, data.materials).length) throw new Error('构造参数无效。')
      if (assembly.ruleId && !ruleById.has(assembly.ruleId)) {
        throw new Error('构造引用的达标规则不存在。')
      }
    }
    for (const document of data.documents) {
      if (document.assemblyId !== document.assembly.id || document.assembly.state !== 'finalized') {
        throw new Error('计算书与冻结构造不一致。')
      }
      if (!Number.isFinite(Date.parse(document.createdAt))) throw new Error('计算书时间无效。')
      const expected = calculate(document.assembly, document.materials)
      if (JSON.stringify(expected) !== JSON.stringify(document.result)) {
        throw new Error('计算书结果与冻结输入不一致。')
      }
      // 历史计算书（规则功能上线前生成）没有判定快照，用冻结输入重建，保证判定依据仍可显示。
      if (document.compliance === undefined) {
        document.ruleId = typeof document.ruleId === 'string' ? document.ruleId : ''
        document.rule = document.rule ?? null
        document.compliance = clone(evaluateLegacy(document.assembly, expected))
      }
      const expectedCompliance =
        document.ruleId && document.rule
          ? evaluateRule(document.rule, expected)
          : evaluateLegacy(document.assembly, expected)
      if (JSON.stringify(expectedCompliance) !== JSON.stringify(document.compliance)) {
        throw new Error('计算书达标判定与冻结口径不一致。')
      }
      if (document.ruleId && (!document.rule || document.rule.id !== document.ruleId)) {
        throw new Error('计算书缺少规则快照。')
      }
    }
    return data
  } catch (error) {
    const detail = error instanceof Error ? error.message : '未知结构错误'
    throw new Error(`无法读取已保存的设计：${detail} 原数据未被覆盖。`)
  }
}
