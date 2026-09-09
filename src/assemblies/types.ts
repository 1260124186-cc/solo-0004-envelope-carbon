export type Surface = 'wall' | 'roof' | 'floor'
export type AssemblyState = 'editing' | 'finalized'

export interface Layer {
  id: string
  materialId: string
  thickness: number
  loss: number
  lifespan: number
}

export interface Assembly {
  id: string
  name: string
  surface: Surface
  area: number
  years: number
  carbonLimit: number
  thermalLimit: number
  note: string
  layers: Layer[]
  state: AssemblyState
  revision: number
  updatedAt: string
}

export interface Finding {
  path: string
  text: string
}

export const surfaceLabels: Record<Surface, string> = {
  wall: '外墙',
  roof: '屋面',
  floor: '楼板',
}

export const stateLabels: Record<AssemblyState, string> = {
  editing: '编辑中',
  finalized: '已定稿',
}
