export type EvidenceStatus = 'pending' | 'verified' | 'obsolete'

// 可被依据关联的材料物性；寿命在构造层上取用，故不在此处。
export type PropertyKey = 'density' | 'conductivity' | 'factor'

export interface EvidenceLink {
  materialId: string
  properties: PropertyKey[]
}

export interface Evidence {
  id: string
  title: string
  year: string
  url: string
  scope: string
  note: string
  status: EvidenceStatus
  links: EvidenceLink[]
  createdAt: string
  updatedAt: string
}

export const statusLabels: Record<EvidenceStatus, string> = {
  pending: '待核实',
  verified: '已核实',
  obsolete: '不再适用',
}

export const statusOrder: EvidenceStatus[] = ['pending', 'verified', 'obsolete']

export const propertyLabels: Record<PropertyKey, string> = {
  density: '密度',
  conductivity: '导热系数',
  factor: '碳因子',
}
