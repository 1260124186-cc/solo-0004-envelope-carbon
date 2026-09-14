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
    await button('＋ 选择材料并添加构造层').click()
    await page.getByRole('dialog', { name: '选择材料并添加构造层' }).waitFor()
    await page.getByLabel('按名称搜索材料', { exact: true }).fill('混凝土')
    await page.getByRole('radio', { name: /普通混凝土/ }).click()
    await button('确认添加这一层').click()
    await page.getByLabel('第 1 层厚度', { exact: true }).fill('100')
    await page.getByLabel('第 1 层损耗', { exact: true }).fill('0')
    assert.equal(await intensity.innerText(), '31.2')

    // 取消选择不改变构造：不新增层，结果保持旧值
    await button('＋ 选择材料并添加构造层').click()
    await page.getByRole('dialog', { name: '选择材料并添加构造层' }).waitFor()
    await page.getByLabel('按名称搜索材料', { exact: true }).fill('石膏')
    await text('1 种材料').waitFor()
    await page.getByRole('radio', { name: /石膏板/ }).click()
    await button('取消').click()
    assert.equal(await page.getByRole('dialog').count(), 0)
    assert.equal(await page.getByLabel('第 2 层厚度', { exact: true }).count(), 0)
    assert.equal(await intensity.innerText(), '31.2')

    // 替换材料：按类别缩小范围；不勾选寿命则保留已有厚度、损耗与寿命，结果即时更新
    await page.getByRole('button', { name: '更换第 1 层材料', exact: true }).click()
    await page.getByRole('dialog', { name: '更换本层材料' }).waitFor()
    await page.getByLabel('按材料类别缩小范围', { exact: true }).selectOption('insulation')
    await text('4 种材料').waitFor()
    await page.getByLabel('按名称搜索材料', { exact: true }).fill('岩棉')
    await page.getByRole('radio', { name: /岩棉板/ }).click()
    await page.getByText('不勾选则保留当前 60 年', { exact: false }).waitFor()
    await button('确认更换材料').click()
    assert.equal(await page.getByLabel('第 1 层厚度', { exact: true }).inputValue(), '100')
    assert.equal(await page.getByLabel('第 1 层损耗', { exact: true }).inputValue(), '0')
    assert.equal(await page.getByLabel('第 1 层寿命', { exact: true }).inputValue(), '60')
    assert.equal(await intensity.innerText(), '14.4')

    // 勾选采用参考寿命：厚度损耗仍保留，寿命换为新材料的 25 年
    await page.getByRole('button', { name: '更换第 1 层材料', exact: true }).click()
    await page.getByLabel('按名称搜索材料', { exact: true }).fill('石膏')
    await page.getByRole('radio', { name: /石膏板/ }).click()
    await page.getByRole('checkbox', { name: /采用「石膏板」的参考寿命/ }).check()
    await button('确认更换材料').click()
    assert.equal(await page.getByLabel('第 1 层厚度', { exact: true }).inputValue(), '100')
    assert.equal(await page.getByLabel('第 1 层损耗', { exact: true }).inputValue(), '0')
    assert.equal(await page.getByLabel('第 1 层寿命', { exact: true }).inputValue(), '25')
    assert.equal(await intensity.innerText(), '62.4')

    // 换回混凝土并采用参考寿命，恢复后续断言口径
    await page.getByRole('button', { name: '更换第 1 层材料', exact: true }).click()
    await page.getByLabel('按名称搜索材料', { exact: true }).fill('混凝土')
    await page.getByRole('radio', { name: /普通混凝土/ }).click()
    await page.getByRole('checkbox', { name: /采用「普通混凝土」的参考寿命/ }).check()
    await button('确认更换材料').click()
    assert.equal(await page.getByLabel('第 1 层寿命', { exact: true }).inputValue(), '60')
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
    await page.getByRole('button', { name: '更换第 2 层材料', exact: true }).click()
    await page.getByRole('dialog', { name: '更换本层材料' }).waitFor()
    await page.getByRole('radio', { name: /木纤维保温板/ }).click()
    await page.getByRole('checkbox', { name: /采用「木纤维保温板」的参考寿命/ }).check()
    await button('确认更换材料').click()
    // 替换保留原层厚度与施工损耗；寿命按用户勾选采用参考寿命（同为 30 年）
    assert.equal(await page.getByLabel('第 2 层厚度', { exact: true }).inputValue(), '100')
    assert.equal(await page.getByLabel('第 2 层损耗', { exact: true }).inputValue(), '3')
    assert.equal(await page.getByLabel('第 2 层寿命', { exact: true }).inputValue(), '30')
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
  assert.deepEqual(pageErrors, [])
  await context.close()
  console.log(`页面流程通过：${workflow}`)
} finally {
  await browser?.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
  clearTimeout(watchdog)
}
