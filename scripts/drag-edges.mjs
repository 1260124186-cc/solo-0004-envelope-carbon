import { preview } from 'vite'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: false } })
let browser
try {
  const address = server.httpServer.address()
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1360, height: 1400 } })
  page.setDefaultTimeout(8000)
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`http://127.0.0.1:${address.port}`)
  await page.locator('[data-check="intensity"]').waitFor()

  const rows = () => page.locator('.layer-row')
  const names = async () =>
    page
      .getByLabel(/^第 \d+ 层材料$/)
      .evaluateAll((els) => els.map((el) => el.options[el.selectedIndex].text))
  const intensity = page.locator('[data-check="intensity"]')
  const before = await intensity.innerText()

  const simulate = async (from, to, half) =>
    page.evaluate(
      ({ from, to, half }) => {
        const all = document.querySelectorAll('.layer-row')
        const source = all[from].querySelector('.drag-handle')
        const target = all[to]
        const dt = new DataTransfer()
        const rect = target.getBoundingClientRect()
        const y = half === 'top' ? rect.top + 5 : rect.bottom - 5
        const fire = (el, type, yy) =>
          el.dispatchEvent(
            new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientY: yy }),
          )
        fire(source, 'dragstart', y)
        fire(target, 'dragover', y)
        fire(target, 'drop', y)
        fire(source, 'dragend', y)
      },
      { from, to, half },
    )

  const simulateTail = async (from) =>
    page.evaluate(
      ({ from }) => {
        const all = document.querySelectorAll('.layer-row')
        const source = all[from].querySelector('.drag-handle')
        const tail = document.querySelector('.drop-tail')
        const rect = tail.getBoundingClientRect()
        const dt = new DataTransfer()
        const y = rect.top + 4
        const fire = (el, type) =>
          el.dispatchEvent(
            new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientY: y }),
          )
        fire(source, 'dragstart', y)
        fire(tail, 'dragover', y)
        fire(tail, 'drop', y)
        fire(source, 'dragend', y)
      },
      { from },
    )

  // 1) 末层拖到首行上半区 -> 石膏板到第 1
  await simulate(3, 0, 'top')
  assert.deepEqual(await names(), ['石膏板', '石灰砂浆', '岩棉板', '蒸压加气混凝土'])
  assert.equal(await intensity.innerText(), before)

  // 2) 拖到尾部区域 -> 首层（石膏板）回到末尾
  await simulateTail(0)
  assert.deepEqual(await names(), ['石灰砂浆', '岩棉板', '蒸压加气混凝土', '石膏板'])
  assert.equal(await intensity.innerText(), before)

  // 3) 无效放置：拖回自身所在槽位（行上半区=from 空隙），顺序与未保存状态不变
  const snapshot = await page.evaluate(() => {
    const selects = [...document.querySelectorAll('.layer-row select')]
    return selects.map((s) => s.value).join('|')
  })
  await simulate(1, 1, 'top')
  const after = await page.evaluate(() => {
    const selects = [...document.querySelectorAll('.layer-row select')]
    return selects.map((s) => s.value).join('|')
  })
  assert.equal(after, snapshot)
  assert.deepEqual(await names(), ['石灰砂浆', '岩棉板', '蒸压加气混凝土', '石膏板'])
  assert.equal(
    await rows()
      .nth(1)
      .evaluate((r) => r.classList.contains('dragging')),
    false,
  )

  // 4) 下移按钮（键盘路径）仍正常
  await page.getByRole('button', { name: '下移第 1 层', exact: true }).click()
  assert.deepEqual(await names(), ['岩棉板', '石灰砂浆', '蒸压加气混凝土', '石膏板'])
  assert.equal(await intensity.innerText(), before)

  assert.deepEqual(errors, [])
  console.log('拖拽边界场景通过；强度始终为', before)
} finally {
  await browser?.close()
  await new Promise((r) => server.httpServer.close(r))
}
