import { preview } from 'vite'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const workflow = process.argv[2]
if (!['compose', 'compare', 'document', 'reorder'].includes(workflow)) {
  throw new Error('请指定 compose、compare、document 或 reorder 流程。')
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
  if (workflow === 'reorder') {
    const DRAFT_KEY = 'solo-0004-envelope-carbon:draft:v1'
    // 先正式保存，使正式版本进入浏览器存储，形成可比对基线
    await page.getByLabel('第 1 层损耗', { exact: true }).fill('4')
    await button('保存构造').click()
    await text('构造已保存。').waitFor()
    await page.getByLabel('第 1 层损耗', { exact: true }).fill('5')
    await button('保存构造').click()
    await text('构造已保存。').waitFor()
    // 仅调换层序：把第 3 层（蒸压加气混凝土）下移到第 4 层
    await page.getByRole('button', { name: '下移第 3 层', exact: true }).click()
    const layerMaterials = () =>
      page.getByLabel(/^第 \d+ 层材料$/).evaluateAll((nodes) => nodes.map((node) => node.value))
    assert.deepEqual(await layerMaterials(), [
      'env-lime',
      'env-mineral',
      'env-gypsum',
      'env-aerated',
    ])
    // 只有层序变化也必须自动保存草稿，不能被静默清掉
    await page.getByText('草稿已自动保存', { exact: false }).waitFor()
    const pending = await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY)
    assert.notEqual(pending, null)
    assert.deepEqual(
      JSON.parse(pending).assembly.layers.map((layer) => layer.id),
      ['ply-exterior', 'ply-insulation', 'ply-interior', 'ply-body'],
    )
    // 异常关闭后重新进入：恢复弹窗必须展示层序变化
    await page.reload()
    await page.getByRole('heading', { name: '发现未保存的草稿' }).waitFor()
    await page.getByText('构造层排列顺序变化', { exact: true }).waitFor()
    const moveRow = page.locator('table', { hasText: '正式保存版本层位' }).locator('tr', {
      hasText: '蒸压加气混凝土',
    })
    await moveRow.waitFor()
    assert.match(await moveRow.innerText(), /第 3 层[\s\S]*第 4 层/)
    assert.equal(await page.getByText('石膏板').first().isVisible(), true)
    // 恢复后层序保持调换，正式保存成功
    await button('恢复到编辑区').click()
    assert.deepEqual(await layerMaterials(), [
      'env-lime',
      'env-mineral',
      'env-gypsum',
      'env-aerated',
    ])
    await button('保存构造').click()
    await text('构造已保存。').waitFor()
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY), null)
    await page.reload()
    await page.locator('[data-check="intensity"]').waitFor()
    assert.deepEqual(await layerMaterials(), [
      'env-lime',
      'env-mineral',
      'env-gypsum',
      'env-aerated',
    ])
  }
  assert.deepEqual(pageErrors, [])
  await context.close()
  console.log(`页面流程通过：${workflow}`)
} finally {
  await browser?.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
  clearTimeout(watchdog)
}
