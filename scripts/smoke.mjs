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
    const areaInput = () => page.getByLabel('构造面积（平方米）', { exact: true })
    await button('复制为替代方案').click()
    await page.getByLabel('构造名称', { exact: true }).fill('木纤维替代构造')
    await page.getByLabel('第 2 层材料', { exact: true }).selectOption({ label: '木纤维保温板' })
    await button('保存构造').click()
    await text('构造已保存。').waitFor()
    await button('02 方案比较').click()
    await page.locator('[data-check="carbon-delta"]').waitFor()
    assert.equal(await page.locator('[data-check="carbon-delta"]').innerText(), '-11.54')

    // 把基准口径改为面积 200，替代构造保持 100，制造口径不一致。
    await button('01 构造编辑').click()
    await page.getByLabel('当前构造', { exact: true }).selectOption({
      label: '庭院样房 · 岩棉外墙 · 编辑中',
    })
    await areaInput().fill('200')
    await button('保存构造').click()
    await text('构造已保存。').waitFor()

    // 再复制一个面积 300 的第三构造，供批量选择使用。
    await button('复制为替代方案').click()
    await page.getByLabel('构造名称', { exact: true }).fill('第三替代构造')
    await areaInput().fill('300')
    await button('保存构造').click()
    await text('构造已保存。').waitFor()

    // 木纤维替代也偏离基准（150）。
    await page.getByLabel('当前构造', { exact: true }).selectOption({
      label: '木纤维替代构造 · 编辑中',
    })
    await areaInput().fill('150')
    await button('保存构造').click()
    await text('构造已保存。').waitFor()

    await button('02 方案比较').click()
    const selects = page.locator('.comparison-selectors select')
    await selects.nth(0).selectOption({ label: '庭院样房 · 岩棉外墙' })
    await selects.nth(1).selectOption({ label: '木纤维替代构造' })

    // 差异逐项列出，并先看到不改动构造的预览。
    const pairwise = page.locator('[data-check="pairwise-align"]')
    await pairwise.waitFor()
    const areaDifference = pairwise.locator('[data-check="caliber-area"]')
    await assert.match(await areaDifference.innerText(), /150[\s\S]*→[\s\S]*200/)
    assert.equal(await pairwise.locator('[data-check="preview-intensity-delta"]').innerText(), '不变')
    assert.equal(
      await pairwise.locator('[data-check="preview-transmittance-delta"]').innerText(),
      '不变',
    )
    assert.match(await pairwise.locator('[data-check="preview-whole-delta"]').innerText(), /\+/)

    // 取消对齐：什么都不改，差异仍然存在。
    await button('将此替代构造对齐到基准并保存').click()
    await button('取消，不做修改').click()
    await assert.match(await areaDifference.innerText(), /150[\s\S]*→[\s\S]*200/)

    // 确认后经同一修订保护保存，比较结果立即可比。
    await button('将此替代构造对齐到基准并保存').click()
    await button('确认保存对齐结果').click()
    await text('替代构造已按基准统一部位、面积和年限。').waitFor()
    assert.equal(await page.locator('[data-check="carbon-delta"]').innerText(), '-11.54')

    // 把基准改为面积 150，让木纤维（200）与第三（300）同时偏离，再批量对齐。
    await button('01 构造编辑').click()
    await page.getByLabel('当前构造', { exact: true }).selectOption({
      label: '庭院样房 · 岩棉外墙 · 编辑中',
    })
    await areaInput().fill('150')
    await button('保存构造').click()
    await text('构造已保存。').waitFor()
    await button('02 方案比较').click()
    await page.getByRole('checkbox', { name: '选择构造 木纤维替代构造' }).check()
    await page.getByRole('checkbox', { name: '选择构造 第三替代构造' }).check()
    await page.locator('[data-check="batch-preview"]').waitFor()
    await button(/^一次性保存/).click()
    await text('已将 2 个构造一次性对齐到基准口径。').waitFor()
    const alignedReasons = page.getByText('口径已与基准一致，无需修改', { exact: false })
    assert.equal(await alignedReasons.count(), 2)

    // 编辑区占用且有未保存修改：行被标出且不能勾选。
    await button('01 构造编辑').click()
    await page.getByLabel('当前构造', { exact: true }).selectOption({
      label: '木纤维替代构造 · 编辑中',
    })
    await areaInput().fill('50')
    await button('02 方案比较').click()
    await page.getByText('正在编辑区占用且有未保存修改').first().waitFor()
    assert.equal(
      await page.getByRole('checkbox', { name: '选择构造 木纤维替代构造' }).isDisabled(),
      true,
    )

    // 已定稿同样被标出，不能混入整批或逐对保存。
    await button('01 构造编辑').click()
    await button('保存构造').click()
    await text('构造已保存。').waitFor()
    await button('生成定稿').click()
    await text('计算书已定稿，构造现为只读。').waitFor()
    await button('02 方案比较').click()
    await page
      .getByText('已定稿，需先重新开启编辑', { exact: false })
      .first()
      .waitFor()
    assert.equal(
      await page.getByRole('checkbox', { name: '选择构造 木纤维替代构造' }).isDisabled(),
      true,
    )
    const pairwiseBlocked = page.locator('[data-check="pairwise-blocked"]')
    await pairwiseBlocked.waitFor()
    assert.match(await pairwiseBlocked.innerText(), /该替代构造已定稿/)
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
