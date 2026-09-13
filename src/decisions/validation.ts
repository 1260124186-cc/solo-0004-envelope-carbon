import type { Decision } from './types'
import type { CarbonDocument } from '../documents/types'

export function validateDecision(decision: Decision, documents: CarbonDocument[]): string[] {
  const errors: string[] = []
  if (!decision.title.trim() || decision.title.length > 50) {
    errors.push('决策主题需为 1 至 50 个字符。')
  }
  if (decision.options.length > 20) errors.push('一条决策最多引用 20 份计算书。')
  const seen = new Set<string>()
  for (const option of decision.options) {
    if (seen.has(option.documentId)) errors.push('同一份计算书被重复引用。')
    seen.add(option.documentId)
    if (!documents.some((document) => document.id === option.documentId)) {
      errors.push('决策引用的计算书不存在，请重新选择。')
    }
    if (option.rejectedReason.length > 1000) errors.push('暂不采用的原因最多 1,000 个字符。')
  }
  if (
    decision.chosenDocumentId &&
    !decision.options.some((option) => option.documentId === decision.chosenDocumentId)
  ) {
    errors.push('被选中的方案需来自引用的计算书。')
  }
  if (decision.rationale.length > 2000) errors.push('选择理由最多 2,000 个字符。')
  if (decision.verify.length > 2000) errors.push('待核实条件最多 2,000 个字符。')
  return errors
}

export function confirmFindings(decision: Decision, documents: CarbonDocument[]): string[] {
  const errors = validateDecision(decision, documents)
  if (decision.options.length < 2) errors.push('请至少引用两份计算书，再确认结论。')
  if (!decision.chosenDocumentId) errors.push('请指明被选中的方案。')
  if (!decision.rationale.trim()) errors.push('请填写选择理由。')
  for (const option of decision.options) {
    if (option.documentId === decision.chosenDocumentId || option.rejectedReason.trim()) continue
    const document = documents.find((item) => item.id === option.documentId)
    const name = document
      ? `${document.assembly.name} · 修订 ${document.assembly.revision}`
      : '未命名方案'
    errors.push(`请填写暂不采用「${name}」的原因。`)
  }
  return errors
}

export function requireDraftDecision(decision: Decision): void {
  if (decision.state !== 'draft') {
    throw new Error('决策结论已确认，不能直接改写；请建立新的修订。')
  }
}
