import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { CarbonDocument } from '../documents/types'
import type { EnvelopeData } from '../persistence/types'
import { persistenceKey } from '../persistence/types'
import { validateAssembly } from '../assemblies/validation'
import { validateMaterial } from '../materials/validation'
import { calculate } from '../carbon/engine'
import type { SelfcheckCounts, SelfcheckFinding, SelfcheckReport, SelfcheckSeverity } from './types'

export const capacityLimits = { assemblies: 200, materials: 500, documents: 1000, layers: 20 }
export const nearLimitRatio = 0.9
export const staleEditingDays = 90

const dayMs = 24 * 60 * 60 * 1000

function finding(
  severity: SelfcheckSeverity,
  rule: string,
  subject: string,
  text: string,
  impact: string,
): SelfcheckFinding {
  return { severity, rule, subject, text, impact }
}

function error(rule: string, subject: string, text: string, impact: string): SelfcheckFinding {
  return finding('error', rule, subject, text, impact)
}

function warning(rule: string, subject: string, text: string, impact: string): SelfcheckFinding {
  return finding('warning', rule, subject, text, impact)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const impactStorage = '整份设计无法载入，所有计算、保存与定稿都无法进行。'
const impactExceeded = '超出当前版本容量，整份设计无法通过读取校验，页面将无法载入。'
const impactIdentity = '存储校验失败，整份设计无法载入，需修复标识后才能继续。'
const impactMaterial = '该材料使整份设计无法通过读取校验；引用它的构造无法计算或定稿。'
const impactAssembly = '该构造无法保存、参与计算或定稿，并使整份设计无法通过读取校验。'
const impactDangling = '该构造无法通过校验，不能保存、计算或定稿；整份设计也无法通过读取校验。'
const impactDocument = '计算书与冻结构造不一致，整份设计无法通过读取校验，页面将无法载入。'

function checkCapacity(
  findings: SelfcheckFinding[],
  label: string,
  count: number,
  limit: number,
  nearImpact: string,
): void {
  const subject = `${label}集合`
  if (count > limit) {
    findings.push(
      error(
        'capacity-exceeded',
        subject,
        `${label}已有 ${count} 条，超过 ${limit} 条上限。`,
        impactExceeded,
      ),
    )
    return
  }
  if (count >= Math.ceil(limit * nearLimitRatio)) {
    const text =
      count === limit
        ? `${label}已达 ${limit} 条上限，无法继续新增。`
        : `${label}已有 ${count} 条，接近 ${limit} 条上限。`
    findings.push(warning('capacity-near-limit', subject, text, nearImpact))
  }
}

function checkIdentity(findings: SelfcheckFinding[], label: string, items: unknown[]): void {
  const subject = `${label}集合`
  const seen = new Set<string>()
  const repeated = new Set<string>()
  items.forEach((item, index) => {
    const id = isObject(item) && typeof item.id === 'string' ? item.id : ''
    if (!id) {
      findings.push(
        error('duplicate-id', subject, `第 ${index + 1} 条${label}记录缺失标识。`, impactIdentity),
      )
      return
    }
    if (seen.has(id)) repeated.add(id)
    seen.add(id)
  })
  for (const id of repeated) {
    findings.push(error('duplicate-id', subject, `${label}标识 ${id} 重复出现。`, impactIdentity))
  }
}

function checkMaterial(findings: SelfcheckFinding[], material: Material, index: number): void {
  const subject = isObject(material)
    ? `材料「${material.name ?? '未命名'}」（${material.id ?? `第 ${index + 1} 条`}）`
    : `第 ${index + 1} 条材料记录`
  if (!isObject(material)) {
    findings.push(
      error('record-unreadable', subject, '材料记录结构损坏，无法识别。', impactMaterial),
    )
    return
  }
  const problems: string[] = []
  if (typeof material.custom !== 'boolean') problems.push('自定义标识缺失或无效。')
  try {
    problems.push(...validateMaterial(material))
  } catch {
    problems.push('材料记录结构损坏，无法完成校验。')
  }
  if (problems.length) {
    findings.push(error('material-invalid', subject, problems.join(' '), impactMaterial))
  }
}

function checkAssembly(
  findings: SelfcheckFinding[],
  assembly: Assembly,
  index: number,
  data: EnvelopeData,
  now: Date,
): void {
  const subject = isObject(assembly)
    ? `构造「${assembly.name ?? '未命名'}」（${assembly.id ?? `第 ${index + 1} 条`}）`
    : `第 ${index + 1} 条构造记录`
  if (!isObject(assembly)) {
    findings.push(
      error('record-unreadable', subject, '构造记录结构损坏，无法识别。', impactAssembly),
    )
    return
  }
  if (!['editing', 'finalized'].includes(assembly.state)) {
    findings.push(error('assembly-invalid', subject, '构造状态无效。', impactAssembly))
  }
  if (!Number.isInteger(assembly.revision) || assembly.revision < 1) {
    findings.push(error('assembly-invalid', subject, '修订号无效。', impactAssembly))
  }
  const updated = Date.parse(assembly.updatedAt)
  if (!Number.isFinite(updated)) {
    findings.push(error('assembly-invalid', subject, '构造时间无效。', impactAssembly))
  }
  try {
    for (const item of validateAssembly(assembly, data.materials)) {
      if (item.text.endsWith('引用的材料不存在。')) continue
      if (item.text.endsWith('最多包含 20 层。')) continue
      findings.push(
        error('assembly-invalid', `${subject} · ${item.path}`, item.text, impactAssembly),
      )
    }
  } catch {
    findings.push(
      error('assembly-invalid', subject, '构造记录结构损坏，无法完成校验。', impactAssembly),
    )
  }
  if (Array.isArray(assembly.layers)) {
    const materialIds = new Set(
      data.materials.filter(isObject).map((material) => material.id as string),
    )
    assembly.layers.forEach((layer, layerIndex) => {
      const layerSubject = `${subject} 第 ${layerIndex + 1} 层（${layer?.id ?? '无标识'}）`
      if (!isObject(layer)) {
        findings.push(
          error('assembly-invalid', layerSubject, '构造层记录结构损坏。', impactAssembly),
        )
        return
      }
      if (typeof layer.materialId !== 'string' || !materialIds.has(layer.materialId)) {
        findings.push(
          error(
            'dangling-material-reference',
            layerSubject,
            `引用的材料 ${layer.materialId ?? '缺失'} 在材料集合中不存在。`,
            impactDangling,
          ),
        )
      }
    })
    if (assembly.layers.length > capacityLimits.layers) {
      findings.push(
        error(
          'layers-exceeded',
          subject,
          `包含 ${assembly.layers.length} 个构造层，超过 ${capacityLimits.layers} 层上限。`,
          impactExceeded,
        ),
      )
    } else if (assembly.layers.length >= Math.ceil(capacityLimits.layers * nearLimitRatio)) {
      findings.push(
        warning(
          'layers-near-limit',
          subject,
          `已包含 ${assembly.layers.length} 个构造层，接近 ${capacityLimits.layers} 层上限。`,
          '暂不影响计算；达到上限后将无法继续添加构造层。',
        ),
      )
    }
  }
  if (assembly.state === 'editing' && Number.isFinite(updated)) {
    const documented = data.documents.some(
      (document) => isObject(document) && document.assemblyId === assembly.id,
    )
    const days = Math.floor((now.getTime() - updated) / dayMs)
    if (!documented && days > staleEditingDays) {
      findings.push(
        warning(
          'editing-stale',
          subject,
          `已在编辑中停留 ${days} 天，且从未生成定稿计算书。`,
          '不影响计算；但长期未定稿的构造没有冻结计算书，设计依据无法追溯，建议定稿或确认放弃。',
        ),
      )
    }
  }
}

function checkDocument(
  findings: SelfcheckFinding[],
  document: CarbonDocument,
  index: number,
  data: EnvelopeData,
): void {
  const subject = isObject(document)
    ? `计算书「${isObject(document.assembly) ? document.assembly.name : '未知构造'}」修订 ${
        isObject(document.assembly) ? document.assembly.revision : '?'
      }（${document.id ?? `第 ${index + 1} 份`}）`
    : `第 ${index + 1} 份计算书记录`
  if (!isObject(document)) {
    findings.push(
      error('record-unreadable', subject, '计算书记录结构损坏，无法识别。', impactDocument),
    )
    return
  }
  if (!Number.isFinite(Date.parse(document.createdAt))) {
    findings.push(error('document-invalid', subject, '计算书时间无效。', impactDocument))
  }
  if (!isObject(document.assembly)) {
    findings.push(error('document-invalid', subject, '计算书缺少冻结构造。', impactDocument))
    return
  }
  if (document.assemblyId !== document.assembly.id) {
    findings.push(
      error(
        'document-assembly-mismatch',
        subject,
        `计算书关联的构造标识与冻结构造标识不一致（${document.assemblyId} ≠ ${document.assembly.id}）。`,
        impactDocument,
      ),
    )
  }
  if (document.assembly.state !== 'finalized') {
    findings.push(
      error('document-assembly-mismatch', subject, '冻结构造的状态不是已定稿。', impactDocument),
    )
  }
  if (!Array.isArray(document.materials)) {
    findings.push(error('document-invalid', subject, '计算书缺少冻结材料。', impactDocument))
    return
  }
  const frozenProblems: string[] = []
  for (const material of document.materials) {
    try {
      frozenProblems.push(...validateMaterial(material).map((text) => `冻结材料：${text}`))
    } catch {
      frozenProblems.push('冻结材料记录结构损坏，无法完成校验。')
    }
  }
  try {
    frozenProblems.push(
      ...validateAssembly(document.assembly, document.materials).map(
        (item) => `冻结构造：${item.text}`,
      ),
    )
  } catch {
    frozenProblems.push('冻结构造记录结构损坏，无法完成校验。')
  }
  if (frozenProblems.length) {
    findings.push(
      error(
        'document-frozen-invalid',
        subject,
        frozenProblems.join(' '),
        '冻结的构造或材料参数无效，无法复算核对；整份设计无法通过读取校验。',
      ),
    )
    return
  }
  try {
    const recalculated = calculate(document.assembly, document.materials)
    if (JSON.stringify(recalculated) !== JSON.stringify(document.result)) {
      findings.push(
        error(
          'document-result-mismatch',
          subject,
          '按冻结输入重新计算的结果与冻结结果不一致。',
          '冻结结果与冻结输入不符，计算书不可信；整份设计无法通过读取校验。',
        ),
      )
    }
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : '未知错误'
    findings.push(
      error(
        'document-result-mismatch',
        subject,
        `无法用冻结输入重新计算：${detail}`,
        '冻结结果与冻结输入不符，计算书不可信；整份设计无法通过读取校验。',
      ),
    )
  }
  if (
    !data.assemblies.some((assembly) => isObject(assembly) && assembly.id === document.assemblyId)
  ) {
    findings.push(
      warning(
        'document-orphaned',
        subject,
        '计算书关联的构造已不存在于当前设计中。',
        '不影响计算与定稿；但关联构造已不存在，该计算书无法在计算书页查看或下载。',
      ),
    )
  }
}

function guard(findings: SelfcheckFinding[], subject: string, run: () => void): void {
  try {
    run()
  } catch {
    findings.push(
      error(
        'record-scan-failed',
        subject,
        '自检在检查该记录时遇到意外错误，未能完成该记录的检查。',
        '该记录状态未知；若读取校验失败，整份设计将无法载入。',
      ),
    )
  }
}

export function inspectRawData(raw: string | null, now: Date = new Date()): SelfcheckReport {
  const checkedAt = now.toISOString()
  if (raw === null) {
    return { checkedAt, stored: false, counts: null, findings: [] }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {
      checkedAt,
      stored: true,
      counts: null,
      findings: [
        error(
          'storage-unreadable',
          '浏览器存储',
          '保存的数据不是有效的 JSON，无法解析。',
          impactStorage,
        ),
      ],
    }
  }
  if (!isObject(parsed) || parsed.schema !== 1 || typeof parsed.stamp !== 'string') {
    return {
      checkedAt,
      stored: true,
      counts: null,
      findings: [
        error(
          'storage-unreadable',
          '浏览器存储',
          '存储版本或修订标识缺失，当前版本无法识别。',
          impactStorage,
        ),
      ],
    }
  }
  if (
    !Array.isArray(parsed.assemblies) ||
    !Array.isArray(parsed.materials) ||
    !Array.isArray(parsed.documents)
  ) {
    return {
      checkedAt,
      stored: true,
      counts: null,
      findings: [
        error(
          'storage-unreadable',
          '浏览器存储',
          '存储结构不完整，缺少构造、材料或计算书集合。',
          impactStorage,
        ),
      ],
    }
  }
  const data = parsed as unknown as EnvelopeData
  const counts: SelfcheckCounts = {
    assemblies: data.assemblies.length,
    materials: data.materials.length,
    documents: data.documents.length,
  }
  const findings: SelfcheckFinding[] = []
  checkCapacity(
    findings,
    '构造',
    counts.assemblies,
    capacityLimits.assemblies,
    '暂不影响计算；达到上限后将无法保存新构造。',
  )
  checkCapacity(
    findings,
    '材料',
    counts.materials,
    capacityLimits.materials,
    '暂不影响计算；达到上限后将无法新增自定义材料。',
  )
  checkCapacity(
    findings,
    '计算书',
    counts.documents,
    capacityLimits.documents,
    '暂不影响计算；达到上限后将无法生成新的定稿计算书。',
  )
  checkIdentity(findings, '构造', data.assemblies)
  checkIdentity(findings, '材料', data.materials)
  checkIdentity(findings, '计算书', data.documents)
  data.materials.forEach((material, index) =>
    guard(findings, `第 ${index + 1} 条材料记录`, () => checkMaterial(findings, material, index)),
  )
  data.assemblies.forEach((assembly, index) =>
    guard(findings, `第 ${index + 1} 条构造记录`, () =>
      checkAssembly(findings, assembly, index, data, now),
    ),
  )
  data.documents.forEach((document, index) =>
    guard(findings, `第 ${index + 1} 份计算书记录`, () =>
      checkDocument(findings, document, index, data),
    ),
  )
  return { checkedAt, stored: true, counts, findings }
}

export function scanStoredData(now: Date = new Date()): SelfcheckReport {
  let raw: string | null
  try {
    raw = localStorage.getItem(persistenceKey)
  } catch {
    return {
      checkedAt: now.toISOString(),
      stored: false,
      counts: null,
      findings: [
        error(
          'storage-unreadable',
          '浏览器存储',
          '无法访问浏览器存储，自检未能读取任何数据。',
          impactStorage,
        ),
      ],
    }
  }
  try {
    return inspectRawData(raw, now)
  } catch {
    return {
      checkedAt: now.toISOString(),
      stored: raw !== null,
      counts: null,
      findings: [
        error(
          'selfcheck-failed',
          '数据自检',
          '自检过程中出现意外错误，未能完成全部检查。',
          '自检未覆盖全部记录；已保存的数据未被修改。',
        ),
      ],
    }
  }
}
