import type { EnvelopeData } from '../persistence/types'
import { requireEditable } from '../assemblies/validation'
import { createDocument } from '../documents/create'
import { clone, now } from '../shared/identity'
import type { FeedbackChannel } from './feedback'
import type { DraftEditor } from './draftEditor'

type Commit = (change: (next: EnvelopeData) => void, notice: string) => Promise<boolean>

/**
 * 计算书生命周期：编排构造保存、定稿（冻结生成计算书）与重新开启编辑。
 * 自身不接触存储 API 与浏览器事件，只把“对快照的变更”交给持久化协调器，
 * 成功后从新快照刷新编辑草稿。
 */
export function useDocumentLifecycle(
  editor: DraftEditor,
  commit: Commit,
  getData: () => EnvelopeData | null,
  feedback: FeedbackChannel,
) {
  async function save(): Promise<void> {
    const draft = editor.draft.value
    if (!draft || !getData() || !editor.editable.value) return
    if (editor.findings.value.length) {
      feedback.fail(editor.findings.value[0].text)
      return
    }
    const candidate = clone(draft)
    candidate.name = candidate.name.trim()
    candidate.revision += 1
    candidate.updatedAt = now()
    const saved = await commit((next) => {
      const index = next.assemblies.findIndex((item) => item.id === candidate.id)
      if (index >= 0) {
        requireEditable(next.assemblies[index])
        next.assemblies[index] = candidate
      } else {
        if (next.assemblies.length >= 200) throw new Error('最多保存 200 个构造。')
        next.assemblies.push(candidate)
      }
    }, '构造已保存。')
    if (saved) editor.draft.value = clone(candidate)
  }

  async function finalize(): Promise<boolean> {
    const draft = editor.draft.value
    const persistedId = draft ? getData()?.assemblies.some((item) => item.id === draft.id) : false
    if (!draft || !persistedId || editor.dirty.value) {
      feedback.fail('请先保存当前构造，再生成定稿。')
      return false
    }
    const id = draft.id
    const saved = await commit((next) => {
      const assembly = next.assemblies.find((item) => item.id === id)
      if (!assembly) throw new Error('构造不存在。')
      if (next.documents.length >= 1000) throw new Error('计算书已达到 1,000 份容量上限。')
      const document = createDocument(assembly, next.materials)
      next.documents.push(document)
      assembly.state = 'finalized'
      assembly.updatedAt = now()
    }, '计算书已定稿，构造现为只读。')
    if (saved) editor.hydrate(getData()!, id)
    return saved
  }

  async function reopen(): Promise<boolean> {
    if (!editor.draft.value) return false
    const id = editor.draft.value.id
    const saved = await commit((next) => {
      const assembly = next.assemblies.find((item) => item.id === id)
      if (!assembly || assembly.state !== 'finalized')
        throw new Error('只有已定稿构造可以重新编辑。')
      assembly.state = 'editing'
      assembly.revision += 1
      assembly.updatedAt = now()
    }, '已重新开启编辑，历史计算书保持不变。')
    if (saved) editor.hydrate(getData()!, id)
    return saved
  }

  return { save, finalize, reopen }
}
