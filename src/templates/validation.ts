import type { Finding } from '../assemblies/types'
import { inRange } from '../assemblies/validation'
import type { Material } from '../materials/types'
import type { ConstructionTemplate, TemplateLayer } from './types'

/**
 * 结构校验：名称、适用部位、使用说明与各层参数。
 * 材料引用是否仍可解析由 {@link missingTemplateMaterials} 单独判断，
 * 这样存储解码只校验结构，材料缺失在使用模板时阻断。
 */
export function validateTemplate(template: ConstructionTemplate): Finding[] {
  const findings: Finding[] = []
  const add = (path: string, text: string) => findings.push({ path, text })
  if (!template.name.trim() || template.name.length > 50) {
    add('name', '模板名称需为 1 至 50 个字符。')
  }
  if (!['wall', 'roof', 'floor'].includes(template.surface)) {
    add('surface', '请选择有效的适用部位。')
  }
  if (!template.usage.trim() || template.usage.length > 500) {
    add('usage', '使用说明需为 1 至 500 个字符。')
  }
  if (!template.layers.length) add('layers', '模板至少需要保留一个材料层。')
  if (template.layers.length > 20) add('layers', '单个模板最多包含 20 层。')
  template.layers.forEach((layer, index) => {
    const path = `layers.${index}`
    const prefix = `第 ${index + 1} 层`
    if (typeof layer.materialId !== 'string' || !layer.materialId) {
      add(path, `${prefix}缺少材料引用。`)
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

/** 返回材料引用已不可用的模板层序号（从 1 开始）与缺失的材料标识。 */
export function missingTemplateMaterials(
  layers: TemplateLayer[],
  materials: Material[],
): { index: number; materialId: string }[] {
  const missing: { index: number; materialId: string }[] = []
  layers.forEach((layer, index) => {
    if (!materials.some((material) => material.id === layer.materialId)) {
      missing.push({ index: index + 1, materialId: layer.materialId })
    }
  })
  return missing
}

/** 阻断套用模板时的明确提示，逐层指出需要处理的位置。 */
export function unavailableTemplateMessage(layers: TemplateLayer[], materials: Material[]): string {
  const positions = missingTemplateMaterials(layers, materials).map((item) => `第 ${item.index} 层`)
  return `模板材料引用不可用，无法直接套用：${positions.join('、')}的材料需要先处理（恢复材料或在模板中改层）。`
}
