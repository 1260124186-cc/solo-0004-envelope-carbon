import type { EnvelopeData } from './types'
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
    // 比较记录为后增字段：兼容没有该字段的已保存设计，按空集合处理。
    if (parsed.comparisons !== undefined && !Array.isArray(parsed.comparisons)) {
      throw new Error('存储结构不完整。')
    }
    const data = parsed as unknown as EnvelopeData
    data.comparisons ??= []
    if (
      data.assemblies.length > 200 ||
      data.materials.length > 500 ||
      data.documents.length > 1000 ||
      data.comparisons.length > 1000
    ) {
      throw new Error('存储条目超出当前版本容量。')
    }
    assertUnique(data.assemblies, '构造')
    assertUnique(data.materials, '材料')
    assertUnique(data.documents, '计算书')
    assertUnique(data.comparisons, '比较记录')
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
    for (const comparison of data.comparisons) {
      if (
        typeof comparison.id !== 'string' ||
        !comparison.id ||
        typeof comparison.createdAt !== 'string' ||
        !comparison.baseline ||
        !comparison.alternative
      ) {
        throw new Error('比较记录结构不完整。')
      }
      if (!Number.isFinite(Date.parse(comparison.createdAt))) throw new Error('比较记录时间无效。')
      for (const side of [comparison.baseline, comparison.alternative]) {
        if (validateAssembly(side.assembly, side.materials).length) {
          throw new Error('比较记录的冻结构造无效。')
        }
        if (
          JSON.stringify(calculate(side.assembly, side.materials)) !== JSON.stringify(side.result)
        ) {
          throw new Error('比较记录结果与冻结输入不一致。')
        }
      }
      const a = comparison.baseline
      const b = comparison.alternative
      if (a.assembly.id === b.assembly.id) throw new Error('比较记录的两个构造相同。')
      if (
        a.assembly.surface !== b.assembly.surface ||
        a.assembly.area !== b.assembly.area ||
        a.assembly.years !== b.assembly.years
      ) {
        throw new Error('比较记录的比较口径不一致。')
      }
      const expectedPercent =
        a.result.intensity === 0
          ? null
          : ((b.result.intensity - a.result.intensity) / a.result.intensity) * 100
      if (
        comparison.carbonDelta !== b.result.intensity - a.result.intensity ||
        comparison.wholeDelta !== b.result.whole - a.result.whole ||
        comparison.thermalDelta !== b.result.transmittance - a.result.transmittance ||
        comparison.percent !== expectedPercent
      ) {
        throw new Error('比较记录差值与冻结结果不一致。')
      }
    }
    return data
  } catch (error) {
    const detail = error instanceof Error ? error.message : '未知结构错误'
    throw new Error(`无法读取已保存的设计：${detail} 原数据未被覆盖。`)
  }
}
