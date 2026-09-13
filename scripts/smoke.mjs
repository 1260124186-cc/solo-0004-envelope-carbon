import { preview } from 'vite'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const workflow = process.argv[2]
if (!['compose', 'compare', 'document', 'evidence'].includes(workflow)) {
  throw new Error('请指定 compose、compare、document 或 evidence 流程。')
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

  if (workflow === 'evidence') {
    // 从材料参数页查看关联，并从「岩棉板」卡片跳转登记。
    await button('04 材料参数').click()
    await page.getByText('物性依据（1）', { exact: true }).first().waitFor()
    const mineralCard = page.locator('section.material-card', {
      hasText: '岩棉板',
    })
    await mineralCard.getByRole('button', { name: '＋ 登记依据' }).click()
    await page.getByLabel('资料名称', { exact: true }).fill('冒烟外部物性资料')
    // 清空必填年份时保存应被阻止；补回年份后才允许登记。
    await page.getByLabel('年份', { exact: true }).fill('')
    assert.equal(await button('保存依据（不改写材料数值）').isEnabled(), false)
    await page.getByLabel('适用材料范围', { exact: true }).fill('岩棉板干态导热与碳因子示例')
    await page.getByLabel('年份', { exact: true }).fill('2024')
    await button('保存依据（不改写材料数值）').click()
    await text('物性依据已登记，材料数值未被修改。').waitFor()
    // 材料参数页可查看新关联，材料数值保持原样。
    await button('04 材料参数').click()
    await page.getByText('物性依据（2）', { exact: true }).first().waitFor()
    await page.getByText('冒烟外部物性资料').first().waitFor()
    // 登记依据不改写数值：构造页的计算结果与教学示例一致。
    await button('01 构造编辑').click()
    assert.equal(await intensity.innerText(), '90.1')
    // 到物性依据页把这条依据标为不再适用。
    await button('05 物性依据').click()
    const newCard = page.locator('[data-check="evidence-card-pending"]', {
      hasText: '冒烟外部物性资料',
    })
    await newCard.locator('[data-check="evidence-status-select"]').selectOption('obsolete')
    await text('依据状态已更新。历史构造与计算书结果保持不变。').waitFor()
    // 构造编辑页出现明确提示，但即时计算结果与教学示例一致。
    await button('01 构造编辑').click()
    const banner = page.locator('[data-check="obsolete-warning"]')
    await banner.waitFor()
    assert.match(await banner.innerText(), /已标为不再适用/)
    assert.match(await banner.innerText(), /岩棉板/)
    assert.equal(await intensity.innerText(), '90.1')
    // 计算书页同样提示；此时定稿生成的历史计算书结果保持原值。
    await button('03 计算书').click()
    await banner.first().waitFor()
    await button('生成定稿').click()
    await text('计算书已定稿，构造现为只读。').waitFor()
    const frozen = page.locator('[data-check="frozen-intensity"]')
    assert.equal(await frozen.innerText(), '90.1')
    // 改为已核实后提示消失，历史计算书仍然保留。
    await button('05 物性依据').click()
    await page
      .locator('[data-check="evidence-card-obsolete"]', { hasText: '冒烟外部物性资料' })
      .locator('[data-check="evidence-status-select"]')
      .selectOption('verified')
    await text('依据状态已更新。历史构造与计算书结果保持不变。').waitFor()
    await button('01 构造编辑').click()
    assert.equal(await page.locator('[data-check="obsolete-warning"]').count(), 0)
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
