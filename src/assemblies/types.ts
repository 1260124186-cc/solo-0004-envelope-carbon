export type Surface = 'wall' | 'roof' | 'floor'
export type AssemblyState = 'editing' | 'finalized'
export type RevisionKind = 'save' | 'reopen' | 'align'

export interface Layer {
  id: string
  materialId: string
  thickness: number
  loss: number
  lifespan: number
}

/**
 * 一次修订号变更的不可变记录。备注只描述本次冻结或重开，
 * 后续编辑只能追加新记录，不能改写历史条目。
 */
export interface RevisionEntry {
  revision: number
  kind: RevisionKind
  note: string
  at: string
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
  revisions: RevisionEntry[]
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

export const revisionKindLabels: Record<RevisionKind, string> = {
  save: '保存',
  reopen: '重新开启编辑',
  align: '统一计算口径',
}
