import type { EnvelopeData } from './types'
import { referenceMaterials } from '../materials/catalogue'
import { createAssembly } from '../assemblies/factory'
import { clone } from '../shared/identity'

export function seedData(): EnvelopeData {
  const assembly = createAssembly('庭院样房 · 岩棉外墙')
  assembly.id = 'envelope-courtyard'
  assembly.revision = 1
  assembly.updatedAt = '2026-01-01T00:00:00.000Z'
  assembly.note = '以外墙标准段为设计单元，研究材料替换对隐含碳与热阻的影响。'
  assembly.layers = [
    { id: 'ply-exterior', materialId: 'env-lime', thickness: 20, loss: 5, lifespan: 20 },
    { id: 'ply-insulation', materialId: 'env-mineral', thickness: 100, loss: 3, lifespan: 30 },
    { id: 'ply-body', materialId: 'env-aerated', thickness: 200, loss: 3, lifespan: 60 },
    { id: 'ply-interior', materialId: 'env-gypsum', thickness: 12.5, loss: 3, lifespan: 25 },
  ]
  return {
    schema: 1,
    stamp: 'initial',
    assemblies: [assembly],
    materials: clone(referenceMaterials),
    documents: [],
    comparisons: [],
  }
}
