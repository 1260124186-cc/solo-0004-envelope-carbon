export type SelfcheckSeverity = 'error' | 'warning'

export interface SelfcheckFinding {
  severity: SelfcheckSeverity
  rule: string
  subject: string
  text: string
  impact: string
}

export interface SelfcheckCounts {
  assemblies: number
  materials: number
  documents: number
}

export interface SelfcheckReport {
  checkedAt: string
  stored: boolean
  counts: SelfcheckCounts | null
  findings: SelfcheckFinding[]
}
