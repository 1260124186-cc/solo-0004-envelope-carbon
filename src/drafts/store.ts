import type { Assembly } from '../assemblies/types'

// 草稿使用与正式设计完全分离的存储命名空间，绝不经过 commitData 的写入路径。
export const draftKey = 'solo-0004-envelope-carbon:draft:v1'

export interface DraftRecord {
  schema: 1
  assembly: Assembly
  // 草稿开始编辑时所基于的正式构造修订号；尚未保存过的新构造为 0。
  baseRevision: number
  // 正式数据在采集该草稿时的修订戳，用于识别跨标签页过期。
  baseStamp: string
  createdAt: string
  updatedAt: string
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// 草稿可能来自异常关闭的旧版本页面，只做结构性接纳；领域有效性由编辑区校验。
function structurallySound(assembly: unknown): assembly is Assembly {
  if (!isObject(assembly) || typeof assembly.id !== 'string' || !assembly.id) return false
  if (typeof assembly.name !== 'string' || typeof assembly.note !== 'string') return false
  if (!['wall', 'roof', 'floor'].includes(assembly.surface as string)) return false
  if (!['editing', 'finalized'].includes(assembly.state as string)) return false
  for (const key of ['area', 'years', 'carbonLimit', 'thermalLimit', 'revision']) {
    if (typeof assembly[key] !== 'number') return false
  }
  if (!Array.isArray(assembly.layers) || assembly.layers.length > 20) return false
  const ids = new Set<string>()
  for (const layer of assembly.layers) {
    if (!isObject(layer) || typeof layer.id !== 'string' || !layer.id || ids.has(layer.id)) {
      return false
    }
    ids.add(layer.id)
    if (typeof layer.materialId !== 'string') return false
    for (const key of ['thickness', 'loss', 'lifespan']) {
      if (typeof layer[key] !== 'number') return false
    }
  }
  return true
}

export function readDraftRecord(): DraftRecord | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(draftKey)
  } catch {
    return null
  }
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      !isObject(parsed) ||
      parsed.schema !== 1 ||
      typeof parsed.baseRevision !== 'number' ||
      typeof parsed.baseStamp !== 'string' ||
      typeof parsed.createdAt !== 'string' ||
      typeof parsed.updatedAt !== 'string' ||
      !structurallySound(parsed.assembly)
    ) {
      return null
    }
    return parsed as unknown as DraftRecord
  } catch {
    return null
  }
}

// 返回 false 表示浏览器存储不可写，调用方不得假装草稿已落盘。
export function writeDraftRecord(record: DraftRecord): boolean {
  try {
    localStorage.setItem(draftKey, JSON.stringify(record))
    return true
  } catch {
    return false
  }
}

export function clearDraftRecord(): void {
  try {
    localStorage.removeItem(draftKey)
  } catch {
    // 清除失败不影响正式保存；下次刷新仍会按恢复提示处理。
  }
}
