import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { Calculation } from '../carbon/types'

export type ScenarioKey = 'low' | 'reference' | 'high'

export interface FactorRange {
  low: number
  reference: number
  high: number
}

export interface StudySnapshot {
  assembly: Assembly
  materials: Material[]
  assemblyRevision: number
  assemblyUpdatedAt: string
}

export interface ScenarioStudy {
  id: string
  name: string
  sourceAssemblyId: string
  note: string
  ranges: Record<string, FactorRange>
  snapshot: StudySnapshot
  createdAt: string
  updatedAt: string
}

export interface ScenarioResult {
  key: ScenarioKey
  label: string
  calculation: Calculation
  carbonPass: boolean
}

export interface StudyEvaluation {
  scenarios: Record<ScenarioKey, ScenarioResult>
  /** 被多个构造层引用的材料标识，同一材料在这些层共用同一组因子。 */
  sharedMaterialIds: string[]
}

export const scenarioLabels: Record<ScenarioKey, string> = {
  low: '低值情景',
  reference: '参考情景',
  high: '高值情景',
}

export const scenarioOrder: ScenarioKey[] = ['low', 'reference', 'high']
