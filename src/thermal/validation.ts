import type { ThermalBasis } from './types'
import { inRange } from '../assemblies/validation'

export function validateBasis(basis: ThermalBasis): string[] {
  const errors: string[] = []
  if (!basis.name.trim() || basis.name.length > 50) {
    errors.push('口径名称需为 1 至 50 个字符。')
  }
  if (!inRange(basis.inner, 0.01, 1)) {
    errors.push('内表面热阻需在 0.01 至 1 平方米·开尔文/瓦之间。')
  }
  if (!inRange(basis.outer, 0.01, 1)) {
    errors.push('外表面热阻需在 0.01 至 1 平方米·开尔文/瓦之间。')
  }
  if (!basis.note.trim() || basis.note.length > 200) {
    errors.push('请填写不超过 200 个字符的依据说明。')
  }
  if (!['active', 'retired'].includes(basis.state)) {
    errors.push('口径状态无效。')
  }
  return errors
}
