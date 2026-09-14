import type { EnvelopeData } from './types'
import type { PhaseSnapshot } from '../snapshots/types'
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
    const snapshots: unknown = 'snapshots' in parsed ? parsed.snapshots : []
    if (!Array.isArray(snapshots)) {
      throw new Error('存储结构不完整。')
    }
    const data = parsed as unknown as EnvelopeData
    data.snapshots = snapshots as PhaseSnapshot[]
    if (
      data.assemblies.length > 200 ||
      data.materials.length > 500 ||
      data.documents.length > 1000 ||
      data.snapshots.length > 50
    ) {
      throw new Error('存储条目超出当前版本容量。')
    }
    assertUnique(data.assemblies, '构造')
    assertUnique(data.materials, '材料')
    assertUnique(data.documents, '计算书')
    assertUnique(data.snapshots, '阶段快照')
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
    for (const snapshot of data.snapshots) {
      if (typeof snapshot.name !== 'string' || !snapshot.name.trim() || snapshot.name.length > 50) {
        throw new Error('阶段快照名称无效。')
      }
      if (typeof snapshot.note !== 'string' || snapshot.note.length > 500) {
        throw new Error('阶段快照说明无效。')
      }
      if (!Number.isFinite(Date.parse(snapshot.createdAt))) throw new Error('阶段快照时间无效。')
      if (
        !Array.isArray(snapshot.entries) ||
        !snapshot.entries.length ||
        snapshot.entries.length > 100
      ) {
        throw new Error('阶段快照内容无效。')
      }
      const seen = new Set<string>()
      for (const entry of snapshot.entries) {
        if (!object(entry) || typeof entry.assemblyId !== 'string' || seen.has(entry.assemblyId)) {
          throw new Error('阶段快照构造标识缺失或重复。')
        }
        seen.add(entry.assemblyId)
        if (!object(entry.assembly) || entry.assembly.id !== entry.assemblyId) {
          throw new Error('阶段快照与构造记录不一致。')
        }
        if (entry.assemblyRevision !== entry.assembly.revision) {
          throw new Error('阶段快照修订记录不一致。')
        }
        if (!['editing', 'finalized'].includes(entry.assembly.state)) {
          throw new Error('阶段快照构造状态无效。')
        }
        if (!Number.isInteger(entry.assembly.revision) || entry.assembly.revision < 1) {
          throw new Error('阶段快照修订号无效。')
        }
        if (!Number.isFinite(Date.parse(entry.assembly.updatedAt))) {
          throw new Error('阶段快照构造时间无效。')
        }
        if (!Array.isArray(entry.materials)) throw new Error('阶段快照物性记录无效。')
        assertUnique(entry.materials, '快照材料')
        for (const material of entry.materials) {
          if (typeof material.custom !== 'boolean' || validateMaterial(material).length) {
            throw new Error('阶段快照物性参数无效。')
          }
        }
        if (validateAssembly(entry.assembly, entry.materials).length) {
          throw new Error('阶段快照构造记录无效。')
        }
      }
    }
    return data
  } catch (error) {
    const detail = error instanceof Error ? error.message : '未知结构错误'
    throw new Error(`无法读取已保存的设计：${detail} 原数据未被覆盖。`)
  }
}
