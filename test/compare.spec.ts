import type { Assembly } from '../src/assemblies/types'
import { describe, expect, it } from 'vitest'
import { compare, comparableReasons } from '../src/comparison/compare'
import { makeAssembly, makeLayer, makeMaterial } from './helpers'

function pairAssemblies() {
  const material = makeMaterial({
    id: 'm-insulation',
    density: 120,
    conductivity: 0.04,
    factor: 1.2,
    lifespan: 30,
  })
  const baseline = makeAssembly([material], {
    id: 'assembly-baseline',
    name: '基准构造',
    surface: 'wall',
    area: 100,
    years: 60,
    layers: [makeLayer(material, { thickness: 100, loss: 0, lifespan: 60 })],
  })
  const alternative = makeAssembly([material], {
    id: 'assembly-alternative',
    name: '替代构造',
    surface: 'wall',
    area: 100,
    years: 60,
    layers: [makeLayer(material, { thickness: 80, loss: 0, lifespan: 60 })],
  })
  return { material, baseline, alternative }
}

describe('比较的同口径限制（部位 / 面积 / 年限）', () => {
  it('同一条构造不能与自身比较', () => {
    const { baseline } = pairAssemblies()
    expect(comparableReasons(baseline, baseline)).toContain('请选择两个不同的构造。')
    expect(() => compare(baseline, baseline, [])).toThrow('请选择两个不同的构造。')
  })

  it('建筑部位不同、面积不同、年限不同分别给出明确原因', () => {
    const { baseline, alternative } = pairAssemblies()

    expect(comparableReasons(baseline, { ...alternative, surface: 'roof' })).toContain(
      '建筑部位不同，无法直接比较。',
    )
    expect(comparableReasons(baseline, { ...alternative, area: baseline.area + 1 })).toContain(
      '构造面积不同，请先统一计算口径。',
    )
    expect(comparableReasons(baseline, { ...alternative, years: baseline.years + 1 })).toContain(
      '计算年限不同，请先统一计算口径。',
    )

    const allMismatched: Assembly = { ...alternative, surface: 'floor', area: 200, years: 50 }
    expect(comparableReasons(baseline, allMismatched)).toHaveLength(3)
    expect(() => compare(baseline, allMismatched, [])).toThrow('建筑部位不同')
  })

  it('口径一致时才计算差值，方向为替代构造减基准构造', () => {
    const { material, baseline, alternative } = pairAssemblies()

    // 基准 100mm：0.1×120×1.2 = 14.4；替代 80mm：0.08×120×1.2 = 11.52
    const result = compare(baseline, alternative, [material])

    expect(result.baseline.intensity).toBeCloseTo(14.4, 10)
    expect(result.alternative.intensity).toBeCloseTo(11.52, 10)
    expect(result.carbonDelta).toBeCloseTo(-2.88, 10)
    // 总面积相同，整体差值 = 强度差值 × 面积
    expect(result.wholeDelta).toBeCloseTo(-2.88 * 100, 10)
    // 替代更薄 → 热阻更小 → U 值更高
    expect(result.thermalDelta).toBeGreaterThan(0)
    expect(result.percent).toBeCloseTo((-2.88 / 14.4) * 100, 10)
    expect(result.reasons.some((reason) => reason.includes('负值代表减少'))).toBe(true)
  })

  it('基准强度为 0（零碳因子）时不计算百分比，差值仍可用', () => {
    const zeroMaterial = makeMaterial({ id: 'm-zero', factor: 0, lifespan: 60 })
    const baseline = makeAssembly([zeroMaterial], {
      id: 'assembly-zero-baseline',
      layers: [makeLayer(zeroMaterial, { thickness: 100, loss: 0, lifespan: 60 })],
    })
    const alternative = makeAssembly([zeroMaterial], {
      id: 'assembly-zero-alternative',
      layers: [makeLayer(zeroMaterial, { thickness: 120, loss: 0, lifespan: 60 })],
    })

    const result = compare(baseline, alternative, [zeroMaterial])

    expect(result.percent).toBeNull()
    expect(result.carbonDelta).toBe(0)
  })
})
