import { preview } from 'vite'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const workflow = process.argv[2]
if (!['compose', 'compare', 'document', 'recover'].includes(workflow)) {
  throw new Error('请指定 compose、compare、document 或 recover 流程。')
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

  if (workflow === 'recover') {
    const draftKey = 'solo-0004-envelope-carbon:draft:v1'
    const designKey = 'solo-0004-envelope-carbon:design:v1'
    const dialogTitle = () =>
      page.getByRole('heading', { name: '发现未提交的构造草稿', exact: true })
    const storedDraft = () => page.evaluate((key) => localStorage.getItem(key), draftKey)

    // 0. 新建构造在未输入实质内容前不占用草稿槽位；有实质内容后自动保存。
    await button('＋ 新建构造').click()
    await page.waitForTimeout(1200)
    assert.equal(await storedDraft(), null)
    await page.getByLabel('构造名称', { exact: true }).fill('事故前未保存构造')
    await page.getByLabel('添加构造层', { exact: true }).selectOption({ label: '普通混凝土' })
    await button('＋ 添加这一层').click()
    await page.getByText('自动保存', { exact: false }).waitFor()
    const newDraft = JSON.parse(await storedDraft())
    assert.equal(newDraft.originId, null)

    // 0b. 事故恢复：新构造草稿也可直接「另存为新构造」，点击即创建正式构造。
    await page.reload()
    await dialogTitle().waitFor()
    await page.getByText('这是一份尚未保存过的新构造草稿').waitFor()
    assert.equal(await button('另存为新构造').isEnabled(), true)
    await button('另存为新构造').click()
    await text('草稿已保存为正式构造。').waitFor()
    assert.equal(await storedDraft(), null)
    assert.equal(
      await page.getByLabel('构造名称', { exact: true }).inputValue(),
      '事故前未保存构造',
    )
    assert.equal(await page.getByLabel('第 1 层厚度', { exact: true }).inputValue(), '200')
    assert.equal(
      await page.getByLabel('当前构造', { exact: true }).inputValue(),
      newDraft.assembly.id,
    )
    await text('已保存 · 修订 1').waitFor()
    const formalAfterSave = await page.evaluate((key) => {
      const data = JSON.parse(localStorage.getItem(key))
      return {
        count: data.assemblies.length,
        created: data.assemblies.find((item) => item.name === '事故前未保存构造'),
        courtyard: data.assemblies.find((item) => item.id === 'envelope-courtyard'),
      }
    }, designKey)
    assert.equal(formalAfterSave.count, 2)
    assert.equal(formalAfterSave.created.id, newDraft.assembly.id)
    assert.equal(formalAfterSave.created.revision, 1)
    assert.equal(formalAfterSave.created.state, 'editing')
    assert.equal(formalAfterSave.created.layers.length, 1)
    assert.equal(formalAfterSave.courtyard.area, 100)
    assert.equal(formalAfterSave.courtyard.revision, 1)

    // 回到种子构造，继续后续已保存构造的草稿流程。
    await page
      .getByLabel('当前构造', { exact: true })
      .selectOption({ label: '庭院样房 · 岩棉外墙 · 编辑中' })

    // 1. 编辑现有构造但不保存，等待独立草稿槽位自动保存。
    await page.getByLabel('构造名称', { exact: true }).fill('庭院样房 · 岩棉外墙（草稿改名）')
    await page.getByLabel('构造面积（平方米）', { exact: true }).fill('120')
    await page.getByText('自动保存', { exact: false }).waitFor()
    assert.ok(await storedDraft())
    assert.notEqual(await storedDraft(), null)
    const draftRecord = JSON.parse(await storedDraft())
    assert.equal(draftRecord.originId, 'envelope-courtyard')
    assert.equal(draftRecord.assembly.area, 120)

    // 2. 刷新后先弹出恢复提示并展示差异，正式选择列表仍只含正式构造。
    await page.reload()
    await dialogTitle().waitFor()
    await page.getByText('构造面积（平方米）').first().waitFor()
    await page.getByText('100', { exact: true }).first().waitFor()
    await page.getByText('120', { exact: true }).first().waitFor()
    const pickerOptions = await page.getByLabel('当前构造', { exact: true }).innerText()
    assert.ok(pickerOptions.includes('庭院样房 · 岩棉外墙 · 编辑中'))
    assert.ok(!pickerOptions.includes('草稿改名'))

    // 3. 放弃草稿：槽位清空，正式数据保持原值。
    page.once('dialog', (native) => native.accept())
    await button('放弃草稿').click()
    await text('草稿已放弃，编辑区保持最近保存版本，正式数据未受影响。').waitFor()
    assert.equal(await storedDraft(), null)
    assert.equal(
      await page.getByLabel('构造名称', { exact: true }).inputValue(),
      '庭院样房 · 岩棉外墙',
    )
    assert.equal(await page.getByLabel('构造面积（平方米）', { exact: true }).inputValue(), '100')

    // 4. 再次制造草稿并恢复到编辑区。
    await page.getByLabel('构造面积（平方米）', { exact: true }).fill('130')
    await page.getByText('自动保存', { exact: false }).waitFor()
    await page.reload()
    await dialogTitle().waitFor()
    await button('恢复到编辑区').click()
    await text('已恢复上次自动保存的草稿，请核对后再保存或放弃。').waitFor()
    assert.equal(await page.getByLabel('构造面积（平方米）', { exact: true }).inputValue(), '130')
    assert.equal(
      await page.getByLabel('当前构造', { exact: true }).inputValue(),
      'envelope-courtyard',
    )

    // 5. 刷新仍提示同一草稿；选择另存，原构造不变，新构造进入正式列表，槽位清空。
    await page.reload()
    await dialogTitle().waitFor()
    await button('另存为新构造').click()
    await text('草稿已另存为新构造，原构造保持不变。').waitFor()
    assert.equal(await storedDraft(), null)
    assert.equal(await page.getByLabel('构造面积（平方米）', { exact: true }).inputValue(), '130')
    const afterSave = await page.evaluate((key) => {
      const data = JSON.parse(localStorage.getItem(key))
      return data.assemblies.map((item) => ({
        name: item.name,
        area: item.area,
        revision: item.revision,
      }))
    }, designKey)
    const original = afterSave.find((item) => item.name === '庭院样房 · 岩棉外墙')
    const savedCopy = afterSave.find((item) => item.name === '庭院样房 · 岩棉外墙 · 草稿另存')
    assert.ok(original && original.area === 100 && original.revision === 1)
    assert.ok(savedCopy && savedCopy.area === 130 && savedCopy.revision === 1)

    // 6. 跨标签页修订保护：恢复过期草稿后直接保存需明确确认，取消则不覆盖。
    await page.getByLabel('构造面积（平方米）', { exact: true }).fill('140')
    await page.getByText('自动保存', { exact: false }).waitFor()
    const copyId = await page.getByLabel('当前构造', { exact: true }).inputValue()
    await page.evaluate(
      ([key, id]) => {
        const data = JSON.parse(localStorage.getItem(key))
        const item = data.assemblies.find((assembly) => assembly.id === id)
        item.area = 150
        item.revision += 1
        data.stamp = 'revision-tampered-by-other-tab'
        localStorage.setItem(key, JSON.stringify(data))
      },
      [designKey, copyId],
    )
    await page.reload()
    await dialogTitle().waitFor()
    await page.getByText('正式数据已在其它标签页或会话中被修改并保存').waitFor()
    await button('恢复到编辑区').click()
    page.once('dialog', (native) => native.dismiss())
    await button('保存构造').click()
    const afterCancel = await page.evaluate(
      ([key, id]) => JSON.parse(localStorage.getItem(key)).assemblies.find((a) => a.id === id).area,
      [designKey, copyId],
    )
    assert.equal(afterCancel, 150)
    // 取消后编辑区仍保留草稿值，且没有出现保存成功提示。
    assert.equal(await page.getByLabel('构造面积（平方米）', { exact: true }).inputValue(), '140')
    assert.equal(await button('保存构造').isEnabled(), true)

    // 用户已看过与最新保存版本（150）的差异及过期警告，明确确认后可知情覆盖；
    // 修订锁仍会拦截会话期间其它标签页的并发写入。
    page.once('dialog', (native) => native.accept())
    await button('保存构造').click()
    await text('构造已保存。').waitFor()
    const afterConfirm = await page.evaluate(
      ([key, id]) => JSON.parse(localStorage.getItem(key)).assemblies.find((a) => a.id === id).area,
      [designKey, copyId],
    )
    assert.equal(afterConfirm, 140)
  }
  assert.deepEqual(pageErrors, [])
  await context.close()
  console.log(`页面流程通过：${workflow}`)
} finally {
  await browser?.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
  clearTimeout(watchdog)
}
