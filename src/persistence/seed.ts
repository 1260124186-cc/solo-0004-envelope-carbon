import type { EnvelopeData } from './types'
import type { Assembly } from '../assemblies/types'
import { referenceMaterials } from '../materials/catalogue'
import { createAssembly } from '../assemblies/factory'
import { clone } from '../shared/identity'

export function seedData(): EnvelopeData {
  const wall = createAssembly('庭院样房 · 岩棉外墙')
  wall.id = 'envelope-courtyard'
  wall.revision = 1
  wall.updatedAt = '2026-01-01T00:00:00.000Z'
  wall.note = '以外墙标准段为设计单元，研究材料替换对隐含碳与热阻的影响。'
  wall.layers = [
    { id: 'ply-exterior', materialId: 'env-lime', thickness: 20, loss: 5, lifespan: 20 },
    { id: 'ply-insulation', materialId: 'env-mineral', thickness: 100, loss: 3, lifespan: 30 },
    { id: 'ply-body', materialId: 'env-aerated', thickness: 200, loss: 3, lifespan: 60 },
    { id: 'ply-interior', materialId: 'env-gypsum', thickness: 12.5, loss: 3, lifespan: 25 },
  ]

  const roof = createAssembly('庭院样房 · 泡沫玻璃屋面')
  roof.id = 'envelope-courtyard-roof'
  roof.surface = 'roof'
  roof.area = 120
  roof.years = 50
  roof.revision = 1
  roof.updatedAt = '2026-01-01T00:00:00.000Z'
  roof.note = '屋面按 50 年计算期设计，与外墙、楼板年限不同，组合时需分组查看。'
  roof.layers = [
    { id: 'ply-roof-protect', materialId: 'env-concrete', thickness: 40, loss: 5, lifespan: 60 },
    {
      id: 'ply-roof-insulation',
      materialId: 'env-foamglass',
      thickness: 120,
      loss: 3,
      lifespan: 50,
    },
    { id: 'ply-roof-slab', materialId: 'env-concrete', thickness: 200, loss: 3, lifespan: 60 },
    { id: 'ply-roof-plaster', materialId: 'env-lime', thickness: 15, loss: 5, lifespan: 20 },
  ]

  const floor = createAssembly('庭院样房 · 混凝土楼板')
  floor.id = 'envelope-courtyard-floor'
  floor.surface = 'floor'
  floor.area = 200
  floor.revision = 1
  floor.updatedAt = '2026-01-01T00:00:00.000Z'
  floor.note = '楼板按 60 年计算期设计，岩棉层仅计板下保温。'
  floor.layers = [
    { id: 'ply-floor-screed', materialId: 'env-lime', thickness: 40, loss: 5, lifespan: 20 },
    { id: 'ply-floor-insulation', materialId: 'env-mineral', thickness: 30, loss: 3, lifespan: 30 },
    {
      id: 'ply-floor-structure',
      materialId: 'env-concrete',
      thickness: 180,
      loss: 3,
      lifespan: 60,
    },
    { id: 'ply-floor-ceiling', materialId: 'env-gypsum', thickness: 12.5, loss: 3, lifespan: 25 },
  ]

  const assemblies: Assembly[] = [wall, roof, floor]

  return {
    schema: 1,
    stamp: 'initial',
    assemblies,
    materials: clone(referenceMaterials),
    documents: [],
    schemes: [],
  }
}
