import type { Assembly } from '../assemblies/types'
import type { ConstructionTemplate, TemplateLayer } from './types'
import { clone, newId, now } from '../shared/identity'

/** 从一个构造截取材料层组合，不继承面积、名称、定稿状态或历史计算书。 */
export function createTemplate(
  assembly: Assembly,
  name: string,
  surface: Assembly['surface'],
  usage: string,
): ConstructionTemplate {
  const stamp = now()
  return {
    id: newId('tpl'),
    name,
    surface,
    usage,
    layers: clone(
      assembly.layers.map<TemplateLayer>((layer) => ({
        materialId: layer.materialId,
        thickness: layer.thickness,
        loss: layer.loss,
        lifespan: layer.lifespan,
      })),
    ),
    createdAt: stamp,
    updatedAt: stamp,
  }
}

/** 由模板生成一个独立的编辑中构造，与模板不再共享任何对象。 */
export function instantiateTemplate(template: ConstructionTemplate): Assembly {
  const stamp = now()
  return {
    id: newId('envelope'),
    name: `模板 · ${template.name}`.slice(0, 50),
    surface: template.surface,
    area: 100,
    years: 60,
    carbonLimit: 150,
    thermalLimit: 0.6,
    note: '',
    layers: template.layers.map((layer) => ({ ...clone(layer), id: newId('ply') })),
    state: 'editing',
    revision: 0,
    updatedAt: stamp,
  }
}
