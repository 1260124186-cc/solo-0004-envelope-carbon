import type { EnvelopeData } from './types'
import { calculate } from '../carbon/engine'
import { DOCUMENT_CAPACITY } from '../documents/preview'

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

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function hasLayerShape(layer: unknown): boolean {
  return (
    object(layer) &&
    isString(layer.id) &&
    isString(layer.materialId) &&
    isFiniteNumber(layer.thickness) &&
    isFiniteNumber(layer.loss) &&
    isFiniteNumber(layer.lifespan)
  )
}

function hasMaterialShape(material: unknown): boolean {
  if (!object(material)) return false
  return (
    isString(material.id) &&
    isString(material.name) &&
    isString(material.kind) &&
    isString(material.source) &&
    isString(material.description) &&
    typeof material.custom === 'boolean' &&
    isFiniteNumber(material.density) &&
    isFiniteNumber(material.conductivity) &&
    isFiniteNumber(material.factor) &&
    isFiniteNumber(material.lifespan)
  )
}

function hasAssemblyShape(assembly: unknown): boolean {
  if (!object(assembly)) return false
  return (
    isString(assembly.id) &&
    isString(assembly.name) &&
    isString(assembly.surface) &&
    isString(assembly.note) &&
    isString(assembly.updatedAt) &&
    isFiniteNumber(assembly.area) &&
    isFiniteNumber(assembly.years) &&
    isFiniteNumber(assembly.carbonLimit) &&
    isFiniteNumber(assembly.thermalLimit) &&
    Number.isInteger(assembly.revision) &&
    (assembly.state === 'editing' || assembly.state === 'finalized') &&
    Array.isArray(assembly.layers) &&
    assembly.layers.every(hasLayerShape)
  )
}

function hasDocumentShape(document: unknown): boolean {
  if (!object(document)) return false
  return (
    isString(document.id) &&
    isString(document.assemblyId) &&
    isString(document.createdAt) &&
    hasAssemblyShape(document.assembly) &&
    Array.isArray(document.materials) &&
    document.materials.every(hasMaterialShape) &&
    object(document.result) &&
    Array.isArray(document.result.layers)
  )
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
      data.documents.length > DOCUMENT_CAPACITY
    ) {
      throw new Error('存储条目超出当前版本容量。')
    }
    assertUnique(data.assemblies, '构造')
    assertUnique(data.materials, '材料')
    assertUnique(data.documents, '计算书')
    for (const material of data.materials) {
      if (!hasMaterialShape(material)) {
        throw new Error('材料结构不完整。')
      }
    }
    for (const assembly of data.assemblies) {
      if (!hasAssemblyShape(assembly)) throw new Error('构造结构不完整。')
      if (!Number.isFinite(Date.parse(assembly.updatedAt))) throw new Error('构造时间无效。')
    }
    for (const document of data.documents) {
      if (!hasDocumentShape(document)) throw new Error('计算书结构不完整。')
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
