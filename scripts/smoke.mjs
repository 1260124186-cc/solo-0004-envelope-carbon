import { preview } from 'vite'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const workflow = process.argv[2]
if (!['compose', 'compare', 'document', 'template'].includes(workflow)) {
  throw new Error('请指定 compose、compare、document 或 template 流程。')
}
const watchdog = setTimeout(() => {
  console.error('页面冒烟检查超过 60 秒。')
  process.exit(1)
}, 60000)
const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: false } })
let browser
try {
  const address = server.httpServer.address()
  if (!address || typeof address === 'string') throw new Error('预览地址不可用。')
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  })
  const context = await browser.newContext({ viewport: { width: 1360, height: 1000 } })
  const page = await context.newPage()
  page.setDefaultTimeout(8000)
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto(`http://127.0.0.1:${address.port}`)
  const button = (name) => page.getByRole('button', { name, exact: true })
  const text = (value) => page.getByText(value, { exact: true })
  const intensity = page.locator('[data-check="intensity"]')
  await intensity.waitFor()
  assert.equal(await intensity.innerText(), '90.1')

  if (workflow === 'compose') {
    await button('04 材料参数').click()
    await button('＋ 自定义材料').click()
    await page.getByLabel('材料名称', { exact: true }).fill('试算保温物性')
    await page.getByLabel('参数来源', { exact: true }).fill('冒烟流程教学参数')
    await button('保存材料参数').click()
    await text('自定义材料已保存，可在构造中选用。').waitFor()
    await button('01 构造编辑').click()
    assert.equal(await button('保存构造').isEnabled(), false)

    await button('＋ 新建构造').click()
    await page.getByLabel('构造名称', { exact: true }).fill('清水构造')
    await page.getByLabel('添加构造层', { exact: true }).selectOption({ label: '普通混凝土' })
    await button('＋ 添加这一层').click()
    await page.getByLabel('第 1 层厚度', { exact: true }).fill('100')
    await page.getByLabel('第 1 层损耗', { exact: true }).fill('0')
    assert.equal(await intensity.innerText(), '31.2')
    await page.getByLabel('第 1 层厚度', { exact: true }).fill('0')
    await text('第 1 层厚度需在 0.1 至 2,000 毫米之间。').waitFor()
    assert.equal(await button('保存构造').isEnabled(), false)
    await page.getByLabel('第 1 层厚度', { exact: true }).fill('100')
    await button('保存构造').click()
    await text('构造已保存。').waitFor()
    await page.reload()
    await page.getByLabel('当前构造', { exact: true }).selectOption({ label: '清水构造 · 编辑中' })
    assert.equal(await intensity.innerText(), '31.2')
    assert.equal(await page.getByLabel('第 1 层厚度', { exact: true }).inputValue(), '100')
  }

  if (workflow === 'compare') {
    await button('复制为替代方案').click()
    await page.getByLabel('构造名称', { exact: true }).fill('木纤维替代构造')
    await page.getByLabel('第 2 层材料', { exact: true }).selectOption({ label: '木纤维保温板' })
    await button('保存构造').click()
    await text('构造已保存。').waitFor()
    await button('02 方案比较').click()
    await page.locator('[data-check="carbon-delta"]').waitFor()
    assert.equal(await page.locator('[data-check="carbon-delta"]').innerText(), '-11.54')
    await button('01 构造编辑').click()
    await page.getByLabel('构造面积（平方米）', { exact: true }).fill('200')
    await button('保存构造').click()
    await text('构造已保存。').waitFor()
    await button('02 方案比较').click()
    await text('构造面积不同，请先统一计算口径。').waitFor()
    await button('将替代构造统一为基准口径').click()
    await text('替代构造已按基准统一部位、面积和年限。').waitFor()
    assert.equal(await page.locator('[data-check="carbon-delta"]').innerText(), '-11.54')
  }

  if (workflow === 'document') {
    await button('生成定稿').click()
    await text('计算书已定稿，构造现为只读。').waitFor()
    const frozen = page.locator('[data-check="frozen-intensity"]')
    assert.equal(await frozen.innerText(), '90.1')
    const pendingDownload = page.waitForEvent('download')
    await button('下载计算书').click()
    const download = await pendingDownload
    assert.match(download.suggestedFilename(), /计算书-1\.txt$/)
    const stream = await download.createReadStream()
    let output = ''
    for await (const chunk of stream) output += chunk.toString('utf8')
    assert.ok(output.includes('生命周期强度：90.1'))
    await button('01 构造编辑').click()
    assert.equal(await page.getByLabel('构造名称', { exact: true }).isEnabled(), false)
    await button('重新开启编辑').click()
    await text('已重新开启编辑，历史计算书保持不变。').waitFor()
    await page.getByLabel('第 2 层厚度', { exact: true }).fill('200')
    await button('保存构造').click()
    await text('构造已保存。').waitFor()
    assert.notEqual(await intensity.innerText(), '90.1')
    await button('03 计算书').click()
    assert.equal(await frozen.innerText(), '90.1')
    await page.reload()
    await button('03 计算书').click()
    assert.equal(await frozen.innerText(), '90.1')
  }
  if (workflow === 'template') {
    // 由当前构造截取层组合保存为模板，不携带面积、定稿状态与计算书。
    await button('存为构造模板').click()
    await page.getByLabel('模板名称', { exact: true }).fill('冒烟外墙模板')
    await page.getByLabel('使用说明', { exact: true }).fill('冒烟流程模板说明')
    await button('保存构造模板').click()
    await text('构造模板已保存。').waitFor()

    // 查找：按名称过滤，并统计模板总数（含初始模板）。
    await page.getByPlaceholder('模板名称或使用说明').fill('冒烟外墙模板')
    await text('1 / 2 个模板').waitFor()

    // 先预览，再生成独立的编辑中构造（保持筛选，使模板卡片唯一）。
    await button('预览并套用').click()
    await page.getByText('材料层组合（室外到室内）· 共 4 层').waitFor()
    await button('生成独立构造').click()
    await page.getByText('已由模板「冒烟外墙模板」生成独立的编辑中构造').waitFor()
    assert.equal(
      await page.getByLabel('构造名称', { exact: true }).inputValue(),
      '模板 · 冒烟外墙模板',
    )
    assert.equal(await page.getByLabel('第 2 层厚度', { exact: true }).inputValue(), '100')
    assert.equal(await button('＋ 新建构造').isVisible(), true)
    assert.equal(await button('复制为替代方案').isVisible(), true)
    await button('保存构造').click()
    await text('构造已保存。').waitFor()
    await page.reload()
    await page
      .getByLabel('当前构造', { exact: true })
      .selectOption({ label: '模板 · 冒烟外墙模板 · 编辑中' })
    assert.equal(await page.getByLabel('第 2 层厚度', { exact: true }).inputValue(), '100')

    // 修改模板不影响已生成的构造。
    await button('05 构造模板').click()
    await page.getByPlaceholder('模板名称或使用说明').fill('冒烟外墙模板')
    await button('修改').click()
    await page.getByLabel('第 2 层厚度', { exact: true }).fill('160')
    await button('保存模板修改').click()
    await text('构造模板已更新，已由它生成的构造保持不变。').waitFor()
    await button('01 构造编辑').click()
    await page
      .getByLabel('当前构造', { exact: true })
      .selectOption({ label: '模板 · 冒烟外墙模板 · 编辑中' })
    assert.equal(await page.getByLabel('第 2 层厚度', { exact: true }).inputValue(), '100')

    // 材料引用不可用：存储中构造一个缺失引用，解码仍允许，套用时必须阻断并指出层序。
    await page.evaluate((key) => {
      const saved = JSON.parse(localStorage.getItem(key))
      const target = saved.templates.find((item) => item.name === '冒烟外墙模板')
      target.layers[0].materialId = 'env-missing-smoke'
      saved.stamp = 'smoke-broken-template'
      localStorage.setItem(key, JSON.stringify(saved))
    }, 'solo-0004-envelope-carbon:design:v1')
    await page.reload()
    await button('05 构造模板').click()
    await page.getByPlaceholder('模板名称或使用说明').fill('冒烟外墙模板')
    await page.getByText('第 1 层材料引用不可用，暂不能套用。').waitFor()
    await button('预览并套用').click()
    await page.getByText('材料引用不可用，无法直接套用').waitFor()
    await page.getByText('第 1 层引用的材料（env-missing-smoke）已不存在').waitFor()
    assert.equal(await button('生成独立构造').isDisabled(), true)
  }
  assert.deepEqual(pageErrors, [])
  await context.close()
  console.log(`页面流程通过：${workflow}`)
} finally {
  await browser?.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
  clearTimeout(watchdog)
}
