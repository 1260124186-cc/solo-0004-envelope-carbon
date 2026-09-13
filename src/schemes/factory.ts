import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { EnvelopeScheme, SchemeEntry } from './types'
import { clone, newId, now } from '../shared/identity'

/**
 * 构造内容校验值：只随构造内容变化，与组合中的面积、状态展示字段无关。
 * 定稿/重新编辑不改内容时校验值保持一致，仅真正改动才会被识别为引用漂移。
 * 使用 FNV-1a，存储中只保留短十六进制串。
 */
export function assemblyChecksum(assembly: Assembly): string {
  const content = JSON.stringify({
    name: assembly.name,
    surface: assembly.surface,
    area: assembly.area,
    years: assembly.years,
    carbonLimit: assembly.carbonLimit,
    thermalLimit: assembly.thermalLimit,
    note: assembly.note,
    layers: assembly.layers.map((layer) => ({
      materialId: layer.materialId,
      thickness: layer.thickness,
      loss: layer.loss,
      lifespan: layer.lifespan,
    })),
  })
  let hash = 0x811c9dc5
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function createEntry(assembly: Assembly, materials: Material[], area?: number): SchemeEntry {
  const used = new Set(assembly.layers.map((layer) => layer.materialId))
  const snapshot = clone({ ...assembly, state: 'finalized' as const })
  return {
    id: newId('scheme-entry'),
    assemblyId: assembly.id,
    area: area ?? assembly.area,
    revision: assembly.revision,
    name: assembly.name,
    snapshot,
    materials: clone(materials.filter((material) => used.has(material.id))),
    checksum: assemblyChecksum(assembly),
  }
}

export function createScheme(): EnvelopeScheme {
  return {
    id: newId('scheme'),
    name: '未命名围护组合',
    note: '',
    entries: [],
    revision: 0,
    updatedAt: now(),
  }
}
