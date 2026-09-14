// 构造厚度始终以毫米存储与计算；本模块只服务输入与展示的口径切换，
// 切换单位不改动任何已存储的构造尺寸。
export type ThicknessUnit = 'mm' | 'm'

export const thicknessUnitLabels: Record<ThicknessUnit, string> = {
  mm: '毫米',
  m: '米',
}

export const thicknessBounds: Record<ThicknessUnit, { min: number; max: number; step: number }> = {
  mm: { min: 0.1, max: 2000, step: 0.1 },
  m: { min: 0.0001, max: 2, step: 0.0001 },
}

export function toUnit(millimeters: number, unit: ThicknessUnit): number {
  return unit === 'm' ? millimeters / 1000 : millimeters
}

export function fromUnit(value: number, unit: ThicknessUnit): number {
  return unit === 'm' ? value * 1000 : value
}
