import { preview } from 'vite'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

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
  page.setDefaultTimeout(10000)
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto(`http://127.0.0.1:${address.port}`)
  const button = (name) => page.getByRole('button', { name, exact: false })
  const undo = button('撤销')
  const redo = button('重做')
  const save = button('保存构造')
  const nameInput = page.getByLabel('构造名称', { exact: true })
  const thickness = (n) => page.getByLabel(`第 ${n} 层厚度`, { exact: true })
  const loss = (n) => page.getByLabel(`第 ${n} 层损耗`, { exact: true })
  const lifespan = (n) => page.getByLabel(`第 ${n} 层寿命`, { exact: true })
  const intensity = page.locator('[data-check="intensity"]')
  const wholeCarbon = page.locator('.result-total dd')
  const saveText = () => page.locator('.save-indicator').innerText()
  const savedIntensity = '90.1'
  const layerRows = () => page.locator('.layer-row')

  await intensity.waitFor()
  assert.equal(await intensity.innerText(), savedIntensity)
  assert.equal(await undo.isEnabled(), false, '初始撤销应禁用')
  assert.equal(await redo.isEnabled(), false, '初始重做应禁用')
  assert.match(await saveText(), /已保存/)

  // 1. 同一输入框连续输入合并为一步（慢速长连打：键入间隔 150ms、整段跨 1.5 秒，
  //    滑动窗口按每次输入续期，因此整段保持一步）
  await nameInput.click()
  await nameInput.fill('')
  const typed = '慢慢输入一长段构造名称'
  await nameInput.type(typed, { delay: 150 })
  assert.equal(await nameInput.inputValue(), typed)
  assert.match(await saveText(), /未保存/)
  await undo.click()
  assert.equal(
    await nameInput.inputValue(),
    '庭院样房 · 岩棉外墙',
    '慢速长连打（每次间隔小于 1 秒、窗口续期）必须合并为一步',
  )
  assert.match(await saveText(), /已保存/, '撤销到打开边界时无未保存修改')
  assert.equal(await save.isEnabled(), false)
  assert.equal(await undo.isEnabled(), false)
  await redo.click()
  assert.equal(await nameInput.inputValue(), typed)

  // 2. 停笔超过 1 秒后继续输入拆成新步骤
  await page.waitForTimeout(1200)
  await nameInput.type('补充', { delay: 50 })
  await undo.click()
  assert.equal(await nameInput.inputValue(), typed, '停顿超过 1 秒后的输入独立成步')
  await undo.click()
  assert.equal(await nameInput.inputValue(), '庭院样房 · 岩棉外墙')

  // 3. 两个层同字段快速修改各自成步
  await thickness(1).fill('88')
  await thickness(2).fill('55')
  await undo.click()
  assert.equal(await thickness(2).inputValue(), '100', '先撤销最近修改的第 2 层')
  assert.equal(await thickness(1).inputValue(), '88', '第 1 层修改仍保留')
  await undo.click()
  assert.equal(await thickness(1).inputValue(), '20', '再撤销第 1 层')
  assert.equal(await undo.isEnabled(), false, '回到打开边界')

  // 4. 厚度、损耗、寿命按“层 + 字段”身份分别成步
  await thickness(1).fill('88')
  await loss(1).fill('11')
  await lifespan(1).fill('7')
  await undo.click()
  assert.equal(await lifespan(1).inputValue(), '20')
  await undo.click()
  assert.equal(await loss(1).inputValue(), '5')
  await undo.click()
  assert.equal(await thickness(1).inputValue(), '20')

  // 5. 添加层 / 调整顺序 / 移除层 各自一步
  await page.getByLabel('添加构造层', { exact: true }).selectOption({ label: '普通混凝土' })
  await button('＋ 添加这一层').click()
  assert.equal(await layerRows().count(), 5)
  await undo.click()
  assert.equal(await layerRows().count(), 4)
  await redo.click()
  assert.equal(await layerRows().count(), 5)
  await page.getByLabel('下移第 4 层', { exact: true }).click()
  await undo.click()
  await page.getByLabel('下移第 4 层', { exact: true }).click()
  await page.getByLabel('移除第 5 层', { exact: true }).click()
  assert.equal(await layerRows().count(), 4)
  await undo.click()
  assert.equal(await layerRows().count(), 5)
  // 连续撤销移除、移动、添加，回到种子的 4 层
  await undo.click()
  await undo.click()
  assert.equal(await layerRows().count(), 4)

  // 6. 基本条件面积修改可撤销。强度按平方米计、与面积无关；
  //    随面积变化的是“整个构造隐含碳 = 强度 × 面积”与计算口径文字。
  const intensityBefore = await intensity.innerText()
  const wholeBefore = await wholeCarbon.innerText()
  await page.getByLabel('构造面积（平方米）', { exact: true }).fill('250')
  assert.equal(await intensity.innerText(), intensityBefore, '每平方米强度不应随面积变化')
  assert.notEqual(await wholeCarbon.innerText(), wholeBefore, '总隐含碳应随面积变化')
  assert.match(await page.locator('.calculation-scope').innerText(), /250 平方米/)
  await undo.click()
  assert.equal(await wholeCarbon.innerText(), wholeBefore, '撤销后总隐含碳恢复')
  assert.match(await page.locator('.calculation-scope').innerText(), /100 平方米/)
  assert.equal(await intensity.innerText(), intensityBefore)
  assert.match(await saveText(), /已保存/)

  // 7. 保存点撤销：回到保存时内容后 dirty=false，计算值同步恢复
  await thickness(1).fill('123')
  const changedIntensity = await intensity.innerText()
  assert.notEqual(changedIntensity, savedIntensity)
  assert.match(await saveText(), /未保存/)
  await save.click()
  await page.getByText('构造已保存。', { exact: true }).waitFor()
  const savedNewIntensity = changedIntensity
  assert.match(await saveText(), /已保存 · 修订 2/)
  assert.equal(await undo.isEnabled(), false, '保存后历史以新版本为边界')

  await thickness(1).fill('15')
  assert.notEqual(await intensity.innerText(), savedNewIntensity)
  assert.equal(await save.isEnabled(), true, '有改动时保存按钮可用')
  await undo.click()
  assert.equal(await thickness(1).inputValue(), '123', '撤销回到保存时的厚度')
  assert.equal(await intensity.innerText(), savedNewIntensity, '计算值恢复为保存时结果')
  assert.match(await saveText(), /已保存 · 修订 2/, '撤销到保存点后没有未保存修改')
  assert.equal(await save.isEnabled(), false, '保存按钮不得仍判定有改动')
  assert.equal(await undo.isEnabled(), false, '保存点即历史边界，无法继续撤销')

  // 8. 切换构造会清空历史；未保存修改取消切换时草稿与历史都保留
  await thickness(1).fill('16')
  page.once('dialog', (dialog) => dialog.dismiss())
  await button('＋ 新建构造').click()
  assert.equal(await thickness(1).inputValue(), '16', '放弃切换后草稿不变')
  assert.equal(await undo.isEnabled(), true, '取消切换不影响当前历史')
  await undo.click()
  assert.equal(await thickness(1).inputValue(), '123')

  assert.deepEqual(pageErrors, [])
  await context.close()
  console.log('撤销/重做页面验证通过')
} finally {
  await browser?.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
}
