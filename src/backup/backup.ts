import type { EnvelopeData } from '../persistence/types'
import { validateEnvelopeData } from '../persistence/decode'
import { now } from '../shared/identity'

export const backupFormat = 'solo-0004-envelope-carbon/backup'
export const backupVersion = 1
export const backupFileLimit = 20 * 1024 * 1024

export function createBackup(data: EnvelopeData): string {
  return JSON.stringify(
    {
      format: backupFormat,
      version: backupVersion,
      exportedAt: now(),
      data,
    },
    null,
    2,
  )
}

function invalid(detail: string): Error {
  return new Error(`${detail} 当前设计未被修改。`)
}

export function parseBackup(text: string): EnvelopeData {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw invalid('备份文件已损坏：内容不是有效的 JSON 文本。')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw invalid('这不是围护碳研导出的设计备份文件。')
  }
  const envelope = parsed as Record<string, unknown>
  if (envelope.format !== backupFormat) {
    throw invalid('这不是围护碳研导出的设计备份文件。')
  }
  if (envelope.version !== backupVersion) {
    throw invalid(
      `备份文件版本不受支持（文件版本：${String(envelope.version)}，当前支持：${backupVersion}）。请用生成该文件的同一版本重新导出。`,
    )
  }
  let data: EnvelopeData
  try {
    data = validateEnvelopeData(envelope.data)
  } catch (cause) {
    throw invalid(`备份内容无效：${cause instanceof Error ? cause.message : '未知结构错误'}`)
  }
  const ids = new Set<string>()
  for (const record of [...data.assemblies, ...data.materials, ...data.documents]) {
    if (ids.has(record.id)) throw invalid('备份引用关系无效：标识在不同类别记录间重复。')
    ids.add(record.id)
  }
  const assemblyIds = new Set(data.assemblies.map((assembly) => assembly.id))
  for (const document of data.documents) {
    if (!assemblyIds.has(document.assemblyId)) {
      throw invalid(`备份引用关系不完整：计算书「${document.assembly.name}」缺少所属构造。`)
    }
  }
  return data
}
