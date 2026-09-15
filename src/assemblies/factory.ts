import type { Assembly, Layer } from './types'
import type { Material } from '../materials/types'
import { clone, newId, now } from '../shared/identity'

export function createLayer(material: Material): Layer {
  return {
    id: newId('ply'),
    materialId: material.id,
    thickness: material.kind === 'structure' ? 200 : 20,
    loss: 3,
    lifespan: material.lifespan,
  }
}

export function createAssembly(name = '未命名构造'): Assembly {
  return {
    id: newId('envelope'),
    name,
    surface: 'wall',
    area: 100,
    years: 60,
    carbonLimit: 150,
    thermalLimit: 0.6,
    note: '',
    layers: [],
    state: 'editing',
    revision: 0,
    updatedAt: now(),
  }
}

export function duplicateAssembly(original: Assembly): Assembly {
  const copy = clone(original)
  copy.id = newId('envelope')
  copy.name = `${original.name.slice(0, 42)} · 替代`
  copy.layers = copy.layers.map((layer) => ({ ...layer, id: newId('ply') }))
  copy.state = 'editing'
  copy.revision = 0
  copy.updatedAt = now()
  return copy
}

export function moveLayer(layers: Layer[], id: string, direction: -1 | 1): Layer[] {
  const index = layers.findIndex((layer) => layer.id === id)
  const destination = index + direction
  if (index < 0 || destination < 0 || destination >= layers.length) return layers
  return reorderLayers(layers, index, destination)
}

// 只调整层对象在数组中的位置，层本身（材料、厚度、损耗、寿命）原样跟随，不做任何改写。
export function reorderLayers(layers: Layer[], from: number, to: number): Layer[] {
  if (from === to || from < 0 || to < 0 || from >= layers.length || to >= layers.length) {
    return layers
  }
  const copy = [...layers]
  const [moved] = copy.splice(from, 1)
  copy.splice(to, 0, moved)
  return copy
}
