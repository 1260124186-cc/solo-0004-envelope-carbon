import type { Assembly, Layer } from '../src/assemblies/types'
import type { Material, MaterialKind } from '../src/materials/types'

let sequence = 0

function nextId(prefix: string): string {
  sequence += 1
  return `${prefix}-test-${sequence}`
}

export function makeMaterial(overrides: Partial<Material> = {}): Material {
  return {
    id: nextId('material'),
    name: `测试材料 ${sequence}`,
    kind: 'structure' as MaterialKind,
    density: 1000,
    conductivity: 0.5,
    factor: 0.2,
    lifespan: 30,
    source: '测试夹具 · 物性来源',
    description: '单元测试用材料',
    custom: true,
    ...overrides,
  }
}

export function makeLayer(material: Material, overrides: Partial<Layer> = {}): Layer {
  return {
    id: nextId('ply'),
    materialId: material.id,
    thickness: 100,
    loss: 0,
    lifespan: material.lifespan,
    ...overrides,
  }
}

export function makeAssembly(materials: Material[], overrides: Partial<Assembly> = {}): Assembly {
  return {
    id: nextId('envelope'),
    name: '测试构造',
    surface: 'wall',
    area: 100,
    years: 60,
    carbonLimit: 150,
    thermalLimit: 0.6,
    note: '',
    // 不回写传入的材料对象，避免层寿命覆盖材料参考寿命
    layers: materials.map((material) => makeLayer({ ...material })),
    state: 'editing',
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function closeTo(actual: number, expected: number, epsilon = 1e-9): void {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`expected ${actual} to be close to ${expected} (epsilon ${epsilon})`)
  }
}
