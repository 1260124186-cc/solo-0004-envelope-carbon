import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useWorkspace } from '../src/workspace/useWorkspace'
import { persistenceKey } from '../src/persistence/types'
import { referenceMaterials } from '../src/materials/catalogue'

// useWorkspace 依赖生命周期钩子，通过最小宿主组件在真实挂载环境中执行。
function mountWorkspace() {
  let workspace: ReturnType<typeof useWorkspace> | undefined
  const Host = defineComponent({
    setup() {
      workspace = useWorkspace()
      return () => h('div', 'host')
    },
  })
  const wrapper = mount(Host)
  if (!workspace) throw new Error('工作区未能完成挂载。')
  return { wrapper, workspace: workspace! }
}

async function flush(): Promise<void> {
  await nextTick()
}

async function waitFor(
  workspace: ReturnType<typeof useWorkspace>,
  predicate: (ws: ReturnType<typeof useWorkspace>) => boolean,
  timeout = 1000,
): Promise<void> {
  const start = Date.now()
  while (!predicate(workspace)) {
    if (Date.now() - start > timeout) throw new Error('等待工作区状态超时。')
    await flush()
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

function concrete(): (typeof referenceMaterials)[number] {
  const found = referenceMaterials.find((material) => material.id === 'env-concrete')
  if (!found) throw new Error('种子缺少普通混凝土材料。')
  return found
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('工作区：刷新恢复', () => {
  it('新建构造、加入真实材料、调整厚度损耗并保存，重载后恢复输入与结果', async () => {
    const { wrapper, workspace } = mountWorkspace()
    await waitFor(workspace, (ws) => ws.data.value !== null)

    workspace.create()
    await flush()
    workspace.addMaterial(concrete())
    await flush()
    workspace.updateLayer(workspace.draft.value!.layers[0].id, {
      thickness: 100,
      loss: 0,
      lifespan: 60,
    })
    workspace.update({ name: '工作区保存恢复构造' })
    await flush()
    expect(workspace.result.value?.intensity).toBeCloseTo(31.2, 10)

    await workspace.save()
    await waitFor(workspace, (ws) => ws.notice.value === '构造已保存。')
    expect(workspace.draft.value?.name).toBe('工作区保存恢复构造')
    expect(workspace.draft.value?.revision).toBe(1)
    expect(localStorage.getItem(persistenceKey)).not.toBeNull()

    // 模拟页面刷新：卸载后重新挂载，从存储恢复
    wrapper.unmount()
    const remounted = mountWorkspace()
    await waitFor(remounted.workspace, (ws) => ws.data.value !== null)
    const id = workspace.draft.value!.id
    remounted.workspace.select(id)
    await waitFor(remounted.workspace, (ws) => ws.draft.value?.id === id)

    expect(remounted.workspace.draft.value?.name).toBe('工作区保存恢复构造')
    expect(remounted.workspace.draft.value?.layers[0].thickness).toBe(100)
    expect(remounted.workspace.draft.value?.layers[0].loss).toBe(0)
    expect(remounted.workspace.result.value?.intensity).toBeCloseTo(31.2, 10)
    remounted.wrapper.unmount()
  })
})

describe('工作区：存储写入失败不提交内存结果', () => {
  it('setItem 失败时给出错误、保留编辑区内容，且保存版本不变；恢复后可重试成功', async () => {
    const { workspace } = mountWorkspace()
    await waitFor(workspace, (ws) => ws.data.value !== null)

    workspace.create()
    await flush()
    workspace.addMaterial(concrete())
    await flush()
    workspace.updateLayer(workspace.draft.value!.layers[0].id, {
      thickness: 100,
      loss: 0,
      lifespan: 60,
    })
    workspace.update({ name: '存储故障构造' })
    await flush()

    const failingSetItem = vi.spyOn(Storage.prototype, 'setItem')
    failingSetItem.mockImplementationOnce(() => {
      throw new DOMException('QuotaExceeded', 'QuotaExceededError')
    })

    await workspace.save()
    await waitFor(workspace, (ws) => ws.error.value.includes('浏览器保存失败'))

    // 内存编辑结果保留：草稿仍在、强度仍可即时计算
    expect(workspace.draft.value?.name).toBe('存储故障构造')
    expect(workspace.result.value?.intensity).toBeCloseTo(31.2, 10)
    expect(workspace.dirty.value).toBe(true)
    // 但没有任何内容落盘
    expect(localStorage.getItem(persistenceKey)).toBeNull()

    // 存储恢复后重试，原内存结果成功提交
    await workspace.save()
    await waitFor(workspace, (ws) => ws.notice.value === '构造已保存。')
    expect(workspace.dirty.value).toBe(false)
    expect(JSON.parse(localStorage.getItem(persistenceKey) as string).assemblies).toHaveLength(2)
  })
})

describe('工作区：两个标签页竞争保存', () => {
  it('一个标签页已保存后，另一个标签页的保存被拒绝，内存与存储都不被覆盖', async () => {
    const tabA = mountWorkspace()
    const tabB = mountWorkspace()
    await Promise.all([
      waitFor(tabA.workspace, (ws) => ws.data.value !== null),
      waitFor(tabB.workspace, (ws) => ws.data.value !== null),
    ])

    tabA.workspace.update({ name: '甲标签页改名' })
    tabB.workspace.update({ name: '乙标签页改名' })
    await flush()

    await tabA.workspace.save()
    await waitFor(tabA.workspace, (ws) => ws.notice.value === '构造已保存。')

    await tabB.workspace.save()
    await waitFor(tabB.workspace, (ws) => ws.error.value.includes('另一标签页已修改设计'))

    // 乙的失败写入不改变存储
    const stored = JSON.parse(localStorage.getItem(persistenceKey) as string)
    expect(stored.assemblies[0].name).toBe('甲标签页改名')
    expect(stored.assemblies[0].revision).toBe(2)
    // 乙自己的内存状态也没有被错误提交覆盖，重新加载后看到甲的版本
    tabB.workspace.load()
    await waitFor(tabB.workspace, (ws) => ws.notice.value === '已重新加载保存版本。')
    expect(tabB.workspace.draft.value?.name).toBe('甲标签页改名')

    tabA.wrapper.unmount()
    tabB.wrapper.unmount()
  })

  it('收到 storage 事件时标记跨标签页变化，重载后标记清除', async () => {
    const { workspace, wrapper } = mountWorkspace()
    await waitFor(workspace, (ws) => ws.data.value !== null)
    expect(workspace.externalChange.value).toBe(false)

    window.dispatchEvent(
      new StorageEvent('storage', { key: persistenceKey, storageArea: localStorage }),
    )
    await flush()
    expect(workspace.externalChange.value).toBe(true)

    workspace.load()
    await waitFor(workspace, (ws) => ws.notice.value === '已重新加载保存版本。')
    expect(workspace.externalChange.value).toBe(false)
    wrapper.unmount()
  })
})

describe('工作区：定稿后继续编辑不改变历史计算书', () => {
  it('定稿生成冻结计算书；重新开启编辑、改厚并再次保存后，历史计算书仍为原值', async () => {
    const { workspace } = mountWorkspace()
    await waitFor(workspace, (ws) => ws.data.value !== null)
    // 种子构造强度为 90.1（90.102），定稿即冻结该结果
    expect(workspace.result.value?.intensity).toBeCloseTo(90.102, 9)

    await workspace.finalize()
    await waitFor(workspace, (ws) => ws.notice.value === '计算书已定稿，构造现为只读。')
    expect(workspace.draft.value?.state).toBe('finalized')
    expect(workspace.selectedDocuments.value).toHaveLength(1)

    const frozen = workspace.selectedDocuments.value[0]
    expect(frozen.result.intensity).toBeCloseTo(90.102, 9)
    expect(frozen.assembly.state).toBe('finalized')

    // 定稿期间直接编辑被忽略
    workspace.updateLayer(frozen.assembly.layers[0].id, { thickness: 1 })
    await flush()
    expect(workspace.draft.value?.layers[0].thickness).toBe(20)

    await workspace.reopen()
    await waitFor(workspace, (ws) => ws.notice.value.includes('已重新开启编辑，历史计算书保持不变'))
    expect(workspace.draft.value?.state).toBe('editing')

    // 改第一层（石灰砂浆 20mm → 40mm）并保存
    workspace.updateLayer(workspace.draft.value!.layers[0].id, { thickness: 40 })
    await flush()
    const changedIntensity = workspace.result.value!.intensity
    expect(changedIntensity).not.toBeCloseTo(90.102, 9)
    await workspace.save()
    await waitFor(workspace, (ws) => ws.notice.value === '构造已保存。')

    // 历史计算书：结构、冻结物性、结果均保持定稿时的值
    expect(workspace.selectedDocuments.value).toHaveLength(1)
    const history = workspace.selectedDocuments.value[0]
    expect(history.id).toBe(frozen.id)
    expect(history.result.intensity).toBeCloseTo(90.102, 9)
    expect(history.assembly.layers[0].thickness).toBe(20)
    expect(history.materials.find((material) => material.id === 'env-lime')?.factor).toBe(0.12)

    // 刷新后历史计算书仍然不变
    workspace.load()
    await waitFor(workspace, (ws) => ws.notice.value === '已重新加载保存版本。')
    expect(workspace.selectedDocuments.value[0].result.intensity).toBeCloseTo(90.102, 9)
  })
})
