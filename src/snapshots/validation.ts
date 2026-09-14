import type { Assembly } from '../assemblies/types'
import type { SnapshotInput } from './types'

export function validateSnapshotInput(input: SnapshotInput, assemblies: Assembly[]): string[] {
  const errors: string[] = []
  if (!input.name.trim() || input.name.trim().length > 50) {
    errors.push('阶段名称需为 1 至 50 个字符。')
  }
  if (input.note.length > 500) errors.push('阶段说明最多 500 个字符。')
  if (!input.assemblyIds.length) errors.push('请至少勾选一个已保存的构造。')
  if (input.assemblyIds.length > 100) errors.push('单个阶段快照最多纳入 100 个构造。')
  if (new Set(input.assemblyIds).size !== input.assemblyIds.length) {
    errors.push('同一构造在同一阶段快照中只能纳入一次。')
  }
  if (input.assemblyIds.some((id) => !assemblies.some((assembly) => assembly.id === id))) {
    errors.push('所选构造不在已保存版本中，请重新加载后再试。')
  }
  return errors
}
