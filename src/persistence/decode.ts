import type { EnvelopeData } from './types'
import { validateAssembly } from '../assemblies/validation'
import { validateMaterial } from '../materials/validation'
import { calculate } from '../carbon/engine'
import { validateStudy } from '../scenarios/validation'
import { evaluateStudy } from '../scenarios/engine'

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertUnique(items: { id: string }[], label: string): void {
  const ids = new Set<string>()
  for (const item of items) {
    if (typeof item.id !== 'string' || !item.id || ids.has(item.id)) {
      throw new Error(`${label}标识缺失或重复。`)
    }
    ids.add(item.id)
  }
}

function validStamp(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0 && value.length <= 100
}

export function decode(raw: string): EnvelopeData {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!object(parsed) || parsed.schema !== 1 || typeof parsed.stamp !== 'string') {
      throw new Error('存储版本不受支持。')
    }
    if (
      !Array.isArray(parsed.assemblies) ||
      !Array.isArray(parsed.materials) ||
      !Array.isArray(parsed.documents)
    ) {
      throw new Error('存储结构不完整。')
    }
    // studies 为新增字段：本版本之前保存的数据不含该字段，按空研究集兼容读取。
    if (parsed.studies !== undefined && !Array.isArray(parsed.studies)) {
      throw new Error('参数情景研究结构不完整。')
    }
    const studies = (parsed.studies ?? []) as EnvelopeData['studies']
    const data: EnvelopeData = {
      ...(parsed as unknown as EnvelopeData),
      studies,
    }
    if (
      data.assemblies.length > 200 ||
      data.materials.length > 500 ||
      data.documents.length > 1000 ||
      data.studies.length > 200
    ) {
      throw new Error('存储条目超出当前版本容量。')
    }
    assertUnique(data.assemblies, '构造')
    assertUnique(data.materials, '材料')
    assertUnique(data.documents, '计算书')
    assertUnique(data.studies, '参数情景研究')
    for (const material of data.materials) {
      if (typeof material.custom !== 'boolean' || validateMaterial(material).length) {
        throw new Error('材料参数无效。')
      }
    }
    for (const assembly of data.assemblies) {
      if (!['editing', 'finalized'].includes(assembly.state)) throw new Error('构造状态无效。')
      if (!Number.isInteger(assembly.revision) || assembly.revision < 1)
        throw new Error('修订号无效。')
      if (!Number.isFinite(Date.parse(assembly.updatedAt))) throw new Error('构造时间无效。')
      if (validateAssembly(assembly, data.materials).length) throw new Error('构造参数无效。')
    }
    for (const document of data.documents) {
      if (document.assemblyId !== document.assembly.id || document.assembly.state !== 'finalized') {
        throw new Error('计算书与冻结构造不一致。')
      }
      if (!Number.isFinite(Date.parse(document.createdAt))) throw new Error('计算书时间无效。')
      if (
        JSON.stringify(calculate(document.assembly, document.materials)) !==
        JSON.stringify(document.result)
      ) {
        throw new Error('计算书结果与冻结输入不一致。')
      }
    }
    for (const study of data.studies) {
      if (
        !validStamp(study.id) ||
        !validStamp(study.sourceAssemblyId) ||
        !Number.isFinite(Date.parse(study.createdAt)) ||
        !Number.isFinite(Date.parse(study.updatedAt))
      ) {
        throw new Error('参数情景研究的标识或时间无效。')
      }
      if (study.snapshot.assembly.id !== study.sourceAssemblyId) {
        throw new Error('参数情景研究与来源构造不一致。')
      }
      if (validateStudy(study).length) {
        throw new Error('参数情景研究的输入无效。')
      }
      evaluateStudy(study)
    }
    return data
  } catch (error) {
    const detail = error instanceof Error ? error.message : '未知结构错误'
    throw new Error(`无法读取已保存的设计：${detail} 原数据未被覆盖。`)
  }
}
