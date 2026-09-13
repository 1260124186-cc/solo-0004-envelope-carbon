import { describe, expect, it } from 'vitest'
import { calculate, replacementCycles } from '../src/carbon/engine'
import { closeTo, makeAssembly, makeLayer, makeMaterial } from './helpers'

describe('材料质量与损耗计算', () => {
  it('每平方米质量 = 厚度（米）× 密度，初始隐含碳 = 质量 × 碳因子', () => {
    const material = makeMaterial({ density: 2400, factor: 0.13, lifespan: 60 })
    const layer = makeLayer(material, { thickness: 100, loss: 0 })
    const assembly = makeAssembly([material], { layers: [layer], years: 60, area: 100 })

    const result = calculate(assembly, [material])

    expect(result.mass).toBe(240)
    expect(result.initial).toBeCloseTo(31.2, 10)
    expect(result.layers[0].mass).toBe(240)
    expect(result.layers[0].initial).toBeCloseTo(31.2, 10)
    // 寿命整除计算年限时边界年份不替换，替换碳为 0
    expect(result.layers[0].cycles).toBe(0)
    expect(result.replacement).toBe(0)
    expect(result.intensity).toBeCloseTo(31.2, 10)
    expect(result.whole).toBeCloseTo(3120, 10)
  })

  it('施工损耗按 (1 + 损耗率) 放大初始隐含碳，0%、10%、50% 边界均生效', () => {
    const material = makeMaterial({ density: 2400, factor: 0.13, lifespan: 60 })
    for (const [loss, expected] of [
      [0, 31.2],
      [10, 34.32],
      [50, 46.8],
    ] as const) {
      const layer = makeLayer(material, { thickness: 100, loss })
      const assembly = makeAssembly([material], { layers: [layer], years: 60 })
      const result = calculate(assembly, [material])
      expect(result.initial).toBeCloseTo(expected, 10)
    }
  })

  it('多层构造的质量与初始隐含碳逐层求和', () => {
    const concrete = makeMaterial({ id: 'm-concrete', density: 2400, factor: 0.13 })
    const aerated = makeMaterial({ id: 'm-aerated', density: 600, factor: 0.32 })
    const assembly = makeAssembly([concrete, aerated], {
      layers: [
        makeLayer(concrete, { thickness: 100, loss: 0, lifespan: 60 }),
        makeLayer(aerated, { thickness: 200, loss: 0, lifespan: 60 }),
      ],
      years: 60,
    })

    const result = calculate(assembly, [concrete, aerated])

    // 0.1×2400 + 0.2×600 = 240 + 120 = 360 千克/平方米
    expect(result.mass).toBe(360)
    // 240×0.13 + 120×0.32 = 31.2 + 38.4 = 69.6
    expect(result.initial).toBeCloseTo(69.6, 10)
    expect(result.thickness).toBe(300)
    expect(result.layers[1].mass).toBe(120)
  })

  it('引用材料不存在时先被构造校验拦截', () => {
    const material = makeMaterial()
    const assembly = makeAssembly([material])
    expect(() => calculate(assembly, [])).toThrow('引用的材料不存在')
  })
})

describe('替换次数：整除与非整除边界', () => {
  // 替换次数 = ceil(年限 / 寿命) − 1，边界年份不计入新一轮替换
  it.each([
    [60, 60, 0], // 整除：第 60 年到期不触发新一轮
    [120, 60, 1], // 整除：只替换 1 次
    [30, 30, 0],
    [90, 30, 2], // 90/30 整除：第 30、60 年各替换一次
    [59, 60, 0], // 非整除但仍未满一个完整寿命
    [61, 60, 1], // 越过边界年即需要 1 次替换
    [31, 30, 1],
    [121, 60, 2],
    [1, 60, 0],
  ])('年限 %i / 寿命 %i 应为 %i 次', (years, lifespan, expected) => {
    expect(replacementCycles(years, lifespan)).toBe(expected)
  })

  it('完整计算中寿命整除年限时替换碳为零，越过一年则产生一轮替换', () => {
    const material = makeMaterial({ density: 2400, factor: 0.13, lifespan: 60 })
    const atBoundary = makeAssembly([material], {
      layers: [makeLayer(material, { thickness: 100, loss: 0, lifespan: 60 })],
      years: 60,
    })
    const pastBoundary = { ...atBoundary, years: 61 }

    const atResult = calculate(atBoundary, [material])
    const pastResult = calculate(pastBoundary, [material])

    expect(atResult.layers[0].cycles).toBe(0)
    expect(atResult.replacement).toBe(0)
    expect(atResult.intensity).toBeCloseTo(31.2, 10)

    expect(pastResult.layers[0].cycles).toBe(1)
    expect(pastResult.replacement).toBeCloseTo(31.2, 10)
    expect(pastResult.intensity).toBeCloseTo(62.4, 10)
  })

  it('不同寿命的层各自计算替换次数并汇总替换碳', () => {
    const finish = makeMaterial({ id: 'm-finish', density: 1700, factor: 0.12, lifespan: 20 })
    const structure = makeMaterial({ id: 'm-structure', density: 2400, factor: 0.13, lifespan: 60 })
    // 60 年 / 20 年寿命：整除 → 2 次；60 年 / 60 年：0 次
    const assembly = makeAssembly([finish, structure], {
      layers: [
        makeLayer(finish, { thickness: 20, loss: 0, lifespan: 20 }),
        makeLayer(structure, { thickness: 100, loss: 0, lifespan: 60 }),
      ],
      years: 60,
    })

    const result = calculate(assembly, [finish, structure])

    // 面层：0.02×1700×0.12 = 4.08，替换 2 次 → 8.16
    expect(result.layers[0].initial).toBeCloseTo(4.08, 10)
    expect(result.layers[0].cycles).toBe(2)
    expect(result.layers[0].replacement).toBeCloseTo(8.16, 10)
    expect(result.layers[1].cycles).toBe(0)
    expect(result.replacement).toBeCloseTo(8.16, 10)
  })
})

describe('简化热阻与传热系数', () => {
  it('单层热阻叠加 0.11 外表面与 0.04 内表面热阻，传热系数为总热阻倒数', () => {
    // 100mm 混凝土 k=1.74：层热阻 = 0.1/1.74 ≈ 0.0574713
    const material = makeMaterial({ conductivity: 1.74, lifespan: 60 })
    const assembly = makeAssembly([material], {
      layers: [makeLayer(material, { thickness: 100, loss: 0, lifespan: 60 })],
      years: 60,
    })

    const result = calculate(assembly, [material])

    closeTo(result.layers[0].resistance, 0.0574713, 1e-6)
    closeTo(result.resistance, 0.15 + 0.1 / 1.74, 1e-12)
    expect(result.transmittance).toBeCloseTo(1 / result.resistance, 12)
    // 独立数值核对：1 / 0.2074713 ≈ 4.8199
    closeTo(result.transmittance, 4.8199, 1e-3)
  })

  it('多层热阻逐层累加后取倒数', () => {
    const concrete = makeMaterial({ id: 'm-concrete', conductivity: 1.74, lifespan: 60 })
    const aerated = makeMaterial({ id: 'm-aerated', conductivity: 0.18, lifespan: 60 })
    const assembly = makeAssembly([concrete, aerated], {
      layers: [
        makeLayer(concrete, { thickness: 100, loss: 0, lifespan: 60 }),
        makeLayer(aerated, { thickness: 200, loss: 0, lifespan: 60 }),
      ],
      years: 60,
    })

    const result = calculate(assembly, [concrete, aerated])

    // 0.15 + 0.1/1.74 + 0.2/0.18 ≈ 1.3185824；U ≈ 0.7584
    closeTo(result.resistance, 0.15 + 0.1 / 1.74 + 0.2 / 0.18, 1e-12)
    closeTo(result.resistance, 1.3185824, 1e-6)
    expect(result.transmittance).toBeCloseTo(1 / result.resistance, 12)
    closeTo(result.transmittance, 0.7584, 1e-3)
  })

  it('即使构造层热阻极小，也必须包含内外表面热阻', () => {
    const material = makeMaterial({ conductivity: 500, lifespan: 60 })
    const assembly = makeAssembly([material], {
      layers: [makeLayer(material, { thickness: 0.1, loss: 0, lifespan: 60 })],
      years: 60,
    })

    const result = calculate(assembly, [material])

    // 层热阻 = 0.0001/500 = 0.0000002
    expect(result.resistance).toBeGreaterThan(0.15)
    closeTo(result.resistance, 0.15 + 0.0001 / 500, 1e-12)
    closeTo(result.transmittance, 1 / 0.15, 1e-5)
  })

  it('目标判断按包含表面热阻的传热系数与碳强度取等号即通过', () => {
    const insulation = makeMaterial({
      density: 120,
      conductivity: 0.04,
      factor: 1.2,
      lifespan: 30,
    })
    const layer = makeLayer(insulation, { thickness: 100, loss: 0, lifespan: 60 })
    // U = 1/(0.15 + 0.1/0.04) = 1/2.65 ≈ 0.3774；强度 = 0.1×120×1.2 = 14.4
    const base = makeAssembly([insulation], { layers: [layer], years: 60 })

    expect(
      calculate({ ...base, thermalLimit: 0.4, carbonLimit: 14.4 }, [insulation]).thermalPass,
    ).toBe(true)
    expect(
      calculate({ ...base, thermalLimit: 0.4, carbonLimit: 14.4 }, [insulation]).carbonPass,
    ).toBe(true)
    expect(calculate({ ...base, thermalLimit: 0.3 }, [insulation]).thermalPass).toBe(false)
    expect(calculate({ ...base, carbonLimit: 14.3 }, [insulation]).carbonPass).toBe(false)
  })
})
