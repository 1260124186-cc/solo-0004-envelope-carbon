import type { EnvelopeData } from './types'
import { validateAssembly } from '../assemblies/validation'
import { validateMaterial } from '../materials/validation'
import { calculate } from '../carbon/engine'
import { verifyRun } from '../sensitivity/sweep'

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
    // 早期版本没有分析记录集合，缺省为空数组
    const analyses = Array.isArray(parsed.analyses) ? parsed.analyses : []
    const data = { ...(parsed as unknown as EnvelopeData), analyses } as EnvelopeData
    if (
      data.assemblies.length > 200 ||
      data.materials.length > 500 ||
      data.documents.length > 1000 ||
      data.analyses.length > 100
    ) {
      throw new Error('存储条目超出当前版本容量。')
    }
    assertUnique(data.assemblies, '构造')
    assertUnique(data.materials, '材料')
    assertUnique(data.documents, '计算书')
    assertUnique(data.analyses, '分析')
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
    for (const run of data.analyses) {
      if (run.assemblyId !== run.assembly.id) throw new Error('分析记录与冻结构造不一致。')
      if (!['editing', 'finalized'].includes(run.assembly.state)) {
        throw new Error('分析记录的构造状态无效。')
      }
      if (!Number.isFinite(Date.parse(run.createdAt))) throw new Error('分析记录时间无效。')
      if (validateAssembly(run.assembly, run.materials).length) {
        throw new Error('分析记录的构造参数无效。')
      }
      for (const material of run.materials) {
        if (typeof material.custom !== 'boolean' || validateMaterial(material).length) {
          throw new Error('分析记录的材料参数无效。')
        }
      }
      if (!verifyRun(run)) throw new Error('分析记录结果与冻结输入不一致。')
    }
    return data
  } catch (error) {
    const detail = error instanceof Error ? error.message : '未知结构错误'
    throw new Error(`无法读取已保存的设计：${detail} 原数据未被覆盖。`)
  }
}
