export type MaterialKind = 'structure' | 'insulation' | 'finish'

export interface MaterialRevision {
  revision: number
  density: number
  conductivity: number
  factor: number
  lifespan: number
  source: string
  note: string
  createdAt: string
}

export interface Material {
  id: string
  name: string
  kind: MaterialKind
  description: string
  custom: boolean
  revisions: MaterialRevision[]
}

export interface RevisionInput {
  density: number
  conductivity: number
  factor: number
  lifespan: number
  source: string
  note: string
}

export interface MaterialInput extends RevisionInput {
  name: string
  kind: MaterialKind
  description: string
}

export const kindLabels: Record<MaterialKind, string> = {
  structure: '主体材料',
  insulation: '保温材料',
  finish: '饰面材料',
}

export const kindColors: Record<MaterialKind, string> = {
  structure: '#9b9588',
  insulation: '#cdb877',
  finish: '#81a99a',
}
