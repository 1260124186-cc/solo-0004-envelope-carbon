import type { EnvelopeData } from '../persistence/types'
import { requireEditable } from '../assemblies/validation'
import { now } from '../shared/identity'
import type { DraftEditor } from './draftEditor'
import type { FeedbackChannel } from './feedback'

type Commit = (change: (next: EnvelopeData) => void, notice: string) => Promise<boolean>

/**
 * 比较口径调整命令：把替代构造的部位、面积、年限对齐到基准构造，
 * 口径合法性与可编辑性仍在持久化锁内核对。
 */
export function useComparisonAlignment(
  editor: DraftEditor,
  commit: Commit,
  getData: () => EnvelopeData | null,
  getBaselineId: () => string,
  getAlternativeId: () => string,
  feedback: FeedbackChannel,
) {
  async function alignAlternative(): Promise<void> {
    if (editor.dirty.value) {
      feedback.fail('请先保存当前构造，避免口径调整覆盖编辑内容。')
      return
    }
    const saved = await commit((next) => {
      const a = next.assemblies.find((item) => item.id === getBaselineId())
      const b = next.assemblies.find((item) => item.id === getAlternativeId())
      if (!a || !b || a.id === b.id) throw new Error('请选择两个不同的构造。')
      requireEditable(b)
      b.area = a.area
      b.years = a.years
      b.surface = a.surface
      b.revision += 1
      b.updatedAt = now()
    }, '替代构造已按基准统一部位、面积和年限。')
    if (saved && editor.draft.value) {
      const data = getData()
      if (data) editor.hydrate(data, editor.draft.value.id)
    }
  }

  return { alignAlternative }
}
