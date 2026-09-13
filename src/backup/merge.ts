import type { Assembly } from '../assemblies/types'
import { stateLabels, surfaceLabels } from '../assemblies/types'
import type { Material } from '../materials/types'
import { kindLabels as materialKindLabels } from '../materials/types'
import type { CarbonDocument } from '../documents/types'
import type { EnvelopeData } from '../persistence/types'
import { capacityLimits } from '../persistence/types'
import type { ConflictChoices, ConflictItem, MergePlan, MergeReport } from './types'
import { clone, newId } from '../shared/identity'
import { date, number } from '../shared/format'

type Fate = 'add' | 'keep' | 'skip' | 'copy'

interface Fates {
  assemblies: Map<string, Fate>
  materials: Map<string, Fate>
  documents: Map<string, Fate>
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function copyName(name: string, max: number): string {
  const suffix = ' · 导入副本'
  return `${name.slice(0, max - suffix.length)}${suffix}`
}

function assemblyNote(assembly: Assembly): string {
  return `修订 ${assembly.revision} · ${surfaceLabels[assembly.surface]} · ${number(assembly.area)} 平方米 · 更新于 ${date(assembly.updatedAt)}`
}

function materialNote(material: Material): string {
  return `密度 ${number(material.density)} · 碳因子 ${number(material.factor)} · ${material.custom ? '自定义' : '内置示例'}`
}

function documentNote(document: CarbonDocument): string {
  return `定稿于 ${date(document.createdAt)}`
}

function decideFates(
  current: EnvelopeData,
  incoming: EnvelopeData,
  choices: ConflictChoices,
): Fates {
  const decide = <T extends { id: string }>(items: T[], existing: T[]): Map<string, Fate> => {
    const known = new Map(existing.map((item) => [item.id, canonical(item)]))
    const fates = new Map<string, Fate>()
    for (const item of items) {
      const present = known.get(item.id)
      if (present === undefined) fates.set(item.id, 'add')
      else if (present === canonical(item)) fates.set(item.id, 'keep')
      else fates.set(item.id, choices[item.id] ?? 'copy')
    }
    return fates
  }
  return {
    assemblies: decide(incoming.assemblies, current.assemblies),
    materials: decide(incoming.materials, current.materials),
    documents: decide(incoming.documents, current.documents),
  }
}

function documentFate(document: CarbonDocument, fates: Fates): Fate | 'forced' {
  const fate = fates.documents.get(document.id) ?? 'keep'
  if (fate !== 'add' && fate !== 'copy') return fate
  const assembly = fates.assemblies.get(document.assemblyId)
  return assembly === 'skip' || assembly === undefined ? 'forced' : fate
}

function buildReport(current: EnvelopeData, incoming: EnvelopeData, fates: Fates): MergeReport {
  const tally = { add: 0, keep: 0, skip: 0, copy: 0 }
  const count = (fates: Map<string, Fate>) => {
    const result = { ...tally }
    for (const fate of fates.values()) result[fate] += 1
    return result
  }
  const assemblies = count(fates.assemblies)
  const materials = count(fates.materials)
  const documents = { ...tally }
  const forcedDocuments: string[] = []
  for (const document of incoming.documents) {
    const fate = documentFate(document, fates)
    if (fate === 'forced')
      forcedDocuments.push(`${document.assembly.name} · 修订 ${document.assembly.revision}`)
    else documents[fate] += 1
  }
  const warnings: string[] = []
  for (const assembly of incoming.assemblies) {
    const fate = fates.assemblies.get(assembly.id)
    if (fate !== 'add' && fate !== 'copy') continue
    assembly.layers.forEach((layer, index) => {
      if (fates.materials.get(layer.materialId) === 'skip') {
        const material = incoming.materials.find((item) => item.id === layer.materialId)
        warnings.push(
          `构造「${assembly.name}」第 ${index + 1} 层引用的材料「${material?.name ?? layer.materialId}」与现有记录冲突且被跳过，导入后将使用现有材料参数。`,
        )
      }
    })
  }
  const overflow: string[] = []
  const check = (label: string, unit: string, after: number, limit: number) => {
    if (after > limit) {
      overflow.push(
        `恢复后${label}将达到 ${after} ${unit}，超过 ${limit} ${unit}上限。请改为跳过部分冲突记录。`,
      )
    }
  }
  check(
    '构造',
    '个',
    current.assemblies.length + assemblies.add + assemblies.copy,
    capacityLimits.assemblies,
  )
  check(
    '材料',
    '种',
    current.materials.length + materials.add + materials.copy,
    capacityLimits.materials,
  )
  check(
    '计算书',
    '份',
    current.documents.length + documents.add + documents.copy,
    capacityLimits.documents,
  )
  return {
    added: { assemblies: assemblies.add, materials: materials.add, documents: documents.add },
    copied: { assemblies: assemblies.copy, materials: materials.copy, documents: documents.copy },
    skipped: { assemblies: assemblies.skip, materials: materials.skip, documents: documents.skip },
    forcedDocuments,
    warnings,
    overflow,
    changes:
      assemblies.add +
      assemblies.copy +
      materials.add +
      materials.copy +
      documents.add +
      documents.copy,
  }
}

export function planMerge(current: EnvelopeData, incoming: EnvelopeData): MergePlan {
  const additions = {
    assemblies: [] as string[],
    materials: [] as string[],
    documents: [] as string[],
  }
  const conflicts: ConflictItem[] = []
  let keptCount = 0
  const classify = <T extends { id: string }>(
    items: T[],
    existing: T[],
    onAdd: (item: T) => void,
    onConflict: (item: T, present: T) => void,
  ) => {
    const known = new Map(existing.map((item) => [item.id, canonical(item)]))
    for (const item of items) {
      const present = known.get(item.id)
      if (present === undefined) onAdd(item)
      else if (present === canonical(item)) keptCount += 1
      else onConflict(item, existing.find((record) => record.id === item.id)!)
    }
  }
  classify(
    incoming.assemblies,
    current.assemblies,
    (assembly) =>
      additions.assemblies.push(
        `${assembly.name}（${stateLabels[assembly.state]} · ${assembly.layers.length} 层）`,
      ),
    (assembly, present) =>
      conflicts.push({
        id: assembly.id,
        kind: 'assembly',
        label: assembly.name,
        existingNote: assemblyNote(present),
        incomingNote: assemblyNote(assembly),
      }),
  )
  classify(
    incoming.materials,
    current.materials,
    (material) =>
      additions.materials.push(`${material.name}（${materialKindLabels[material.kind]}）`),
    (material, present) =>
      conflicts.push({
        id: material.id,
        kind: 'material',
        label: material.name,
        existingNote: materialNote(present),
        incomingNote: materialNote(material),
      }),
  )
  classify(
    incoming.documents,
    current.documents,
    (document) =>
      additions.documents.push(`${document.assembly.name} · 修订 ${document.assembly.revision}`),
    (document, present) =>
      conflicts.push({
        id: document.id,
        kind: 'document',
        label: `${document.assembly.name} · 修订 ${document.assembly.revision}`,
        existingNote: documentNote(present),
        incomingNote: documentNote(document),
      }),
  )
  return { additions, conflicts, keptCount }
}

export function planOutcome(
  current: EnvelopeData,
  incoming: EnvelopeData,
  choices: ConflictChoices,
): MergeReport {
  return buildReport(current, incoming, decideFates(current, incoming, choices))
}

export function applyMerge(
  current: EnvelopeData,
  incoming: EnvelopeData,
  choices: ConflictChoices,
): { data: EnvelopeData; report: MergeReport } {
  const fates = decideFates(current, incoming, choices)
  const report = buildReport(current, incoming, fates)
  if (report.overflow.length) {
    throw new Error(`${report.overflow[0]} 当前设计未被修改。`)
  }
  const materialIds = new Map<string, string>()
  for (const material of incoming.materials) {
    if (fates.materials.get(material.id) === 'copy') materialIds.set(material.id, newId('material'))
  }
  const assemblyIds = new Map<string, string>()
  const layerIds = new Map<string, string>()
  for (const assembly of incoming.assemblies) {
    if (fates.assemblies.get(assembly.id) !== 'copy') continue
    assemblyIds.set(assembly.id, newId('envelope'))
    for (const layer of assembly.layers) layerIds.set(layer.id, newId('ply'))
  }
  const documentIds = new Map<string, string>()
  for (const document of incoming.documents) {
    if (documentFate(document, fates) === 'copy')
      documentIds.set(document.id, newId('carbon-document'))
  }
  const mapMaterial = (id: string) => materialIds.get(id) ?? id

  const materials = [...current.materials]
  for (const material of incoming.materials) {
    const fate = fates.materials.get(material.id)
    if (fate === 'add') materials.push(clone(material))
    if (fate === 'copy') {
      materials.push({
        ...clone(material),
        id: materialIds.get(material.id)!,
        name: copyName(material.name, 40),
      })
    }
  }

  const assemblies = [...current.assemblies]
  for (const assembly of incoming.assemblies) {
    const fate = fates.assemblies.get(assembly.id)
    if (fate === 'add') {
      assemblies.push({
        ...clone(assembly),
        layers: assembly.layers.map((layer) => ({
          ...layer,
          materialId: mapMaterial(layer.materialId),
        })),
      })
    }
    if (fate === 'copy') {
      assemblies.push({
        ...clone(assembly),
        id: assemblyIds.get(assembly.id)!,
        name: copyName(assembly.name, 50),
        layers: assembly.layers.map((layer) => ({
          ...layer,
          id: layerIds.get(layer.id)!,
          materialId: mapMaterial(layer.materialId),
        })),
      })
    }
  }

  const documents = [...current.documents]
  for (const document of incoming.documents) {
    const fate = documentFate(document, fates)
    if (fate !== 'add' && fate !== 'copy') continue
    const next = clone(document)
    if (fate === 'copy') next.id = documentIds.get(document.id)!
    const mappedAssembly = assemblyIds.get(document.assemblyId)
    if (mappedAssembly) {
      next.assemblyId = mappedAssembly
      next.assembly = { ...next.assembly, id: mappedAssembly }
    }
    documents.push(next)
  }

  return { data: { schema: 1, stamp: current.stamp, assemblies, materials, documents }, report }
}

export function mergeSegments(report: MergeReport): string[] {
  const segments: string[] = []
  const bits = (group: { assemblies: number; materials: number; documents: number }) =>
    [
      group.assemblies ? `${group.assemblies} 个构造` : '',
      group.materials ? `${group.materials} 种材料` : '',
      group.documents ? `${group.documents} 份计算书` : '',
    ].filter(Boolean)
  const added = bits(report.added)
  if (added.length) segments.push(`新增 ${added.join('、')}`)
  const copied = bits(report.copied)
  if (copied.length) segments.push(`作为副本导入 ${copied.join('、')}`)
  const skipped = report.skipped.assemblies + report.skipped.materials + report.skipped.documents
  if (skipped) segments.push(`跳过 ${skipped} 条冲突记录`)
  if (report.forcedDocuments.length) {
    segments.push(`${report.forcedDocuments.length} 份计算书随所属构造一并跳过`)
  }
  return segments
}

export function mergeNotice(report: MergeReport): string {
  return `恢复完成：${mergeSegments(report).join('；')}。`
}
