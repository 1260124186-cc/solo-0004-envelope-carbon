import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { ComplianceRule } from '../compliance/types'
import type { CarbonDocument } from './types'
import { requireEditable } from '../assemblies/validation'
import { calculate } from '../carbon/engine'
import { evaluateLegacy, evaluateRule } from '../compliance/engine'
import { clone, newId, now } from '../shared/identity'

export function createDocument(
  assembly: Assembly,
  materials: Material[],
  rule: ComplianceRule | null,
): CarbonDocument {
  requireEditable(assembly)
  const result = calculate(assembly, materials)
  const used = new Set(assembly.layers.map((layer) => layer.materialId))
  const frozenRule = assembly.ruleId ? clone(rule) : null
  const compliance = frozenRule
    ? evaluateRule(frozenRule, result)
    : evaluateLegacy(assembly, result)
  return {
    id: newId('carbon-document'),
    assemblyId: assembly.id,
    createdAt: now(),
    assembly: clone({ ...assembly, state: 'finalized' }),
    materials: clone(materials.filter((material) => used.has(material.id))),
    result: clone(result),
    ruleId: assembly.ruleId,
    rule: frozenRule,
    compliance: clone(compliance),
  }
}
