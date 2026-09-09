import type { EnvelopeData } from './types'
import { persistenceKey } from './types'
import { seedData } from './seed'
import { decode } from './decode'
import { clone, newId } from '../shared/identity'

export function readData(): EnvelopeData {
  const raw = localStorage.getItem(persistenceKey)
  return raw === null ? seedData() : decode(raw)
}

export async function commitData(
  expectedStamp: string,
  change: (data: EnvelopeData) => void,
): Promise<EnvelopeData> {
  if (!navigator.locks) {
    throw new Error('当前浏览器无法提供安全写入，请使用新版浏览器并通过本机地址或安全连接访问。')
  }
  return navigator.locks.request(persistenceKey, () => {
    const latest = readData()
    if (latest.stamp !== expectedStamp) {
      throw new Error('另一标签页已修改设计。请重新加载保存版本，再重试本次修改。')
    }
    const candidate = clone(latest)
    change(candidate)
    candidate.stamp = newId('revision')
    const raw = JSON.stringify(candidate)
    decode(raw)
    try {
      localStorage.setItem(persistenceKey, raw)
    } catch {
      throw new Error('浏览器保存失败，可能空间不足或存储被禁用。本次修改仍保留在编辑区。')
    }
    return candidate
  })
}
