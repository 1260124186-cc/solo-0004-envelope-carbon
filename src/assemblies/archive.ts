import type { Assembly } from './types'

export type ArchiveBlock =
  | 'editing-open'
  | 'baseline'
  | 'alternative'
  | 'already-archived'
  | 'missing'

/**
 * 归档只是从工作列表隐藏：构造实体、定稿状态与历史计算书都保留在存储中，
 * 与“从存储删除”是两种不同动作。因此拒绝条件只检查可见性的占用关系，
 * 不改变构造自身状态。
 */
export function archiveBlockReason(input: {
  assemblies: Assembly[]
  archives: string[]
  id: string
  openDraftId: string | null
  draftState: Assembly['state'] | null
  baselineId: string
  alternativeId: string
}): ArchiveBlock | null {
  const assembly = input.assemblies.find((item) => item.id === input.id)
  if (!assembly) return 'missing'
  if (input.archives.includes(input.id)) return 'already-archived'
  if (input.id === input.baselineId) return 'baseline'
  if (input.id === input.alternativeId) return 'alternative'
  if (input.id === input.openDraftId && input.draftState === 'editing') return 'editing-open'
  return null
}

export const archiveBlockText: Record<ArchiveBlock, string> = {
  missing: '该构造已不存在。',
  'already-archived': '该构造已经归档。',
  baseline: '该构造是方案比较当前选中的基准构造，请先在方案比较中改选基准后再归档。',
  alternative: '该构造是方案比较当前选中的替代构造，请先在方案比较中改选替代后再归档。',
  'editing-open': '该构造正在编辑区打开。请先保存或切换到其他构造，再归档；归档不会删除任何内容。',
}

/** 把构造标识移入归档列表；构造实体与计算书不做任何改动。 */
export function archiveId(archives: string[], id: string): string[] {
  return archives.includes(id) ? archives : [...archives, id]
}

/** 从归档列表移除标识，构造以原身份回到“当前构造”和方案比较的选择中。 */
export function restoreId(archives: string[], id: string): string[] {
  return archives.filter((item) => item !== id)
}
