import type { Assembly } from '../assemblies/types'
import type { DriftStatus, EnvelopeScheme, EntryEvaluation, SchemeEvaluation } from './types'
import { calculate } from '../carbon/engine'
import { validateScheme } from './validation'
import { assemblyChecksum } from './factory'

/**
 * 组合计算只使用每个部位的冻结快照与冻结材料，
 * 原构造后续修改不会改变已保存组合的结果。
 */
export function evaluateScheme(
  scheme: EnvelopeScheme,
  liveAssemblies: Assembly[],
): SchemeEvaluation {
  const findings = validateScheme(scheme)
  const liveById = new Map(liveAssemblies.map((assembly) => [assembly.id, assembly]))
  const entries: EntryEvaluation[] = scheme.entries.map((entry) => {
    const result = calculate(entry.snapshot, entry.materials)
    const live = liveById.get(entry.assemblyId)
    // 以内容校验值判定：只有真正改动了构造内容才算漂移，单纯定稿/重编辑不误报。
    const status: DriftStatus = !live
      ? 'missing'
      : assemblyChecksum(live) === entry.checksum
        ? 'current'
        : 'modified'
    const acknowledged =
      status === 'missing'
        ? entry.acknowledgedChecksum === entry.checksum
        : status === 'modified'
          ? entry.acknowledgedChecksum === assemblyChecksum(live!)
          : false
    return {
      entry,
      intensity: result.intensity,
      whole: result.intensity * entry.area,
      initial: result.initial * entry.area,
      replacement: result.replacement * entry.area,
      years: entry.snapshot.years,
      status,
      acknowledged,
      liveName: live?.name ?? '',
    }
  })
  const yearSets = [...new Set(entries.map((entry) => entry.years))].sort((a, b) => a - b)
  const consistent = yearSets.length <= 1
  const totalArea = entries.reduce((sum, entry) => sum + entry.entry.area, 0)
  // 计算年限不同的构造替换次数不同，强度不具同一口径，禁止直接混算总量与组合强度。
  const totalCarbon =
    consistent && !findings.length ? entries.reduce((sum, entry) => sum + entry.whole, 0) : null
  const intensity = totalCarbon !== null && totalArea > 0 ? totalCarbon / totalArea : null
  return { entries, totalArea, totalCarbon, intensity, yearSets, consistent, findings }
}
