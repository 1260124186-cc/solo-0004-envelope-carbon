import type { Material } from '../materials/types'
import type { EnvelopeData } from '../persistence/types'
import { validateMaterial } from '../materials/validation'
import { clone, newId } from '../shared/identity'
import type { FeedbackChannel } from './feedback'

type Commit = (change: (next: EnvelopeData) => void, notice: string) => Promise<boolean>

/**
 * 自定义材料目录命令：在提交前完成新建材料的标识、克隆与本地校验，
 * 持久化内的容量与重名约束仍在锁内执行。
 */
export function useMaterialCatalog(commit: Commit, feedback: FeedbackChannel) {
  async function addCustomMaterial(input: Material): Promise<boolean> {
    const candidate = clone({ ...input, id: newId('material'), custom: true })
    const errors = validateMaterial(candidate)
    if (errors.length) {
      feedback.fail(errors[0])
      return false
    }
    return commit((next) => {
      if (next.materials.length >= 500) throw new Error('最多保存 500 种材料。')
      if (next.materials.some((material) => material.name.trim() === candidate.name.trim())) {
        throw new Error('材料名称已存在，请使用可区分的名称。')
      }
      candidate.name = candidate.name.trim()
      next.materials.push(candidate)
    }, '自定义材料已保存，可在构造中选用。')
  }

  return { addCustomMaterial }
}
