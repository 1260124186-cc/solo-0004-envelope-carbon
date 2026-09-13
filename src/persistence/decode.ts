import type { EnvelopeData } from './types'
import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { CarbonDocument } from '../documents/types'
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

const migratedCreatedAt = '2026-01-01T00:00:00.000Z'

// 版本化之前的材料把物性直接放在材料上；迁移为唯一的版本 1，物性原值保留。
function migrateMaterial(material: Material): Material {
  const legacy = material as unknown as Record<string, unknown>
  if (Array.isArray(legacy.revisions)) return material
  return {
    id: material.id,
    name: material.name,
    kind: material.kind,
    description: material.description,
    custom: material.custom,
    revisions: [
      {
        revision: 1,
        density: legacy.density,
        conductivity: legacy.conductivity,
        factor: legacy.factor,
        lifespan: legacy.lifespan,
        source: legacy.source,
        note: '初始版本',
        createdAt: migratedCreatedAt,
      } as Material['revisions'][number],
    ],
  }
}

// 版本化之前的构造层没有版本引用；迁移为引用所属材料的版本 1。
function migrateAssembly(assembly: Assembly): Assembly {
  return {
    ...assembly,
    layers: assembly.layers.map((layer) =>
      Number.isInteger(layer.materialRevision) ? layer : { ...layer, materialRevision: 1 },
    ),
  }
}

function migrateDocument(document: CarbonDocument): CarbonDocument {
  return {
    ...document,
    assembly: migrateAssembly(document.assembly),
    materials: document.materials.map(migrateMaterial),
  }
}

function migrate(parsed: Record<string, unknown>): EnvelopeData {
  const data = parsed as unknown as EnvelopeData
  return {
    schema: 2,
    stamp: data.stamp,
    assemblies: data.assemblies.map(migrateAssembly),
    materials: data.materials.map(migrateMaterial),
    documents: data.documents.map(migrateDocument),
  }
}

export function decode(raw: string): EnvelopeData {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!object(parsed) || typeof parsed.stamp !== 'string') {
      throw new Error('存储版本不受支持。')
    }
    if (parsed.schema !== 1 && parsed.schema !== 2) {
      throw new Error('存储版本不受支持。')
    }
    if (
      !Array.isArray(parsed.assemblies) ||
      !Array.isArray(parsed.materials) ||
      !Array.isArray(parsed.documents)
    ) {
      throw new Error('存储结构不完整。')
    }
    const data = migrate(parsed)
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
