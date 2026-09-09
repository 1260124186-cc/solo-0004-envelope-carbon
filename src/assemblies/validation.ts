import type { Assembly, Finding } from './types'
import type { Material } from '../materials/types'

export function inRange(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

export function validateAssembly(assembly: Assembly, materials: Material[]): Finding[] {
  const findings: Finding[] = []
  const add = (path: string, text: string) => findings.push({ path, text })
  if (!assembly.name.trim() || assembly.name.length > 50) {
    add('name', '构造名称需为 1 至 50 个字符。')
  }
  if (!['wall', 'roof', 'floor'].includes(assembly.surface)) {
    add('surface', '请选择有效的建筑部位。')
  }
  if (!inRange(assembly.area, 0.1, 1000000)) {
    add('area', '构造面积需在 0.1 至 1,000,000 平方米之间。')
  }
  if (!inRange(assembly.years, 1, 150) || !Number.isInteger(assembly.years)) {
    add('years', '计算年限需为 1 至 150 的整数。')
  }
  if (!inRange(assembly.carbonLimit, 1, 100000)) {
    add('carbonLimit', '碳强度目标需在 1 至 100,000 之间。')
  }
  if (!inRange(assembly.thermalLimit, 0.01, 10)) {
    add('thermalLimit', '传热系数上限需在 0.01 至 10 之间。')
  }
  if (assembly.note.length > 1000) add('note', '设计说明最多 1,000 个字符。')
  if (!assembly.layers.length) add('layers', '请至少添加一个构造层。')
  if (assembly.layers.length > 20) add('layers', '单个构造最多包含 20 层。')
  const ids = new Set<string>()
  assembly.layers.forEach((layer, index) => {
    const prefix = `第 ${index + 1} 层`
    const path = `layers.${layer.id}`
    if (ids.has(layer.id)) add(path, `${prefix}的标识重复。`)
    ids.add(layer.id)
    if (!materials.some((material) => material.id === layer.materialId)) {
      add(path, `${prefix}引用的材料不存在。`)
    }
    if (!inRange(layer.thickness, 0.1, 2000)) {
      add(path, `${prefix}厚度需在 0.1 至 2,000 毫米之间。`)
    }
    if (!inRange(layer.loss, 0, 50)) {
      add(path, `${prefix}损耗率需在 0 至 50% 之间。`)
    }
    if (!inRange(layer.lifespan, 1, 150) || !Number.isInteger(layer.lifespan)) {
      add(path, `${prefix}替换寿命需为 1 至 150 的整数。`)
    }
  })
  return findings
}

export function requireEditable(assembly: Assembly): void {
  if (assembly.state !== 'editing') {
    throw new Error('构造已定稿，请先重新开启编辑。')
  }
}
