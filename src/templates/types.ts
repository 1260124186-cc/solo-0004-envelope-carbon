import type { Layer, Surface } from '../assemblies/types'

/**
 * 模板层只保存材料引用与做法参数，不保留构造层标识；
 * 由模板生成构造时再为每一层分配独立标识。
 */
export type TemplateLayer = Omit<Layer, 'id'>

export interface ConstructionTemplate {
  id: string
  name: string
  surface: Surface
  usage: string
  layers: TemplateLayer[]
  createdAt: string
  updatedAt: string
}

export interface TemplateFinding {
  path: string
  text: string
}

export const templateCapacity = 100
