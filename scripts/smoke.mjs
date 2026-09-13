import { preview } from 'vite'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const workflow = process.argv[2]
if (!['compose', 'compare', 'document', 'backup'].includes(workflow)) {
  throw new Error('请指定 compose、compare、document 或 backup 流程。')
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
  if (workflow === 'backup') {
    const fileInput = page.getByLabel('选择备份文件', { exact: true })
    const summary = page.locator('[data-check="restore-summary"]')
    await button('04 材料参数').click()
    await button('＋ 自定义材料').click()
    await page.getByLabel('材料名称', { exact: true }).fill('试算保温物性')
    await page.getByLabel('参数来源', { exact: true }).fill('冒烟流程教学参数')
    await button('保存材料参数').click()
    await text('自定义材料已保存，可在构造中选用。').waitFor()
    await button('01 构造编辑').click()
    await button('＋ 新建构造').click()
    await page.getByLabel('构造名称', { exact: true }).fill('清水构造')
    await page.getByLabel('添加构造层', { exact: true }).selectOption({ label: '普通混凝土' })
    await button('＋ 添加这一层').click()
    await page.getByLabel('第 1 层厚度', { exact: true }).fill('100')
    await page.getByLabel('第 1 层损耗', { exact: true }).fill('0')
    await button('保存构造').click()
    await text('构造已保存。').waitFor()
    await button('生成定稿').click()
    await text('计算书已定稿，构造现为只读。').waitFor()

    await button('05 备份恢复').click()
    const pendingBackup = page.waitForEvent('download')
    await button('导出设计备份').click()
    const backupPath = await (await pendingBackup).path()
    const backup = JSON.parse(await readFile(backupPath, 'utf8'))
    assert.equal(backup.format, 'solo-0004-envelope-carbon/backup')
    assert.equal(backup.version, 1)
    assert.equal(backup.data.assemblies.length, 2)
    assert.equal(backup.data.materials.length, 9)
    assert.equal(backup.data.documents.length, 1)

    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await intensity.waitFor()
    assert.equal(await intensity.innerText(), '90.1')

    await button('05 备份恢复').click()
    await fileInput.setInputFiles(backupPath)
    await summary.waitFor()
    assert.equal(await summary.innerText(), '恢复将：新增 1 个构造、1 种材料、1 份计算书。')
    await button('确认恢复').click()
    await text('恢复完成：新增 1 个构造、1 种材料、1 份计算书。').waitFor()
    await button('01 构造编辑').click()
    await page.getByLabel('当前构造', { exact: true }).selectOption({ label: '清水构造 · 已定稿' })
    assert.equal(await intensity.innerText(), '31.2')
    await page.reload()
    await page.getByLabel('当前构造', { exact: true }).selectOption({ label: '清水构造 · 已定稿' })
    assert.equal(await intensity.innerText(), '31.2')

    await button('05 备份恢复').click()
    await fileInput.setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ 已损坏的备份'),
    })
    await page.getByText('备份文件已损坏', { exact: false }).waitFor()
    await fileInput.setInputFiles({
      name: 'foreign.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ hello: 1 })),
    })
    await page.getByText('这不是围护碳研导出的设计备份文件。', { exact: false }).waitFor()
    await fileInput.setInputFiles({
      name: 'future.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({ format: 'solo-0004-envelope-carbon/backup', version: 99, data: {} }),
      ),
    })
    await page.getByText('备份文件版本不受支持', { exact: false }).waitFor()
    await button('01 构造编辑').click()
    await page.getByLabel('当前构造', { exact: true }).selectOption({ label: '清水构造 · 已定稿' })
    assert.equal(await intensity.innerText(), '31.2')

    await button('05 备份恢复').click()
    await fileInput.setInputFiles(backupPath)
    await summary.waitFor()
    assert.equal(await summary.innerText(), '备份中的记录与现有设计完全相同，没有需要导入的内容。')
    assert.equal(await button('确认恢复').isEnabled(), false)

    await button('01 构造编辑').click()
    await page.getByLabel('当前构造', { exact: true }).selectOption({ label: '清水构造 · 已定稿' })
    await button('重新开启编辑').click()
    await text('已重新开启编辑，历史计算书保持不变。').waitFor()
    await page.getByLabel('第 1 层厚度', { exact: true }).fill('200')
    await button('保存构造').click()
    await text('构造已保存。').waitFor()
    assert.equal(await intensity.innerText(), '62.4')
    await button('05 备份恢复').click()
    await fileInput.setInputFiles(backupPath)
    await text('与现有记录冲突（1）').waitFor()
    assert.equal(await summary.innerText(), '恢复将：作为副本导入 1 个构造。')
    await button('确认恢复').click()
    await text('恢复完成：作为副本导入 1 个构造。').waitFor()
    await button('01 构造编辑').click()
    await page
      .getByLabel('当前构造', { exact: true })
      .selectOption({ label: '清水构造 · 导入副本 · 已定稿' })
    assert.equal(await intensity.innerText(), '31.2')
    await page.getByLabel('当前构造', { exact: true }).selectOption({ label: '清水构造 · 编辑中' })
    assert.equal(await intensity.innerText(), '62.4')
    await button('03 计算书').click()
    assert.equal(await page.locator('[data-check="frozen-intensity"]').innerText(), '31.2')

    await button('05 备份恢复').click()
    await fileInput.setInputFiles(backupPath)
    await text('与现有记录冲突（1）').waitFor()
    await page.getByLabel('跳过，保留现有记录', { exact: true }).check()
    assert.equal(await summary.innerText(), '按当前选择没有需要写入的记录：冲突记录均被跳过。')
    assert.equal(await button('确认恢复').isEnabled(), false)
  }
  assert.deepEqual(pageErrors, [])
  await context.close()
  console.log(`页面流程通过：${workflow}`)
} finally {
  await browser?.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
  clearTimeout(watchdog)
}
