import { preview } from 'vite'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const workflow = process.argv[2]
if (!['compose', 'compare', 'document', 'scenario'].includes(workflow)) {
  throw new Error('请指定 compose、compare、document 或 scenario 流程。')
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
  const notice = (value) => page.locator('.feedback.success', { hasText: value })
  const contains = (value) => page.getByText(value, { exact: false })
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
  if (workflow === 'scenario') {
    await button('＋ 新建构造').click()
    await page.getByLabel('构造名称', { exact: true }).fill('双层混凝土情景样')
    await page.getByLabel('添加构造层', { exact: true }).selectOption({ label: '普通混凝土' })
    await button('＋ 添加这一层').click()
    await page.getByLabel('第 1 层厚度', { exact: true }).fill('100')
    await page.getByLabel('第 1 层损耗', { exact: true }).fill('0')
    await page.getByLabel('添加构造层', { exact: true }).selectOption({ label: '普通混凝土' })
    await button('＋ 添加这一层').click()
    await page.getByLabel('第 2 层厚度', { exact: true }).fill('200')
    await page.getByLabel('第 2 层损耗', { exact: true }).fill('0')
    assert.equal(await intensity.innerText(), '93.6')
    await button('保存构造').click()
    await text('构造已保存。').waitFor()

    await button('05 参数情景').click()
    await text('给碳因子一个范围，而不是一个定值。').waitFor()
    await page.getByLabel('选择用于新建研究的构造', { exact: true }).selectOption({
      label: '双层混凝土情景样 · 编辑中 · 修订 1',
    })
    await button('建立研究').click()

    const scenarioIntensities = page.locator('[data-check="scenario-intensity"]')
    await scenarioIntensities.first().waitFor()
    assert.equal(await scenarioIntensities.count(), 3)
    assert.deepEqual(await scenarioIntensities.allInnerTexts(), ['93.6', '93.6', '93.6'])
    // 同一材料被两层引用时必须共用同一组研究因子。
    await contains('用于第 1、2 层 · 多层共用，保持一致').waitFor()

    await page.getByLabel('普通混凝土碳因子低值', { exact: true }).fill('0.05')
    await page.getByLabel('普通混凝土碳因子高值', { exact: true }).fill('0.4')
    assert.deepEqual(await scenarioIntensities.allInnerTexts(), ['36', '93.6', '288'])
    await contains('↗ 超出碳强度目标（≤ 150）').waitFor()
    const exceeds = page.locator('.scenario-card.exceeded')
    assert.equal(await exceeds.count(), 1)

    // 低值高于参考值时必须阻止保存。
    await page.getByLabel('普通混凝土碳因子低值', { exact: true }).fill('0.9')
    await contains('碳因子需满足低值 ≤ 参考值 ≤ 高值').waitFor()
    assert.equal(await button('保存研究').isEnabled(), false)
    await page.getByLabel('普通混凝土碳因子低值', { exact: true }).fill('0.05')
    await page.getByLabel('研究名称', { exact: true }).fill('混凝土因子区间试算')
    await page
      .getByLabel('研究假设', { exact: true })
      .fill('冒烟流程：同一材料两层共用同一组因子。')
    await button('保存研究').click()
    await notice('参数情景研究已保存').waitFor()

    // 研究不修改材料目录与原构造；来源构造此后保存新版本时，研究保留冻结版本并提示。
    await button('01 构造编辑').click()
    assert.equal(await intensity.innerText(), '93.6')
    await page.getByLabel('第 1 层厚度', { exact: true }).fill('150')
    await button('保存构造').click()
    await text('构造已保存。').waitFor()
    assert.notEqual(await intensity.innerText(), '93.6')
    await button('05 参数情景').click()
    await button('← 返回研究列表').click()
    await button('重新打开').click()
    await page.getByLabel('研究名称', { exact: true }).waitFor()
    assert.deepEqual(await scenarioIntensities.allInnerTexts(), ['36', '93.6', '288'])
    await contains('来源构造此后已有修改').waitFor()
    assert.equal(
      await page.getByLabel('研究假设', { exact: true }).inputValue(),
      '冒烟流程：同一材料两层共用同一组因子。',
    )

    // 刷新后可重新打开，保留冻结物性、范围与假设。
    await page.reload()
    await button('05 参数情景').click()
    await button('重新打开').click()
    await page.getByLabel('研究名称', { exact: true }).waitFor()
    assert.deepEqual(await scenarioIntensities.allInnerTexts(), ['36', '93.6', '288'])
    assert.equal(
      await page.getByLabel('普通混凝土碳因子低值', { exact: true }).inputValue(),
      '0.05',
    )
    assert.equal(
      await page.getByLabel('普通混凝土碳因子参考值', { exact: true }).inputValue(),
      '0.13',
    )
    assert.equal(await page.getByLabel('普通混凝土碳因子高值', { exact: true }).inputValue(), '0.4')
    assert.equal(
      await page.getByLabel('研究假设', { exact: true }).inputValue(),
      '冒烟流程：同一材料两层共用同一组因子。',
    )
  }
  assert.deepEqual(pageErrors, [])
  await context.close()
  console.log(`页面流程通过：${workflow}`)
} finally {
  await browser?.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
  clearTimeout(watchdog)
}
