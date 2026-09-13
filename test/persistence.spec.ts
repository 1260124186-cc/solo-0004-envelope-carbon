import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { commitData, readData } from '../src/persistence/repository'
import { persistenceKey } from '../src/persistence/types'
import { decode } from '../src/persistence/decode'
import { seedData } from '../src/persistence/seed'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('刷新恢复', () => {
  it('首次读取在无存储时返回种子数据，提交后再次读取能完整恢复', async () => {
    const seeded = readData()
    expect(seeded.stamp).toBe('initial')
    expect(seeded.assemblies).toHaveLength(1)
    expect(seeded.assemblies[0].name).toBe('庭院样房 · 岩棉外墙')

    const stamp = seeded.stamp
    const committed = await commitData(stamp, (data) => {
      data.assemblies[0].name = '刷新后应读到的名字'
      data.assemblies[0].revision = 5
    })

    expect(committed.stamp).not.toBe(stamp)
    expect(committed.assemblies[0].name).toBe('刷新后应读到的名字')

    // 模拟刷新：重新从 localStorage 解码，不依赖任何内存状态
    const reloaded = readData()
    expect(reloaded.stamp).toBe(committed.stamp)
    expect(reloaded.assemblies[0].name).toBe('刷新后应读到的名字')
    expect(reloaded.assemblies[0].revision).toBe(5)

    const raw = localStorage.getItem(persistenceKey)
    expect(raw).not.toBeNull()
    expect(decode(raw as string).assemblies[0].name).toBe('刷新后应读到的名字')
  })

  it('存储为损坏 JSON 时 decode 明确拒绝，不返回残缺数据', () => {
    localStorage.setItem(persistenceKey, '{这不是合法 JSON')
    expect(() => readData()).toThrow('无法读取已保存的设计')
  })
})

describe('存储写入失败不提交内存结果', () => {
  it('localStorage.setItem 抛错时提交被拒绝，原始存储保持不变', async () => {
    const initial = readData()
    const rawBefore = localStorage.getItem(persistenceKey)
    expect(rawBefore).toBeNull()

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    await expect(
      commitData(initial.stamp, (data) => {
        data.assemblies[0].name = '不应落盘的修改'
      }),
    ).rejects.toThrow('浏览器保存失败')

    // 写入失败后存储仍是原始内容（此处为未写入状态），重新读取仍是种子
    expect(localStorage.getItem(persistenceKey)).toBe(rawBefore)
    const reloaded = readData()
    expect(reloaded.assemblies[0].name).toBe('庭院样房 · 岩棉外墙')
    expect(reloaded.stamp).toBe('initial')
  })

  it('失败前构造的候选数据必须能通过 decode 校验，否则不写入', async () => {
    const initial = readData()
    await commitData(initial.stamp, (data) => {
      data.assemblies[0].revision = 3
    })

    const afterFirst = readData()
    const validRaw = localStorage.getItem(persistenceKey) as string

    await expect(
      commitData(afterFirst.stamp, (data) => {
        // 使数据违反存储容量约束；setItem 永远不应被调用
        data.assemblies.length = 201
      }),
    ).rejects.toThrow('存储条目超出当前版本容量')

    expect(localStorage.getItem(persistenceKey)).toBe(validRaw)
  })

  it('浏览器不提供 navigator.locks 时拒绝提交', async () => {
    const initial = readData()
    const locks = navigator.locks
    Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true })
    try {
      await expect(
        commitData(initial.stamp, (data) => {
          data.assemblies[0].name = '没有互斥锁也不允许写入'
        }),
      ).rejects.toThrow('无法提供安全写入')
    } finally {
      Object.defineProperty(navigator, 'locks', { value: locks, configurable: true })
    }
    expect(readData().stamp).toBe('initial')
  })
})

describe('两个标签页竞争保存', () => {
  it('互斥锁内按修订标识核对：先提交者成功，后提交者被拒绝且不覆盖', async () => {
    const tabA = readData()
    const tabB = readData()
    expect(tabA.stamp).toBe(tabB.stamp)

    const fromA = await commitData(tabA.stamp, (data) => {
      data.assemblies[0].name = '甲标签页的修改'
      data.assemblies[0].revision += 1
    })

    // 乙仍持有旧的 stamp，其写入必须因修订标识不一致而失败
    await expect(
      commitData(tabB.stamp, (data) => {
        data.assemblies[0].name = '乙标签页的修改'
      }),
    ).rejects.toThrow('另一标签页已修改设计')

    const stored = readData()
    expect(stored.assemblies[0].name).toBe('甲标签页的修改')
    expect(stored.stamp).toBe(fromA.stamp)
  })

  it('两个并发提交在锁内串行化，只有一个能提交', async () => {
    const sameStart = readData().stamp

    const outcomes = await Promise.allSettled([
      commitData(sameStart, (data) => {
        data.assemblies[0].name = '并发修改一'
        data.assemblies[0].revision += 1
      }),
      commitData(sameStart, (data) => {
        data.assemblies[0].name = '并发修改二'
        data.assemblies[0].revision += 1
      }),
    ])

    const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled')
    const rejected = outcomes.filter((outcome) => outcome.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      message: expect.stringContaining('另一标签页已修改设计'),
    })
    expect(['并发修改一', '并发修改二']).toContain(readData().assemblies[0].name)
  })

  it('收到外部新版本后重新读取即可继续提交', async () => {
    const stale = readData()
    const latest = await commitData(stale.stamp, (data) => {
      data.assemblies[0].name = '外部已保存版本'
    })
    const refreshed = readData()
    expect(refreshed.stamp).toBe(latest.stamp)

    const again = await commitData(refreshed.stamp, (data) => {
      data.assemblies[0].note = '基于最新版本继续修改'
    })
    expect(readData().assemblies[0].name).toBe('外部已保存版本')
    expect(readData().assemblies[0].note).toBe('基于最新版本继续修改')
    expect(again.stamp).not.toBe(latest.stamp)
  })

  it('种子数据未变更时重复读取返回等价内容，避免空存储被误写', () => {
    const first = readData()
    const second = readData()
    expect(second).toEqual(first)
    expect(localStorage.getItem(persistenceKey)).toBeNull()
  })
})

describe('存储校验边界', () => {
  it('保存后的完整数据可经 decode 再校验，包括计算书结果一致性', async () => {
    const { createDocument } = await import('../src/documents/create')
    const { calculate } = await import('../src/carbon/engine')
    const initial = seedData()
    const document = createDocument(initial.assemblies[0], initial.materials)

    const committed = await commitData('initial', (data) => {
      const target = data.assemblies.find((item) => item.id === document.assemblyId)
      expect(target).toBeDefined()
      target!.state = 'finalized'
      data.documents.push(document)
    })

    // decode 在读取时会重新计算并比对冻结结果
    expect(decode(JSON.stringify(committed)).documents[0].result.intensity).toBeCloseTo(
      calculate(committed.documents[0].assembly, committed.documents[0].materials).intensity,
      12,
    )
  })
})
