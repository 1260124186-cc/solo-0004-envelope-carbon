import { preview } from 'vite'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const workflow = process.argv[2]
if (!['compose', 'compare', 'document', 'scheme'].includes(workflow)) {
  throw new Error('请指定 compose、compare、document 或 scheme 流程。')
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
    await button('04 计算书').click()
    assert.equal(await frozen.innerText(), '90.1')
    await page.reload()
    await button('04 计算书').click()
    assert.equal(await frozen.innerText(), '90.1')
  }
  if (workflow === 'scheme') {
    await button('03 围护组合').click()
    await button('＋ 新建围护组合').click()
    await page.getByLabel('组合名称', { exact: true }).fill('冒烟组合方案')

    await page.getByLabel('从已保存构造中选择', { exact: true }).selectOption({ index: 1 })
    await button('＋ 加入组合').click()
    await page.getByLabel('从已保存构造中选择', { exact: true }).selectOption({ index: 2 })
    await button('＋ 加入组合').click()

    // 三个构造分别为 60、50、60 年，年限不一致必须明确阻止混算。
    await page.getByLabel('从已保存构造中选择', { exact: true }).selectOption({ index: 1 })
    await button('＋ 加入组合').click()
    await text('计算年限不一致，不能直接混算总量。').waitFor()
    assert.equal(await page.locator('[data-check="scheme-intensity"]').count(), 0)

    // 移除 50 年屋面后，外墙与楼板同为 60 年，可以给出总量与平均强度。
    await page.getByRole('button', { name: '从组合中移除 庭院样房 · 泡沫玻璃屋面' }).click()
    const schemeIntensity = page.locator('[data-check="scheme-intensity"]')
    await schemeIntensity.waitFor()
    await page.locator('[id^="area-"]').first().fill('300')
    assert.equal(await schemeIntensity.innerText(), '94.25')
    assert.match(await page.locator('[data-check="scheme-total"]').innerText(), /^47,127(\.0+)?\s/)

    await button('保存组合').click()
    await text('围护组合已保存，引用版本与面积均已固定。').waitFor()
    await page.reload()
    await button('03 围护组合').click()
    assert.equal(await schemeIntensity.innerText(), '94.25')

    // 修改被引用的原构造：已保存组合不得被悄悄改变，需用户显式选择。
    await button('01 构造编辑').click()
    await page.getByLabel('当前构造', { exact: true }).selectOption({
      label: '庭院样房 · 混凝土楼板 · 编辑中',
    })
    await page.getByLabel('第 3 层厚度', { exact: true }).fill('200')
    await button('保存构造').click()
    await text('构造已保存。').waitFor()
    await button('03 围护组合').click()
    assert.equal(await schemeIntensity.innerText(), '94.25')
    await text('部位「庭院样房 · 混凝土楼板」引用的构造后来被修改了。').waitFor()

    // 保留冻结版本：结果不变，保存后提示消失。
    await button('保留冻结版本').click()
    await button('保存组合').click()
    await text('围护组合已保存，引用版本与面积均已固定。').waitFor()
    await page.reload()
    await button('03 围护组合').click()
    assert.equal(await schemeIntensity.innerText(), '94.25')
    assert.equal(await page.getByText('引用的构造后来被修改了', { exact: false }).count(), 0)

    // 再次修改原构造后提示应重新出现；选择更新引用，结果按新版本重算。
    await button('01 构造编辑').click()
    await page.getByLabel('当前构造', { exact: true }).selectOption({
      label: '庭院样房 · 混凝土楼板 · 编辑中',
    })
    await page.getByLabel('第 3 层厚度', { exact: true }).fill('150')
    await button('保存构造').click()
    await text('构造已保存。').waitFor()
    await button('03 围护组合').click()
    await text('部位「庭院样房 · 混凝土楼板」引用的构造后来被修改了。').waitFor()
    await button('更新为当前版本').click()
    await button('保存组合').click()
    await text('围护组合已保存，引用版本与面积均已固定。').waitFor()
    assert.match(await page.locator('[data-check="scheme-total"]').innerText(), /^45,198\.84\s/)
  }
  assert.deepEqual(pageErrors, [])
  await context.close()
  console.log(`页面流程通过：${workflow}`)
} finally {
  await browser?.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
  clearTimeout(watchdog)
}
