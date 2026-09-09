export type MaterialKind = 'structure' | 'insulation' | 'finish'

export interface Material {
  id: string
  name: string
  kind: MaterialKind
  density: number
  conductivity: number
  factor: number
  lifespan: number
  source: string
  description: string
  custom: boolean
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
