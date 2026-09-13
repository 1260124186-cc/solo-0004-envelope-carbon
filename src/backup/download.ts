import type { EnvelopeData } from '../persistence/types'
import { createBackup } from './backup'

export function downloadBackup(data: EnvelopeData): void {
  const blob = new Blob([createBackup(data)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = `围护碳研-设计备份-${new Date().toISOString().slice(0, 10)}.json`
  window.document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
