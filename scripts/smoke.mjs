import { preview } from 'vite'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const workflow = process.argv[2]
if (!['compose', 'compare', 'document', 'takeoff'].includes(workflow)) {
  throw new Error('请指定 compose、compare、document 或 takeoff 流程。')
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
  if (workflow === 'takeoff') {
    const buildConcrete = async (name, area, years, thickness) => {
      await button('＋ 新建构造').click()
      await page.getByLabel('构造名称', { exact: true }).fill(name)
      await page.getByLabel('构造面积（平方米）', { exact: true }).fill(String(area))
      await page.getByLabel('计算年限（年）', { exact: true }).fill(String(years))
      await page.getByLabel('添加构造层', { exact: true }).selectOption({ label: '普通混凝土' })
      await button('＋ 添加这一层').click()
      await page.getByLabel('第 1 层厚度', { exact: true }).fill(String(thickness))
      await page.getByLabel('第 1 层损耗', { exact: true }).fill('0')
      await button('保存构造').click()
      await text('构造已保存。').waitFor()
    }
    await buildConcrete('清单试算 · 百年', 50, 100, 100)
    await buildConcrete('清单试算 · 三十年', 20, 30, 200)
    await button('05 材料清单').click()
    await page.locator('[data-check="caliber-warning"]').waitFor()
    await text('已选 3 / 3').waitFor()
    await button('按材料汇总').click()
    const concreteBlock = page
      .locator('.material-block', {
        hasText: '普通混凝土',
      })
      .first()
    await concreteBlock.waitFor()
    const caliberRows = concreteBlock.locator('table').first().locator('tbody tr')
    assert.equal(await caliberRows.count(), 3)
    assert.match(await concreteBlock.innerText(), /不混算/)
    const pendingDownload = page.waitForEvent('download')
    await page.locator('[data-check="takeoff-download"]').click()
    const download = await pendingDownload
    const stream = await download.createReadStream()
    let output = ''
    for await (const chunk of stream) output += chunk.toString('utf8')
    assert.match(download.suggestedFilename(), /材料用量清单-.*\.txt$/)
    assert.ok(output.includes('口径合计（按计算年限分组）'))
    assert.ok(output.includes('替换与生命周期隐含碳不在构造间混算'))
    assert.ok(output.includes('庭院样房 · 岩棉外墙'))
    assert.ok(output.includes('清单试算 · 百年'))
    assert.ok(output.includes('清单试算 · 三十年'))
    // 30 年口径：混凝土寿命 60 年，恰处边界不替换，替换碳为 0；200mm × 20㎡ = 4 立方米。
    const anchor30 = output.indexOf('口径小计 · 30 年（清单试算 · 三十年）')
    assert.ok(anchor30 > -1)
    const slice30 = output.slice(anchor30, anchor30 + 400)
    assert.match(slice30, /体积 4 立方米｜净质量 9,600 千克/)
    assert.match(slice30, /初始 1,248｜替换 0｜生命周期 1,248/)
    // 100 年口径：替换 1 次；替换与生命周期合计只含 50㎡ 那个构造。
    const anchor100 = output.indexOf('口径小计 · 100 年（清单试算 · 百年）')
    assert.ok(anchor100 > -1)
    const slice100 = output.slice(anchor100, anchor100 + 400)
    assert.match(slice100, /体积 5 立方米｜净质量 12,000 千克/)
    assert.match(slice100, /初始 1,560｜替换 1,560｜生命周期 3,120/)
  }

  assert.deepEqual(pageErrors, [])
  await context.close()
  console.log(`页面流程通过：${workflow}`)
} finally {
  await browser?.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
  clearTimeout(watchdog)
}
