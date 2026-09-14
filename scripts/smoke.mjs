import { preview } from 'vite'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const workflow = process.argv[2]
if (!['compose', 'compare', 'document'].includes(workflow)) {
  throw new Error('请指定 compose、compare 或 document 流程。')
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

    // 只有一份计算书时，两版对照给出提示而不是结果。
    await page.locator('[data-check="mode-diff"]').click()
    await page.locator('[data-check="diff-unavailable"]').waitFor()
    assert.equal(await page.locator('[data-check="diff-layer"]').count(), 0)

    // 生成第二份定稿（第 2 层厚度 100 → 200），默认对照最新两版。
    await button('生成定稿').click()
    await text('计算书已定稿，构造现为只读。').waitFor()
    await page.locator('[data-check="diff-layer-param"]').waitFor()
    assert.equal(await page.locator('[data-check="diff-layer-moved"]').count(), 0)
    assert.equal(await page.locator('[data-check="diff-layer-replaced"]').count(), 0)
    assert.notEqual(await page.locator('[data-check="diff-intensity-delta"]').innerText(), '0')

    // 切换查看版本不生成新定稿：两个选择框始终只有两份；选成同一版本给出提示。
    const beforeSelect = page.locator('.diff-selectors select').first()
    const afterSelect = page.locator('.diff-selectors select').nth(1)
    assert.equal(await beforeSelect.locator('option').count(), 2)
    await beforeSelect.selectOption({ index: 0 })
    assert.equal(await beforeSelect.locator('option').count(), 2)
    await page.locator('[data-check="diff-warning"]').waitFor()
    assert.equal(await page.locator('[data-check="diff-layer"]').count(), 0)
    // 恢复成不同版本，对照恢复。
    await beforeSelect.selectOption({ index: 1 })
    await page.locator('[data-check="diff-layer-param"]').waitFor()
    // 再次确认全程没有新增定稿。
    assert.equal(await afterSelect.locator('option').count(), 2)

    // 第三份定稿：仅调整层顺序（第 2 层上移），参数不变。
    await button('重新开启编辑').click()
    await text('已重新开启编辑，历史计算书保持不变。').waitFor()
    await button('上移第 2 层').click()
    await button('保存构造').click()
    await text('构造已保存。').waitFor()
    await button('生成定稿').click()
    await text('计算书已定稿，构造现为只读。').waitFor()
    await page.locator('[data-check="mode-diff"]').click()
    await page.locator('[data-check="diff-layer-moved"]').first().waitFor()
    // 按稳定标识配对：纯调序识别为「顺序调整」，不出现材料替换或参数调整。
    assert.ok((await page.locator('[data-check="diff-layer-moved"]').count()) >= 2)
    assert.equal(await page.locator('[data-check="diff-layer-replaced"]').count(), 0)
    assert.equal(await page.locator('[data-check="diff-layer-param"]').count(), 0)
    // 顺序不影响汇总结果。
    assert.equal(await page.locator('[data-check="diff-intensity-delta"]').innerText(), '0')
    // 按稳定标识配对：互换的是原来第 1、2 层（石灰砂浆、岩棉板），不是按行号当成同层。
    const movedNames = await page
      .locator('.layer-diff')
      .filter({ has: page.locator('[data-check="diff-layer-moved"]') })
      .locator('.layer-diff-name')
      .allInnerTexts()
    assert.ok(movedNames.includes('岩棉板'))
    assert.ok(movedNames.includes('石灰砂浆'))

    // 对照全过程不改写旧版：单版查看最早定稿仍为冻结原值。
    await page.locator('[data-check="mode-single"]').click()
    await page.getByLabel('历史计算书', { exact: true }).selectOption({ index: 2 })
    assert.equal(await frozen.innerText(), '90.1')
  }
  assert.deepEqual(pageErrors, [])
  await context.close()
  console.log(`页面流程通过：${workflow}`)
} finally {
  await browser?.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
  clearTimeout(watchdog)
}
