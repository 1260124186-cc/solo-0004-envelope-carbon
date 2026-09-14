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
  page.setDefaultTimeout(8000)
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto(`http://127.0.0.1:${address.port}`)
  const button = (name) => page.getByRole('button', { name, exact: false })
  const undo = button('撤销')
  const redo = button('重做')
  const save = button('保存构造')
  const nameInput = page.getByLabel('构造名称', { exact: true })
  const thickness = page.getByLabel('第 1 层厚度', { exact: true })
  const saveText = () => page.locator('.save-indicator').innerText()

  await page.locator('[data-check="intensity"]').waitFor()

  // 初始：无历史可撤销/重做，已保存状态
  assert.equal(await undo.isEnabled(), false, '初始撤销应禁用')
  assert.equal(await redo.isEnabled(), false, '初始重做应禁用')
  assert.match(await saveText(), /已保存/)

  // 1. 同一输入框连续输入合并为一步
  await nameInput.click()
  await nameInput.fill('')
  await nameInput.type('甲', { delay: 30 })
  await nameInput.type('乙', { delay: 30 })
  await nameInput.type('丙', { delay: 30 })
  assert.match(await saveText(), /未保存/)
  assert.equal(await undo.isEnabled(), true)
  await undo.click()
  assert.equal(await nameInput.inputValue(), '庭院样房 · 岩棉外墙')
  assert.match(await saveText(), /已保存/, '撤销到保存点必须无未保存修改')
  assert.equal(await save.isEnabled(), false, '保存点撤销后保存按钮应禁用')
  assert.equal(await undo.isEnabled(), false, '回到边界后撤销应禁用')

  // 2. 重做恢复，之后新修改清空重做栈
  await redo.click()
  assert.equal(await nameInput.inputValue(), '甲乙丙')
  await thickness.fill('55')
  assert.equal(await redo.isEnabled(), false, '新修改后重做记录应失效')
  // 撤销厚度修改（独立一步），再撤销名称
  await undo.click()
  assert.equal(await thickness.inputValue(), '20')
  assert.equal(await nameInput.inputValue(), '甲乙丙')
  await undo.click()
  assert.equal(await nameInput.inputValue(), '庭院样房 · 岩棉外墙')

  // 3. 厚度、损耗、寿命分别为独立字段步骤
  await thickness.fill('88')
  await page.getByLabel('第 1 层损耗', { exact: true }).fill('11')
  await page.getByLabel('第 1 层寿命', { exact: true }).fill('7')
  await undo.click()
  assert.equal(await page.getByLabel('第 1 层寿命', { exact: true }).inputValue(), '20')
  await undo.click()
  assert.equal(await page.getByLabel('第 1 层损耗', { exact: true }).inputValue(), '5')
  await undo.click()
  assert.equal(await thickness.inputValue(), '20')

  // 4. 添加层 / 调整顺序 / 移除层 各自一步
  await page.getByLabel('添加构造层', { exact: true }).selectOption({ label: '普通混凝土' })
  await button('＋ 添加这一层').click()
  assert.equal(await page.locator('.layer-row').count(), 5)
  await undo.click()
  assert.equal(await page.locator('.layer-row').count(), 4)
  await redo.click()
  assert.equal(await page.locator('.layer-row').count(), 5)

  await page.getByLabel('下移第 4 层', { exact: true }).click()
  await undo.click()
  // 顺序恢复后再次下移，然后移除被移到第 5 位的层
  await page.getByLabel('下移第 4 层', { exact: true }).click()
  await page.getByLabel('移除第 5 层', { exact: true }).click()
  assert.equal(await page.locator('.layer-row').count(), 4)
  await undo.click()
  assert.equal(await page.locator('.layer-row').count(), 5)

  // 5. 基本条件修改（面积）可撤销，且计算结果随撤销恢复
  const intensity = page.locator('[data-check="intensity"]')
  const before = await intensity.innerText()
  await page.getByLabel('构造面积（平方米）', { exact: true }).fill('250')
  const after = await intensity.innerText()
  assert.notEqual(before, after)
  await undo.click()
  assert.equal(await intensity.innerText(), before, '撤销后计算结果应恢复')
  assert.match(await saveText(), /已保存/)

  // 6. 保存后历史以新版本为边界：撤销禁用，脏状态为 false
  await nameInput.fill('保存边界验证')
  await save.click()
  await page.getByText('构造已保存。', { exact: true }).waitFor()
  assert.equal(await undo.isEnabled(), false, '保存后历史应为新边界')
  assert.equal(await redo.isEnabled(), false)
  assert.match(await saveText(), /已保存 · 修订 2/)

  // 7. 切换构造（新建）会清空历史；未保存修改会拦截
  await nameInput.fill('未保存的改动')
  page.once('dialog', (dialog) => dialog.dismiss())
  await button('＋ 新建构造').click()
  assert.equal(await nameInput.inputValue(), '保存边界验证', '放弃切换后草稿不变')
  assert.equal(await undo.isEnabled(), true, '取消切换不影响历史')

  assert.deepEqual(pageErrors, [])
  await context.close()
  console.log('撤销/重做页面验证通过')
} finally {
  await browser?.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
}
