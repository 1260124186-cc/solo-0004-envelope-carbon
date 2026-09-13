export type BasisState = 'active' | 'retired'

export interface ThermalBasis {
  id: string
  name: string
  inner: number
  outer: number
  note: string
  state: BasisState
}

export interface SurfaceSetting {
  inner: number
  outer: number
  basisName: string | null
}

export const basisStateLabels: Record<BasisState, string> = {
  active: '启用中',
  retired: '已停用',
}

export const defaultSurfaceResistance = { inner: 0.11, outer: 0.04 }
