import type { Assembly, RevisionEntry } from '../assemblies/types'
import type { Calculation } from '../carbon/types'
import type { Material } from '../materials/types'

export interface CarbonDocument {
  id: string
  assemblyId: string
  createdAt: string
  /** 本次定稿时写下的备注，与输入结果一同冻结，后续编辑不可改写。 */
  note: string
  assembly: Assembly
  materials: Material[]
  result: Calculation
}

/**
 * 找到某修订号冻结记录中的备注：取同修订号最后一条有内容的记录，
 * 可以是保存说明或重开说明（例如重开后立即定稿时只有重开记录）；
 * 没有记录或均为空时返回空字符串。
 */
export function revisionNote(assembly: Assembly, revision: number): string {
  for (let index = assembly.revisions.length - 1; index >= 0; index -= 1) {
    const entry = assembly.revisions[index]
    if (entry.revision === revision && entry.note.trim()) return entry.note
  }
  return ''
}

/**
 * 历史列表中与修订号一起展示的备注：优先本次定稿备注，
 * 定稿备注为空时回退到该版冻结记录里同修订号的保存或重开说明。
 */
export function documentSnippet(document: CarbonDocument): string {
  const frozen = document.note?.trim()
  if (frozen) return frozen
  return revisionNote(document.assembly, document.assembly.revision)
}

/** 只追加的修订记录，保证历史备注不会被后续编辑改写。 */
export function appendRevision(revisions: RevisionEntry[], entry: RevisionEntry): RevisionEntry[] {
  return [...revisions, entry]
}
