import { preview } from 'vite'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const workflow = process.argv[2]
if (!['compose', 'compare', 'document', 'plan'].includes(workflow)) {
  throw new Error('请指定 compose、compare、document 或 plan 流程。')
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
    await button('05 材料参数').click()
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
  if (workflow === 'plan') {
    await button('04 材料替换计划').click()
    await text('这个构造还没有材料替换计划').waitFor()
    await button('生成并保存计划').click()
    await text('材料替换计划已保存，构造与物性已冻结。').waitFor()
    const planTotal = page.locator('[data-check="plan-total"]')
    await planTotal.waitFor()
    assert.equal(await planTotal.innerText(), '90.1')
    const sheet = page.locator('.plan-sheet')
    assert.equal(await sheet.locator('[data-year="0"]').count(), 4)
    assert.equal(await sheet.locator('[data-year="60"]').count(), 0)
    assert.equal(await sheet.locator('[data-year="20"]').count(), 1)
    assert.equal(await sheet.locator('[data-year="25"]').count(), 1)
    assert.match(await sheet.locator('[data-year-total="20"]').innerText(), /4\.28/)
    assert.match(await sheet.locator('[data-year-total="25"]').innerText(), /2\.68/)
    assert.match(await sheet.locator('[data-year-total="50"]').innerText(), /2\.68/)

    // 同一构造再次生成形成另一份计划
    await button('生成并保存计划').click()
    await text('材料替换计划已保存，构造与物性已冻结。').waitFor()
    const savedPlans = page.getByLabel('已保存计划')
    assert.equal(await savedPlans.locator('option').count(), 2)

    // 增加第二层石膏（同一材料出现在不同层），保存后重新生成；旧计划保持冻结
    await button('01 构造编辑').click()
    await page.getByLabel('添加构造层', { exact: true }).selectOption({ label: '石膏板' })
    await button('＋ 添加这一层').click()
    await page.getByLabel('第 5 层损耗', { exact: true }).fill('0')
    await button('保存构造').click()
    await text('构造已保存。').waitFor()
    await button('04 材料替换计划').click()
    await button('生成并保存计划').click()
    await text('材料替换计划已保存，构造与物性已冻结。').waitFor()
    assert.equal(await savedPlans.locator('option').count(), 3)
    await savedPlans.selectOption({ index: 0 })
    const entries25 = sheet.locator('[data-year="25"]')
    assert.equal(await entries25.count(), 2)
    assert.match(await entries25.nth(0).innerText(), /第 4 层/)
    assert.match(await entries25.nth(1).innerText(), /第 5 层/)
    assert.match(await sheet.locator('[data-year-total="25"]').innerText(), /6\.84/)

    // 切回最早那份计划，仍为修改前的四层冻结记录
    await savedPlans.selectOption({ index: 2 })
    assert.equal(await sheet.locator('[data-year="0"]').count(), 4)
    assert.equal(await sheet.locator('[data-year="25"]').count(), 1)
    assert.match(await sheet.locator('[data-year-total="25"]').innerText(), /2\.68/)
    assert.equal(await planTotal.innerText(), '90.1')

    // 刷新后冻结计划仍然不变
    await page.reload()
    await button('04 材料替换计划').click()
    await savedPlans.selectOption({ index: 2 })
    await planTotal.waitFor()
    assert.equal(await sheet.locator('[data-year="25"]').count(), 1)
    assert.equal(await planTotal.innerText(), '90.1')
  }
  assert.deepEqual(pageErrors, [])
  await context.close()
  console.log(`页面流程通过：${workflow}`)
} finally {
  await browser?.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
  clearTimeout(watchdog)
}
