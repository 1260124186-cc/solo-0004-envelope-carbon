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
    // 校验不通过时保存按钮仍可点击，由保存动作给出被拒绝的反馈并留痕。
    assert.equal(await button('保存构造').isEnabled(), true)
    await button('保存构造').click()
    await page
      .getByRole('alert')
      .filter({ hasText: '第 1 层厚度需在 0.1 至 2,000 毫米之间。' })
      .waitFor()
    await page.getByLabel('第 1 层厚度', { exact: true }).fill('100')
    await button('保存构造').click()
    await text('构造已保存。').waitFor()
    await page.reload()
    await page.getByLabel('当前构造', { exact: true }).selectOption({ label: '清水构造 · 编辑中' })
    assert.equal(await intensity.innerText(), '31.2')
    assert.equal(await page.getByLabel('第 1 层厚度', { exact: true }).inputValue(), '100')

    // 审计日志：成功与被拒绝的尝试都要留痕，且按落库顺序编号。
    const designKey = 'solo-0004-envelope-carbon:design:v1'
    const readAudit = async () => {
      const raw = await page.evaluate((key) => localStorage.getItem(key), designKey)
      return JSON.parse(raw).audit
    }
    let audit = await readAudit()
    const materialSaved = audit
      .filter((entry) => entry.action === 'material-create' && entry.outcome === 'committed')
      .at(-1)
    assert.ok(materialSaved, '应记录成功保存的自定义材料。')
    assert.equal(materialSaved.targetName, '试算保温物性')
    assert.match(materialSaved.actor, /^[0-9a-f]{6}#[0-9a-f]{6}$/)
    const saveRejected = audit
      .filter((entry) => entry.action === 'assembly-save' && entry.outcome === 'rejected')
      .at(-1)
    assert.ok(saveRejected, '无效厚度触发的保存拒绝也应留痕。')
    assert.match(saveRejected.reason, /厚度/)
    const saveCommitted = audit
      .filter((entry) => entry.action === 'assembly-create' && entry.outcome === 'committed')
      .at(-1)
    assert.ok(saveCommitted, '新建构造首次保存应记录为 assembly-create。')
    assert.equal(saveCommitted.targetName, '清水构造')

    // 重名材料在锁内被拒绝，仍须入档且与成功记录共享同一序号序列。
    await button('04 材料参数').click()
    await button('＋ 自定义材料').click()
    await page.getByLabel('材料名称', { exact: true }).fill('试算保温物性')
    await page.getByLabel('参数来源', { exact: true }).fill('重复名称应被拒绝')
    await button('保存材料参数').click()
    await text('材料名称已存在，请使用可区分的名称。').waitFor()
    audit = await readAudit()
    const duplicateRejected = audit.find(
      (entry) =>
        entry.action === 'material-create' &&
        entry.outcome === 'rejected' &&
        /名称已存在/.test(entry.reason),
    )
    assert.ok(duplicateRejected, '锁内重名拒绝应留痕。')
    audit.forEach((entry, index) => {
      assert.equal(entry.seq, index + 1, '审计序号应从 1 起严格连续。')
    })

    // 跨标签页并发：互斥锁必须把两次提交串行化，审计不丢、不颠倒。
    await button('01 构造编辑').click()
    const other = await context.newPage()
    await other.goto(`http://127.0.0.1:${address.port}`)
    await other.locator('[data-check="intensity"]').waitFor()
    await other.getByLabel('当前构造', { exact: true }).selectOption({ label: '清水构造 · 编辑中' })
    const setThickness = (target, value) =>
      target.getByLabel('第 1 层厚度', { exact: true }).fill(String(value))
    await Promise.all([setThickness(page, 110), setThickness(other, 120)])
    const saveOn = (target) => target.getByRole('button', { name: '保存构造', exact: true }).click()
    const outcomeOn = (target) =>
      Promise.race([
        target.waitForSelector('text=构造已保存。', { timeout: 8000 }).then(() => 'committed'),
        target
          .waitForSelector('text=另一标签页已修改设计', { timeout: 8000 })
          .then(() => 'rejected'),
      ])
    const waiters = Promise.all([outcomeOn(page), outcomeOn(other)])
    await saveOn(page)
    await saveOn(other)
    const rawOutcomes = await waiters
    const outcomes = rawOutcomes.slice().sort()
    assert.deepEqual(outcomes, ['committed', 'rejected'], '并发保存必须恰好一成一败。')
    await page.waitForTimeout(200)
    audit = await readAudit()
    const tail = audit.slice(-2)
    assert.equal(tail[0].seq + 1, tail[1].seq, '并发两动作的审计序号必须相邻连续。')
    assert.deepEqual(tail.map((entry) => entry.outcome).sort(), ['committed', 'rejected'])
    assert.ok(tail.every((entry) => entry.action === 'assembly-save'))
    assert.match(tail.find((entry) => entry.outcome === 'rejected').reason, /另一标签页/)
    // 仅日志追加不换修订标识：失败方不应额外污染业务数据的修订次数。
    const finalStored = JSON.parse(
      await page.evaluate((key) => localStorage.getItem(key), designKey),
    )
    const qingshui = finalStored.assemblies.find((item) => item.name === '清水构造')
    assert.ok([110, 120].includes(qingshui.layers[0].thickness), '只有一次保存能改变构造。')
    await other.close()
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 150)))
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

    const rawAfterAlign = await page.evaluate(
      (key) => localStorage.getItem(key),
      'solo-0004-envelope-carbon:design:v1',
    )
    const alignEntry = JSON.parse(rawAfterAlign)
      .audit.filter((entry) => entry.action === 'comparison-align' && entry.outcome === 'committed')
      .at(-1)
    assert.ok(alignEntry, '对齐比较口径成功后应留痕。')
    assert.match(alignEntry.targetId, /\S+ → \S+/)
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

    const rawAudit = await page.evaluate(
      (key) => localStorage.getItem(key),
      'solo-0004-envelope-carbon:design:v1',
    )
    const history = JSON.parse(rawAudit).audit
    const finalized = history
      .filter((entry) => entry.action === 'assembly-finalize' && entry.outcome === 'committed')
      .at(-1)
    const reopened = history
      .filter((entry) => entry.action === 'assembly-reopen' && entry.outcome === 'committed')
      .at(-1)
    assert.ok(finalized && reopened, '定稿与重新开启编辑均应留痕。')
    assert.ok(reopened.seq > finalized.seq, '重新编辑的序号必须晚于定稿。')
    // 审计视图只读取数：导航存在且表格不含任何可编辑控件。
    await button('05 审计日志').click()
    const auditTable = page.locator('[data-check="audit-table"]')
    await auditTable.waitFor()
    assert.equal(await auditTable.locator('input, select, textarea, button').count(), 0)
    assert.ok(
      (await auditTable.innerText()).includes('生成定稿') &&
        (await auditTable.innerText()).includes('重新开启编辑'),
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
