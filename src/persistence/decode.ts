import type { EnvelopeData } from './types'
import { validateAssembly } from '../assemblies/validation'
import { validateMaterial } from '../materials/validation'
import { validateBasis } from '../thermal/validation'
import { defaultSurfaceResistance } from '../thermal/types'
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
    // 早期版本没有热工计算口径，缺省时按空列表迁移，构造继续采用默认算法。
    if (parsed.bases === undefined) parsed.bases = []
    if (
      !Array.isArray(parsed.assemblies) ||
      !Array.isArray(parsed.materials) ||
      !Array.isArray(parsed.bases) ||
      !Array.isArray(parsed.documents)
    ) {
      throw new Error('存储结构不完整。')
    }
    const data = parsed as unknown as EnvelopeData
    if (
      data.assemblies.length > 200 ||
      data.materials.length > 500 ||
      data.bases.length > 100 ||
      data.documents.length > 1000
    ) {
      throw new Error('存储条目超出当前版本容量。')
    }
    // 早期构造与计算书没有口径记录，迁移为未选择口径并补记默认表面热阻设置。
    for (const assembly of data.assemblies) {
      assembly.thermalBasisId ??= null
    }
    for (const document of data.documents) {
      document.assembly.thermalBasisId ??= null
      document.thermalBasis ??= null
      if (!document.result.surface) {
        document.result.surface = { ...defaultSurfaceResistance, basisName: null }
      }
    }
    assertUnique(data.assemblies, '构造')
    assertUnique(data.materials, '材料')
    assertUnique(data.bases, '热工计算口径')
    assertUnique(data.documents, '计算书')
    for (const material of data.materials) {
      if (typeof material.custom !== 'boolean' || validateMaterial(material).length) {
        throw new Error('材料参数无效。')
      }
    }
    for (const basis of data.bases) {
      if (validateBasis(basis).length) throw new Error('热工计算口径参数无效。')
    }
    for (const assembly of data.assemblies) {
      if (!['editing', 'finalized'].includes(assembly.state)) throw new Error('构造状态无效。')
      if (!Number.isInteger(assembly.revision) || assembly.revision < 1)
        throw new Error('修订号无效。')
      if (!Number.isFinite(Date.parse(assembly.updatedAt))) throw new Error('构造时间无效。')
      if (validateAssembly(assembly, data.materials, data.bases).length)
        throw new Error('构造参数无效。')
    }
    for (const document of data.documents) {
      if (document.assemblyId !== document.assembly.id || document.assembly.state !== 'finalized') {
        throw new Error('计算书与冻结构造不一致。')
      }
      if (!Number.isFinite(Date.parse(document.createdAt))) throw new Error('计算书时间无效。')
      const basisId = document.assembly.thermalBasisId
      if (
        basisId === null ? document.thermalBasis !== null : document.thermalBasis?.id !== basisId
      ) {
        throw new Error('计算书口径与冻结构造不一致。')
      }
      if (document.thermalBasis && validateBasis(document.thermalBasis).length) {
        throw new Error('计算书口径参数无效。')
      }
      if (
        JSON.stringify(
          calculate(
            document.assembly,
            document.materials,
            document.thermalBasis ? [document.thermalBasis] : [],
          ),
        ) !== JSON.stringify(document.result)
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
