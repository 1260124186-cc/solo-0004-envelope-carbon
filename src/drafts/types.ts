import type { Assembly } from '../assemblies/types'

/**
 * 未提交构造草稿。草稿与正式设计（persistenceKey 命名空间）物理分离，
 * 任何时候都不会进入正式构造集合，也不参与修订号与互斥锁校验。
 */
export interface AssemblyDraft {
  /** 草稿结构版本，与正式数据的 schema 无关。 */
  draftSchema: 1
  /** 正在编辑的构造快照；新构造带临时 id，尚未进入正式存储。 */
  assembly: Assembly
  /** 编辑起点对应的正式构造 id；全新构造为 null。 */
  originId: string | null
  /** 开始编辑时正式数据的修订戳，用于判断草稿是否过期。 */
  baseStamp: string
  /** 首次开始编辑的时间。 */
  startedAt: string
  /** 最近一次自动保存时间。 */
  updatedAt: string
}

/** 草稿独立存储键，与正式设计命名空间分离。 */
export const draftKey = 'solo-0004-envelope-carbon:draft:v1'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 读取草稿。草稿损坏（旧版本、结构缺失等）时静默清除，
 * 绝不抛错阻断应用启动，更不能触碰正式数据。
 */
export function readDraft(): AssemblyDraft | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(draftKey)
  } catch {
    return null
  }
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    clearDraft()
    return null
  }
  if (
    !isObject(parsed) ||
    parsed.draftSchema !== 1 ||
    !isObject(parsed.assembly) ||
    (parsed.originId !== null && typeof parsed.originId !== 'string') ||
    typeof parsed.baseStamp !== 'string' ||
    typeof parsed.startedAt !== 'string' ||
    typeof parsed.updatedAt !== 'string'
  ) {
    clearDraft()
    return null
  }
  return parsed as unknown as AssemblyDraft
}

/**
 * 写入草稿。写入失败（空间不足、存储被禁）向上抛出，由调用方决定提示方式；
 * 该函数永远不写正式存储。
 */
export function writeDraft(draft: AssemblyDraft): void {
  localStorage.setItem(draftKey, JSON.stringify(draft))
}

/** 放弃或正常保存后清除草稿槽位。 */
export function clearDraft(): void {
  try {
    localStorage.removeItem(draftKey)
  } catch {
    // 草稿空间清理失败不影响正式编辑流程。
  }
}
