export type ConflictChoice = 'skip' | 'copy'

export type ConflictChoices = Readonly<Record<string, ConflictChoice>>

export type RecordKind = 'assembly' | 'material' | 'document'

export const kindLabels: Record<RecordKind, string> = {
  assembly: '构造',
  material: '材料',
  document: '计算书',
}

export interface ConflictItem {
  id: string
  kind: RecordKind
  label: string
  existingNote: string
  incomingNote: string
}

export interface MergePlan {
  additions: { assemblies: string[]; materials: string[]; documents: string[] }
  conflicts: ConflictItem[]
  keptCount: number
}

export interface MergeReport {
  added: { assemblies: number; materials: number; documents: number }
  copied: { assemblies: number; materials: number; documents: number }
  skipped: { assemblies: number; materials: number; documents: number }
  forcedDocuments: string[]
  warnings: string[]
  overflow: string[]
  changes: number
}
