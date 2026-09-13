import { describe, expect, it } from 'vitest'
import { createDocument } from '../src/documents/create'
import { makeAssembly, makeLayer, makeMaterial } from './helpers'

describe('计算书冻结', () => {
  it('定稿时冻结材料物性、构造与计算结果，并给出新标识', () => {
    const material = makeMaterial({
      id: 'm-frozen',
      name: '冻结材料',
      density: 2400,
      conductivity: 1.74,
      factor: 0.13,
      lifespan: 60,
    })
    const assembly = makeAssembly([material], {
      id: 'assembly-to-freeze',
      name: '待冻结构造',
      revision: 2,
      years: 60,
      layers: [makeLayer(material, { id: 'ply-frozen', thickness: 100, loss: 0, lifespan: 60 })],
    })

    const document = createDocument(assembly, [material])

    expect(document.id).not.toBe('')
    expect(document.id).not.toBe(assembly.id)
    expect(document.assemblyId).toBe(assembly.id)
    expect(document.assembly.state).toBe('finalized')
    expect(document.assembly.revision).toBe(2)
    expect(document.materials).toHaveLength(1)
    expect(document.materials[0]).toEqual(material)
    expect(document.result.intensity).toBeCloseTo(31.2, 10)
    expect(document.result.layers[0].layerId).toBe('ply-frozen')
  })

  it('只冻结构造实际使用的材料', () => {
    const used = makeMaterial({ id: 'm-used', lifespan: 60 })
    const unused = makeMaterial({ id: 'm-unused', lifespan: 60 })
    const assembly = makeAssembly([used], {
      layers: [makeLayer(used, { lifespan: 60 })],
      years: 60,
    })

    const document = createDocument(assembly, [used, unused])

    expect(document.materials.map((material) => material.id)).toEqual(['m-used'])
  })

  it('冻结后修改内存中的构造与材料不影响计算书内容', () => {
    const material = makeMaterial({ id: 'm-mutable', density: 2400, factor: 0.13, lifespan: 60 })
    const layers = [makeLayer({ ...material }, { thickness: 100, loss: 0, lifespan: 60 })]
    const assembly = makeAssembly([material], {
      id: 'assembly-mutable',
      revision: 1,
      years: 60,
      layers,
    })
    const document = createDocument(assembly, [material])

    assembly.layers[0].thickness = 200
    assembly.name = '已被改名'
    material.factor = 9

    expect(document.assembly.name).toBe('测试构造')
    expect(document.assembly.layers[0].thickness).toBe(100)
    expect(document.materials[0].factor).toBe(0.13)
    expect(document.result.intensity).toBeCloseTo(31.2, 10)
  })
})
