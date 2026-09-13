// 统一验证入口：按固定顺序串行执行
//   1. 格式检查（prettier --check）
//   2. 严格类型检查（vue-tsc --noEmit）
//   3. 生产构建（vite build，冒烟检查依赖其产物 dist/）
//   4. 页面冒烟 · 构造编辑（compose）
//   5. 页面冒烟 · 方案比较（compare）
//   6. 页面冒烟 · 计算书（document）
//
// 任一步失败立即终止，并以该步骤专用退出码退出（10–15），日志中带有步骤横幅与 ✓/✗ 标记，
// 可同时从输出与退出码定位失败步骤。CI 与本地从干净环境执行同一条 `npm run verify`。
//
// 前置条件：
//   1. npm ci
//   2. npx playwright install chromium（Linux 另需系统库，见 README“Playwright 浏览器准备”）
//
// 需要单独定位问题时仍可直接运行：
//   npm run format:check / npm run typecheck / npm run build / npm run smoke -- <compose|compare|document>

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const node = process.execPath

// glob 原样传给 Prettier，由其内部展开；不经过 shell，Windows/macOS/Linux 行为一致。
const steps = [
  {
    id: 'format',
    title: '1/6 格式检查（prettier --check）',
    exitCode: 10,
    args: [path.join(root, 'node_modules/prettier/bin/prettier.cjs'), '--check', 'src/**/*.{ts,vue,css}', 'vite.config.ts'],
  },
  {
    id: 'typecheck',
    title: '2/6 严格类型检查（vue-tsc --noEmit）',
    exitCode: 11,
    args: [path.join(root, 'node_modules/vue-tsc/bin/vue-tsc.js'), '--noEmit'],
  },
  {
    id: 'build',
    title: '3/6 生产构建（vite build）',
    exitCode: 12,
    args: [path.join(root, 'node_modules/vite/bin/vite.js'), 'build'],
  },
  {
    id: 'smoke:compose',
    title: '4/6 页面冒烟检查 · 构造编辑（compose）',
    exitCode: 13,
    args: [path.join(root, 'scripts/smoke.mjs'), 'compose'],
  },
  {
    id: 'smoke:compare',
    title: '5/6 页面冒烟检查 · 方案比较（compare）',
    exitCode: 14,
    args: [path.join(root, 'scripts/smoke.mjs'), 'compare'],
  },
  {
    id: 'smoke:document',
    title: '6/6 页面冒烟检查 · 计算书（document）',
    exitCode: 15,
    args: [path.join(root, 'scripts/smoke.mjs'), 'document'],
  },
]

function runStep(step) {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const child = spawn(node, step.args, { cwd: root, stdio: 'inherit', env: process.env })
    child.on('error', (error) => resolve({ code: null, signal: null, launcherError: error }))
    child.on('close', (code, signal) =>
      resolve({ code, signal, launcherError: null, ms: Date.now() - startedAt }),
    )
  })
}

for (const step of steps) {
  console.log(`\n=== 开始：${step.title} ===`)
  const result = await runStep(step)
  if (result.launcherError) {
    console.error(`\n✗ ${step.id} 无法启动：${result.launcherError.message}`)
    console.error('  请确认已在干净检出中执行 `npm ci`，并完成 Playwright 浏览器准备（见 README）。')
    process.exit(step.exitCode)
  }
  if (result.code === 0) {
    console.log(`\n✓ ${step.id} 通过（${(result.ms / 1000).toFixed(1)}s）`)
    continue
  }
  const reason = result.signal ? `被信号 ${result.signal} 终止` : `退出码 ${result.code}`
  console.error(`\n✗ ${step.id} 失败（${reason}）。统一验证在此终止，退出码 ${step.exitCode}。`)
  process.exit(step.exitCode)
}

console.log(
  '\n=== 全部 6 步通过：格式检查、严格类型检查、生产构建、compose / compare / document 页面冒烟检查 ===',
)
