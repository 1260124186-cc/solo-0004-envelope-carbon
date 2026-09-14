import type { EnvelopeData } from './types'
import type { Assembly, RevisionEntry } from '../assemblies/types'
import { revisionKindLabels } from '../assemblies/types'
import { validateAssembly } from '../assemblies/validation'
import { validateMaterial } from '../materials/validation'
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

/**
 * 归一化新增的修订记录字段。旧版本保存的数据没有 revisions，
 * 这里补成空数组而不是拒绝读取，确保旧设计照常打开。
 */
function normalizeRevisions(value: unknown): RevisionEntry[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error('修订记录格式无效。')
  const kinds = Object.keys(revisionKindLabels)
  return value.map((rawItem) => {
    if (!object(rawItem)) throw new Error('修订记录格式无效。')
    const item = rawItem as Record<string, unknown>
    const revision = item.revision
    if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 1)
      throw new Error('修订记录的修订号无效。')
    if (typeof item.kind !== 'string' || !kinds.includes(item.kind))
      throw new Error('修订记录的类型无效。')
    if (typeof item.note !== 'string' || item.note.length > 200) throw new Error('修订备注无效。')
    if (typeof item.at !== 'string' || !Number.isFinite(Date.parse(item.at)))
      throw new Error('修订记录时间无效。')
    return item as unknown as RevisionEntry
  })
}

function normalizeAssembly(value: unknown): Assembly {
  if (!object(value)) throw new Error('构造格式无效。')
  value.revisions = normalizeRevisions(value.revisions)
  return value as unknown as Assembly
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
    assertUnique(data.assemblies, '构造')
    assertUnique(data.materials, '材料')
    assertUnique(data.documents, '计算书')
    for (const material of data.materials) {
      if (typeof material.custom !== 'boolean' || validateMaterial(material).length) {
        throw new Error('材料参数无效。')
      }
    }
    for (const rawAssembly of data.assemblies) {
      const assembly = normalizeAssembly(rawAssembly)
      if (assembly.revisions.length > 500) throw new Error('修订记录超出容量。')
      if (!['editing', 'finalized'].includes(assembly.state)) throw new Error('构造状态无效。')
      if (!Number.isInteger(assembly.revision) || assembly.revision < 1)
        throw new Error('修订号无效。')
      if (!Number.isFinite(Date.parse(assembly.updatedAt))) throw new Error('构造时间无效。')
      if (validateAssembly(assembly, data.materials).length) throw new Error('构造参数无效。')
    }
    for (const document of data.documents) {
      // 旧版计算书没有冻结备注字段，归一化为空字符串，不影响历史记录读取。
      if (document.note === undefined) document.note = ''
      if (typeof document.note !== 'string' || document.note.length > 200)
        throw new Error('计算书备注无效。')
      normalizeAssembly(document.assembly)
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
