import type { Material } from '../materials/types'
import type { Calculation } from '../carbon/types'
import type {
  FactorRange,
  ScenarioKey,
  ScenarioResult,
  ScenarioStudy,
  StudyEvaluation,
} from './types'
import { scenarioLabels, scenarioOrder } from './types'
import { calculate } from '../carbon/engine'
import { clone } from '../shared/identity'

/** 用本研究设定的碳因子替换材料目录因子，其余物性保持快照原值。 */
function materialsForScenario(
  study: ScenarioStudy,
  key: ScenarioKey,
): { assembly: ScenarioStudy['snapshot']['assembly']; materials: Material[] } {
  const assembly = clone(study.snapshot.assembly)
  const materials = study.snapshot.materials.map((material) => {
    const range = study.ranges[material.id]
    if (!range) throw new Error(`材料「${material.name}」缺少情景因子设定。`)
    return { ...clone(material), factor: range[key] }
  })
  return { assembly, materials }
}

function calculateScenario(study: ScenarioStudy, key: ScenarioKey): ScenarioResult {
  const { assembly, materials } = materialsForScenario(study, key)
  const calculation: Calculation = calculate(assembly, materials)
  return {
    key,
    label: scenarioLabels[key],
    calculation,
    carbonPass: calculation.carbonPass,
  }
}

export function evaluateStudy(study: ScenarioStudy): StudyEvaluation {
  const scenarios = {} as Record<ScenarioKey, ScenarioResult>
  for (const key of scenarioOrder) scenarios[key] = calculateScenario(study, key)
  const counts = new Map<string, number>()
  for (const layer of study.snapshot.assembly.layers) {
    counts.set(layer.materialId, (counts.get(layer.materialId) ?? 0) + 1)
  }
  const sharedMaterialIds: string[] = []
  for (const [materialId, count] of counts) {
    if (count > 1) sharedMaterialIds.push(materialId)
  }
  return { scenarios, sharedMaterialIds }
}

export function rangeForMaterial(material: Material): FactorRange {
  return { low: material.factor, reference: material.factor, high: material.factor }
}
