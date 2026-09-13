export type DecisionState = 'draft' | 'confirmed'

export interface DecisionOption {
  documentId: string
  rejectedReason: string
}

export interface Decision {
  id: string
  groupId: string
  revision: number
  state: DecisionState
  title: string
  options: DecisionOption[]
  chosenDocumentId: string
  rationale: string
  verify: string
  createdAt: string
  updatedAt: string
  confirmedAt: string
}

export const decisionStateLabels: Record<DecisionState, string> = {
  draft: '草稿',
  confirmed: '已确认',
}
