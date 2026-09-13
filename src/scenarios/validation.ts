import type { Assembly, Finding } from '../assemblies/types'
import type { FactorRange, ScenarioStudy } from './types'
import { validateAssembly } from '../assemblies/validation'
import { validateMaterial } from '../materials/validation'
import { evaluateStudy } from './engine'

export type StudyFinding = Finding

function factorInRange(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
}

export function validateFactorRange(range: FactorRange | undefined): string[] {
  if (!range) return ['请补全该材料的低值、参考值和高值。']
  const errors: string[] = []
  if (!factorInRange(range.low)) errors.push('低值碳因子需在 0 至 100 之间。')
  if (!factorInRange(range.reference)) errors.push('参考碳因子需在 0 至 100 之间。')
  if (!factorInRange(range.high)) errors.push('高值碳因子需在 0 至 100 之间。')
  if (
    factorInRange(range.low) &&
    factorInRange(range.reference) &&
    factorInRange(range.high) &&
    !(range.low <= range.reference && range.reference <= range.high)
  ) {
    errors.push('碳因子需满足低值 ≤ 参考值 ≤ 高值。')
  }
  return errors
}

/** 结构层面的校验，用于编辑过程中给出即时提示与阻止保存。 */
export function validateStudy(study: ScenarioStudy): StudyFinding[] {
  const findings: StudyFinding[] = []
  const add = (path: string, text: string) => findings.push({ path, text })
  if (!study.name.trim() || study.name.length > 50) {
    add('name', '研究名称需为 1 至 50 个字符。')
  }
  if (study.note.length > 1000) add('note', '研究假设最多 1,000 个字符。')

  const assembly: Assembly = study.snapshot.assembly
  const materials = study.snapshot.materials
  if (validateAssembly(assembly, materials).length) {
    add('snapshot', '研究采用的构造或物性已不完整，无法计算情景。')
  }

  const usedIds = new Set(assembly.layers.map((layer) => layer.materialId))
  for (const material of materials) {
    if (!usedIds.has(material.id)) {
      add(`snapshot.${material.id}`, '快照包含构造未使用的材料。')
      continue
    }
    if (validateMaterial(material).length) {
      add(`snapshot.${material.id}`, `材料「${material.name}」的快照物性无效。`)
    }
    const errors = validateFactorRange(study.ranges[material.id])
    for (const text of errors) add(`ranges.${material.id}`, `材料「${material.name}」：${text}`)
  }
  for (const id of Object.keys(study.ranges)) {
    if (!usedIds.has(id)) add(`ranges.${id}`, '存在构造未使用材料的情景设定。')
  }

  if (!findings.some((finding) => finding.path.startsWith('snapshot'))) {
    try {
      evaluateStudy(study)
    } catch (error) {
      add('ranges', error instanceof Error ? error.message : '情景计算无法完成。')
    }
  }
  return findings
}
