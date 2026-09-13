import { preview } from 'vite'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const workflow = process.argv[2]
if (!['compose', 'compare', 'document', 'capacity'].includes(workflow)) {
  throw new Error('请指定 compose、compare、document 或 capacity 流程。')
}
const designKey = 'solo-0004-envelope-carbon:design:v1'
// 通过包装 setItem 模拟浏览器配额：全部键合计超过上限即抛 QuotaExceededError。
const quotaInit = (limit) => `
  window.__quotaLimit = ${JSON.stringify(limit)};
  (() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      let used = 0;
      for (let i = 0; i < this.length; i++) {
        const k = this.key(i);
        used += k.length + (this.getItem(k) || '').length;
      }
      const next = used - (this.getItem(key) ? key.length + this.getItem(key).length : 0)
        + key.length + String(value).length;
      if (next > window.__quotaLimit) {
        const error = new DOMException('模拟配额超限', 'QuotaExceededError');
        error.code = 22;
        throw error;
      }
      return setItem.call(this, key, value);
    };
  })();
`
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
  if (workflow === 'capacity') {
    // 先用宽松上限进入页面：种子数据 + 操作者标识必须能正常读取。
    await context.addInitScript(quotaInit(2_000_000))
  }
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
  if (workflow === 'capacity') {
    // 用真实存储长度精确建模配额：base=不含审计的完整序列化长度（含键名），
    // 由页面统一按全部 localStorage 键计量，本流程只保留设计键与操作者键。
    const storage = async () => {
      const metrics = await page.evaluate((designKey) => {
        const raw = localStorage.getItem(designKey)
        const parsed = JSON.parse(raw)
        const other = [...Array(localStorage.length).keys()]
          .map((i) => localStorage.key(i))
          .filter((k) => k !== designKey)
          .reduce((sum, k) => sum + k.length + localStorage.getItem(k).length, 0)
        return {
          state: parsed,
          other,
          base: designKey.length + JSON.stringify({ ...parsed, audit: [] }).length,
        }
      }, designKey)
      return metrics
    }
    const setLimit = (limit) => page.evaluate((value) => (window.__quotaLimit = value), limit)
    const setLimitOn = (target, limit) =>
      target.evaluate((value) => (window.__quotaLimit = value), limit)
    const saveThickness = async (value) => {
      await page.getByLabel('第 1 层厚度', { exact: true }).fill(String(value))
      await page.getByRole('button', { name: '保存构造', exact: true }).click()
    }
    // 以实际可能写入的审计条目为模板，估算“业务 + n 条日志”所需长度。
    const entryTemplate = (state, outcome, reason = '') =>
      JSON.stringify({
        seq: 1,
        at: '2026-09-13T00:00:00.000Z',
        action: 'assembly-save',
        outcome,
        targetKind: 'assembly',
        targetId: state.assemblies[0].id,
        targetName: state.assemblies[0].name,
        actor: 'abc123#def456',
        detail: outcome === 'committed' ? '修订 2' : '',
        reason,
      }).length + 1
    // 配额只够保留 maxEntries 条审计（含本次新条目），降级时必须截断更旧日志。
    const tightLimit = (metrics, maxEntries, outcome, reason) =>
      metrics.other + metrics.base + entryTemplate(metrics.state, outcome, reason) * maxEntries

    // 引导保存：种子数据只存在于内存，首次保存后设计键才落入 localStorage。
    await saveThickness(21)
    await page.getByText('构造已保存。', { exact: true }).waitFor()

    // 阶段一：连续三次成功保存，容量只够 2 条日志，迫使保存从第 3 次起截断最旧日志。
    let metrics = await storage()
    assert.equal(metrics.state.audit.length, 1, '引导保存后应有且仅有 1 条审计。')
    const seedId = metrics.state.assemblies[0].id
    const seedName = metrics.state.assemblies[0].name
    await setLimit(tightLimit(metrics, 2, 'committed'))
    for (const value of [101, 102, 103]) {
      await saveThickness(value)
      await page.getByText('构造已保存。', { exact: true }).waitFor()
    }
    metrics = await storage()
    assert.equal(metrics.state.assemblies[0].layers[0].thickness, 103, '最新业务变更必须保留。')
    let committed = metrics.state.audit.filter((entry) => entry.outcome === 'committed')
    assert.equal(committed.length, 2, '最旧成功审计应被截断，保留最新 2 条。')
    assert.equal(committed.at(-1).targetName, seedName)
    assert.ok(committed[0].seq < committed[1].seq, '保留片段的锁顺序不得颠倒。')

    // 阶段二：容量压力下的校验拒绝仍须入档，且后续成功保存不受影响。
    await setLimit(tightLimit(metrics, 2, 'rejected', '第 1 层厚度需在 0.1 至 2,000 毫米之间。'))
    await page.getByLabel('第 1 层厚度', { exact: true }).fill('0')
    await page.getByRole('button', { name: '保存构造', exact: true }).click()
    await page
      .getByRole('alert')
      .filter({ hasText: '第 1 层厚度需在 0.1 至 2,000 毫米之间。' })
      .waitFor()
    // 拒绝提示先于锁内日志写入出现，需等待拒绝条目真正落库后再断言。
    await page.waitForFunction(
      (key) => {
        const parsed = JSON.parse(localStorage.getItem(key))
        return parsed.audit.some(
          (entry) => entry.outcome === 'rejected' && /厚度/.test(entry.reason),
        )
      },
      designKey,
      { timeout: 5000 },
    )
    metrics = await storage()
    const rejection = metrics.state.audit.find((entry) => entry.outcome === 'rejected')
    assert.ok(rejection, '被拒绝的尝试在容量压力下也要留痕。')
    assert.match(rejection.reason, /厚度/)
    assert.ok(rejection.seq > committed.at(-1).seq, '拒绝序号必须晚于上一次成功。')
    await setLimit(tightLimit(metrics, 2, 'committed'))
    await saveThickness(104)
    await page.getByText('构造已保存。', { exact: true }).waitFor()
    metrics = await storage()
    assert.equal(metrics.state.assemblies[0].layers[0].thickness, 104, '拒绝之后的保存仍须生效。')
    metrics.state.audit.forEach((entry, index, list) => {
      if (index > 0) assert.ok(entry.seq > list[index - 1].seq, '审计序号顺序被颠倒。')
    })
    assert.equal(seedId, metrics.state.assemblies[0].id)

    // 阶段三：容量压力 + 跨标签页并发，仍须一胜一负、冲突拒绝入档且顺序正确。
    // 两个标签页必须使用同一配额：失败方的拒绝写入发生在获胜方之后，
    // 若只给失败方很紧的配额，可能把获胜方刚写入的成功条目也截断掉。
    const other = await context.newPage()
    await other.goto(`http://127.0.0.1:${address.port}`)
    await other.locator('[data-check="intensity"]').waitFor()
    const concurrentLimit =
      metrics.other +
      metrics.base +
      entryTemplate(metrics.state, 'committed') * 3 +
      entryTemplate(metrics.state, 'rejected', '另一标签页') * 1
    await setLimit(concurrentLimit)
    await setLimitOn(other, concurrentLimit)
    await Promise.all([
      page.getByLabel('第 1 层厚度', { exact: true }).fill('110'),
      other.getByLabel('第 1 层厚度', { exact: true }).fill('120'),
    ])
    const outcomeOn = (target) =>
      Promise.race([
        target.waitForSelector('text=构造已保存。', { timeout: 8000 }).then(() => 'committed'),
        target
          .waitForSelector('text=另一标签页已修改设计', { timeout: 8000 })
          .then(() => 'rejected'),
      ])
    const waiters = Promise.all([outcomeOn(page), outcomeOn(other)])
    await page.getByRole('button', { name: '保存构造', exact: true }).click()
    await other.getByRole('button', { name: '保存构造', exact: true }).click()
    const concurrent = (await waiters).slice().sort()
    assert.deepEqual(concurrent, ['committed', 'rejected'], '容量压力下并发仍须一成一败。')
    await page.waitForTimeout(250)
    metrics = await storage()
    const tail = metrics.state.audit.slice(-2)
    assert.deepEqual(tail.map((entry) => entry.outcome).sort(), ['committed', 'rejected'])
    assert.ok(tail[0].seq < tail[1].seq, '成功与冲突拒绝的先后必须与锁提交一致。')
    assert.match(tail.find((entry) => entry.outcome === 'rejected').reason, /另一标签页/)
    assert.ok(
      [110, 120].includes(metrics.state.assemblies[0].layers[0].thickness),
      '只有获胜标签页的业务变更落库。',
    )
    await other.close()
    // 另一标签页持有的是旧内存状态；主页面刷新到最新落库版本，继续后续边界。
    await page.reload()
    await page.locator('[data-check="intensity"]').waitFor()

    // 阶段四：容量放不下“业务 + 哪怕 1 条审计”时，截断到清空日志也要保住业务变更。
    metrics = await storage()
    const oneEntry = entryTemplate(metrics.state, 'committed')
    // 余量取半条：纯业务放得下，但任何一条审计都放不下，强制截断到清空。
    await setLimit(metrics.other + metrics.base + Math.floor(oneEntry / 2))
    await saveThickness(130)
    await page.getByText('构造已保存。', { exact: true }).waitFor()
    metrics = await storage()
    assert.equal(metrics.state.assemblies[0].layers[0].thickness, 130, '清空日志也要保住业务变更。')
    assert.equal(metrics.state.audit.length, 0, '容量只够业务数据时审计应被完全截断。')

    // 阶段五：连纯业务数据都放不下：沿用原保存失败提示，落库数据与审计都不得变化。
    await setLimit(metrics.other + metrics.base - 60)
    const before = metrics.state
    await saveThickness(140)
    await page.getByRole('alert').filter({ hasText: '浏览器保存失败' }).waitFor()
    metrics = await storage()
    assert.deepEqual(metrics.state.assemblies, before.assemblies, '彻底失败时落库数据不得变化。')
    assert.equal(metrics.state.audit.length, before.audit.length, '彻底失败不得写入新审计。')
    assert.equal(metrics.state.stamp, before.stamp, '彻底失败不得更换修订标识。')
    // 恢复容量后仍可正常保存（降级没有破坏原有保存机制）。
    await setLimit(2_000_000)
    await page.getByRole('button', { name: '保存构造', exact: true }).click()
    await page.getByText('构造已保存。', { exact: true }).waitFor()
    metrics = await storage()
    assert.equal(metrics.state.assemblies[0].layers[0].thickness, 140)
    assert.equal(metrics.state.audit.at(-1).outcome, 'committed')
  }

  assert.deepEqual(pageErrors, [])
  await context.close()
  console.log(`页面流程通过：${workflow}`)
} finally {
  await browser?.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
  clearTimeout(watchdog)
}
