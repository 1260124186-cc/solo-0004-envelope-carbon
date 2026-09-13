import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mount, VueWrapper } from '@vue/test-utils'
import App from '../src/App.vue'
import { persistenceKey } from '../src/persistence/types'

// 页面层代表性流程：不直接调用任何内部函数，
// 从真实输入出发，经过即时结果、保存、刷新恢复，直到查看冻结计算书。

async function tick(): Promise<void> {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

function normalizedButton(wrapper: VueWrapper, text: string) {
  const matches = findNormalizedButtons(wrapper, text)
  if (matches.length !== 1) {
    throw new Error(`期望唯一按钮「${text}」，实际找到 ${matches.length} 个。`)
  }
  return matches[0]
}

function hasNormalizedButton(wrapper: VueWrapper, text: string): boolean {
  return findNormalizedButtons(wrapper, text).length === 1
}

function findNormalizedButtons(wrapper: VueWrapper, text: string) {
  const target = text.replace(/\s/g, '')
  return wrapper.findAll('button').filter((button) => {
    return button.text().replace(/\s/g, '') === target
  })
}

async function setByLabel(wrapper: VueWrapper, label: string, value: string): Promise<void> {
  const input = wrapper.find(
    `label input[aria-label="${label}"], label textarea[aria-label="${label}"]`,
  )
  if (input.exists()) {
    ;(input.element as HTMLInputElement).value = value
    input.element.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    return
  }
  const labels = wrapper.findAll('label')
  const owner = labels.find((item) => item.text().replace(/\s/g, '').includes(label))
  if (!owner) throw new Error(`找不到标注为「${label}」的输入框。`)
  const control = owner.find('input, textarea')
  if (!control.exists()) throw new Error(`标注「${label}」内没有输入框。`)
  ;(control.element as HTMLInputElement).value = value
  control.element.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

async function selectByAriaLabel(
  wrapper: VueWrapper,
  ariaLabel: string,
  valueLabel: string,
): Promise<void> {
  const select = wrapper.find(`select[aria-label="${ariaLabel}"]`)
  if (!select.exists()) throw new Error(`找不到标注为「${ariaLabel}」的下拉框。`)
  const option = select
    .findAll('option')
    .find((item) => item.text().replace(/\s/g, '') === valueLabel.replace(/\s/g, ''))
  if (!option) throw new Error(`下拉框「${ariaLabel}」中没有选项「${valueLabel}」。`)
  ;(select.element as HTMLSelectElement).value = (option.element as HTMLOptionElement).value
  select.element.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('页面代表性流程：输入 → 保存 → 刷新恢复 → 定稿查看', () => {
  it('用户新建双层构造，输入与即时结果一致；保存后刷新仍可恢复并定稿查看', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    await tick()
    // 首屏展示种子构造的即时结果
    expect(wrapper.find('[data-check="intensity"]').text()).toBe('90.1')

    await normalizedButton(wrapper, '＋ 新建构造').trigger('click')
    await nextTick()
    // 空构造没有即时结果，保存按钮不可用
    expect(wrapper.find('[data-check="intensity"]').exists()).toBe(false)
    expect((normalizedButton(wrapper, '保存构造').element as HTMLButtonElement).disabled).toBe(true)

    await setByLabel(wrapper, '构造名称', '页面双层构造')

    await selectByAriaLabel(wrapper, '添加构造层', '普通混凝土')
    await normalizedButton(wrapper, '＋ 添加这一层').trigger('click')
    await nextTick()
    await selectByAriaLabel(wrapper, '添加构造层', '石膏板')
    await normalizedButton(wrapper, '＋ 添加这一层').trigger('click')
    await nextTick()

    // 默认结构层 200mm 过厚，按输入调整为与冒烟一致的教学数值
    await setByLabel(wrapper, '第 1 层厚度', '100')
    await setByLabel(wrapper, '第 1 层损耗', '0')
    await setByLabel(wrapper, '第 2 层厚度', '12.5')
    await setByLabel(wrapper, '第 2 层损耗', '3')
    // 石膏板参考寿命 25 年会产生 2 次替换；这里对齐到 60 年边界以核对无替换口径
    await setByLabel(wrapper, '第 2 层寿命', '60')
    await tick()

    // 混凝土 31.2；石膏 10×0.26×1.03 = 2.678，合计 33.878 → 33.88
    const intensity = wrapper.find('[data-check="intensity"]')
    expect(intensity.text()).toBe('33.88')
    // R = 0.15 + 0.1/1.74 + 0.0125/0.22 ≈ 0.2642；U ≈ 3.78
    expect(wrapper.find('.thermal-result strong').text()).toBe('3.78')

    // 非法厚度时展示物理校验且禁止保存
    await setByLabel(wrapper, '第 1 层厚度', '0')
    await tick()
    expect(wrapper.text()).toContain('第 1 层厚度需在 0.1 至 2,000 毫米之间。')
    expect((normalizedButton(wrapper, '保存构造').element as HTMLButtonElement).disabled).toBe(true)

    await setByLabel(wrapper, '第 1 层厚度', '100')
    await tick()
    expect(wrapper.find('[data-check="intensity"]').text()).toBe('33.88')

    await normalizedButton(wrapper, '保存构造').trigger('click')
    await tick()
    expect(wrapper.text()).toContain('构造已保存。')
    expect(wrapper.text()).toContain('已保存 · 修订 1')
    const stored = JSON.parse(localStorage.getItem(persistenceKey) as string)
    expect(stored.assemblies.some((item: { name: string }) => item.name === '页面双层构造')).toBe(
      true,
    )

    // 模拟浏览器刷新：销毁整棵组件树后重新挂载，从存储恢复
    wrapper.unmount()
    const reloaded = mount(App, { attachTo: document.body })
    await tick()
    await selectByAriaLabel(reloaded, '当前构造', '页面双层构造 · 编辑中')
    await tick()

    expect(reloaded.find('[data-check="intensity"]').text()).toBe('33.88')
    const thickness = reloaded.get<HTMLInputElement>('input[aria-label="第 1 层厚度"]').element
    expect(thickness.value).toBe('100')

    // 页面内定稿，随后在计算书页查看冻结结果
    await normalizedButton(reloaded, '生成定稿').trigger('click')
    await tick()
    expect(reloaded.text()).toContain('计算书已定稿，构造现为只读。')
    expect(reloaded.find('[data-check="frozen-intensity"]').text()).toBe('33.88')
    expect(reloaded.text()).toContain('修订 1')

    // 回到构造编辑页，定稿构造的表单字段集必须带禁用标记
    // （jsdom 不实现 fieldset disabled 向后代控件的传播，真实浏览器由冒烟覆盖）
    await normalizedButton(reloaded, '01 构造编辑').trigger('click')
    await tick()
    expect(reloaded.get('.assembly-fields').attributes('disabled')).toBeDefined()
    expect(reloaded.get('fieldset[aria-label="第 1 层"]').attributes('disabled')).toBeDefined()
    expect(hasNormalizedButton(reloaded, '保存构造')).toBe(false)
    expect(hasNormalizedButton(reloaded, '重新开启编辑')).toBe(true)

    // 再回到计算书页确认下载入口与冻结数值仍在
    await normalizedButton(reloaded, '03 计算书').trigger('click')
    await tick()
    expect(reloaded.find('[data-check="frozen-intensity"]').text()).toBe('33.88')
    expect(hasNormalizedButton(reloaded, '下载计算书')).toBe(true)

    reloaded.unmount()
  })
})
