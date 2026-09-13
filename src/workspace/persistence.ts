import { shallowRef, type ShallowRef } from 'vue'
import type { EnvelopeData } from '../persistence/types'
import { persistenceKey } from '../persistence/types'
import { commitData, readData } from '../persistence/repository'
import type { FeedbackChannel } from './feedback'

export interface PersistenceCoordinator {
  data: ShallowRef<EnvelopeData | null>
  read: () => boolean
  commit: (change: (next: EnvelopeData) => void, notice: string) => Promise<boolean>
  onStorage: (event: StorageEvent) => void
}

/**
 * 持久化提交协调：持有已保存数据集（EnvelopeData），负责读取快照与
 * “互斥锁 + 修订标识核对”的原子提交。提交成功后更新内存快照并清除跨标签页
 * 警示；冲突或写入失败只回写错误反馈，不改动内存状态。
 */
export function usePersistence(feedback: FeedbackChannel): PersistenceCoordinator {
  const data = shallowRef<EnvelopeData | null>(null)

  function read(): boolean {
    try {
      const next = readData()
      data.value = next
      feedback.clearFatal()
      feedback.resetExternalChange()
      feedback.clear()
      return true
    } catch (cause) {
      feedback.markFatal(cause instanceof Error ? cause.message : '无法读取浏览器存储。')
      return false
    }
  }

  async function commit(change: (next: EnvelopeData) => void, notice: string): Promise<boolean> {
    if (!data.value || feedback.busy.value || feedback.fatal.value) return false
    feedback.clear()
    feedback.busy.value = true
    try {
      data.value = await commitData(data.value.stamp, change)
      feedback.resetExternalChange()
      feedback.succeed(notice)
      return true
    } catch (cause) {
      feedback.failFrom(cause, '操作未完成，请重试。')
      return false
    } finally {
      feedback.busy.value = false
    }
  }

  function onStorage(event: StorageEvent): void {
    if (
      event.storageArea === localStorage &&
      (event.key === persistenceKey || event.key === null)
    ) {
      feedback.markExternalChange()
    }
  }

  return { data, read, commit, onStorage }
}
