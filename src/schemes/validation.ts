import type { EnvelopeScheme, SchemeEntry } from './types'
import type { Finding } from '../assemblies/types'
import { inRange, validateAssembly } from '../assemblies/validation'
import { validateMaterial } from '../materials/validation'
import { assemblyChecksum } from './factory'

/** 组合编辑态校验：用于即时反馈与阻止保存 */
export function validateScheme(scheme: EnvelopeScheme): Finding[] {
  const findings: Finding[] = []
  const add = (path: string, text: string) => findings.push({ path, text })
  if (!scheme.name.trim() || scheme.name.length > 50) {
    add('name', '组合名称需为 1 至 50 个字符。')
  }
  if (scheme.note.length > 1000) add('note', '组合说明最多 1,000 个字符。')
  if (!scheme.entries.length) add('entries', '请至少加入一个已保存构造。')
  if (scheme.entries.length > 50) add('entries', '单个组合最多包含 50 个部位。')
  const entryIds = new Set<string>()
  scheme.entries.forEach((entry, index) => {
    const prefix = `第 ${index + 1} 个部位`
    if (entryIds.has(entry.id)) add(`entries.${entry.id}`, `${prefix}标识重复。`)
    entryIds.add(entry.id)
    if (!inRange(entry.area, 0.1, 1000000)) {
      add(`entries.${entry.id}.area`, `${prefix}的组合面积需在 0.1 至 1,000,000 平方米之间。`)
    }
    if (entry.checksum !== assemblyChecksum(entry.snapshot)) {
      add(`entries.${entry.id}`, `${prefix}的冻结快照已损坏。`)
    }
  })
  return findings
}

/** 存储解码用的严格校验：快照与冻结材料必须能独立重算 */
export function validateStoredEntry(entry: SchemeEntry): string[] {
  const errors: string[] = []
  if (typeof entry.id !== 'string' || !entry.id) errors.push('部位标识缺失。')
  if (typeof entry.assemblyId !== 'string' || !entry.assemblyId) errors.push('构造标识缺失。')
  if (!inRange(entry.area, 0.1, 1000000)) errors.push('部位面积越界。')
  if (!Number.isInteger(entry.revision) || entry.revision < 1) errors.push('引用修订号无效。')
  if (typeof entry.name !== 'string' || !entry.name) errors.push('部位名称缺失。')
  if (entry.checksum !== assemblyChecksum(entry.snapshot)) errors.push('冻结快照校验值不一致。')
  const materialErrors = entry.materials.flatMap((material) => validateMaterial(material))
  if (materialErrors.length) errors.push('冻结材料参数无效。')
  const used = new Set(entry.snapshot.layers.map((layer) => layer.materialId))
  const frozenIds = new Set(entry.materials.map((material) => material.id))
  for (const materialId of used) {
    if (!frozenIds.has(materialId)) errors.push('冻结材料与构造层不一致。')
  }
  if (validateAssembly(entry.snapshot, entry.materials).length) {
    errors.push('冻结构造无法重新计算。')
  }
  return errors
}
