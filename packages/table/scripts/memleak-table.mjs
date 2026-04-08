/**
 * <zh/> 表格内存泄漏探针 — Playwright 拉起真 Chromium，经 CDP 直接调用 HeapProfiler/Runtime 度量 AdvTable 挂载/卸载后的堆增长
 * <en/> Table memory-leak probe — launches real Chromium via Playwright and calls HeapProfiler/Runtime over CDP to measure heap growth across AdvTable mount/unmount cycles
 *
 * <zh/> 运行：node scripts/memleak-table.mjs [--url http://localhost:5173] [--iterations 10] [--smoke]（需先起 `pnpm -C play dev`，smoke 模式除外）
 * <en/> Run: node scripts/memleak-table.mjs [--url http://localhost:5173] [--iterations 10] [--smoke] (requires `pnpm -C play dev` first, except smoke mode)
 *
 * <zh/> 原理：在 play 宿主内点导航链接于路由 A（含 AdvTable）与路由 B（不含）之间做 SPA 切换，
 * <zh/> 同一执行上下文内每轮切换后强制 GC 再读堆；若组件卸载干净，多轮后堆应持平，持续上扬则判为疑似泄漏。
 * <zh/> 退出码 0=通过 1=疑似泄漏 2=运行错误。
 * <en/> Strategy: clicks nav links to toggle between route A (with AdvTable) and route B (without) inside the play
 * <en/> host within one execution context, forcing GC before each heap read; a clean unmount keeps the heap flat,
 * <en/> steady growth means a suspected leak.
 * <en/> Exit codes: 0=pass 1=suspected leak 2=runtime error.
 */

/* eslint-disable no-console -- <zh/> 探针脚本经 stdout 输出度量报告 | <en/> probe script reports metrics via stdout */

import { createWriteStream, existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'

const DEFAULTS = {
  url: 'http://localhost:5173',
  routeA: '/table',
  routeB: '/form',
  selector: '.adv-table',
  iterations: 10,
  settleMs: 800,
  timeoutMs: 30000,
  maxGrowthMB: 2,
}

/**
 * <zh/> 解析 CLI 参数（零依赖） | <en/> Parse CLI args (zero-dependency)
 * @param argv - <zh/> 进程参数 | <en/> process args
 * @returns <zh/> 归一化配置 | <en/> normalized config
 */
function parseArgs(argv) {
  const cfg = { ...DEFAULTS, smoke: false, snapshotOut: null, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--url') {
      cfg.url = next()
    }
    else if (a === '--route-a') {
      cfg.routeA = next()
    }
    else if (a === '--route-b') {
      cfg.routeB = next()
    }
    else if (a === '--selector') {
      cfg.selector = next()
    }
    else if (a === '--iterations') {
      cfg.iterations = Math.max(1, Number.parseInt(next(), 10) || DEFAULTS.iterations)
    }
    else if (a === '--settle-ms') {
      cfg.settleMs = Number.parseInt(next(), 10) || DEFAULTS.settleMs
    }
    else if (a === '--max-growth-mb') {
      cfg.maxGrowthMB = Number.parseFloat(next()) || DEFAULTS.maxGrowthMB
    }
    else if (a === '--snapshot-out') {
      cfg.snapshotOut = next()
    }
    else if (a === '--smoke') {
      cfg.smoke = true
    }
    else if (a === '--help' || a === '-h') {
      cfg.help = true
    }
  }
  cfg.url = cfg.url.replace(/\/$/, '')
  return cfg
}

/**
 * <zh/> 在 Playwright 浏览器缓存中寻找可用的 Chromium 可执行文件 | <en/> Locate a usable Chromium executable in the Playwright browser cache
 * @returns <zh/> 可执行路径或 null（null 表示交由 Playwright 默认解析） | <en/> executable path or null (null defers to Playwright defaults)
 */
function resolveChromiumExecutable() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXE && existsSync(process.env.PLAYWRIGHT_CHROMIUM_EXE)) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXE
  }
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH
  }
  const roots = [join(homedir(), 'Library/Caches/ms-playwright'), join(homedir(), '.cache/ms-playwright')]
  const candidates = []
  for (const root of roots) {
    let entries = []
    try {
      entries = readdirSync(root)
    }
    catch {
      continue
    }
    for (const e of entries) {
      const m = e.match(/^(chromium|chromium_headless_shell)-(\d+)/)
      if (!m) {
        continue
      }
      const base = join(root, e)
      candidates.push({
        ver: Number.parseInt(m[2], 10),
        paths: [
          join(base, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
          join(base, 'chrome-headless-shell-mac-arm64/chrome-headless-shell'),
          join(base, 'chrome-linux/chrome'),
          join(base, 'chrome-win/chrome.exe'),
        ],
      })
    }
  }
  candidates.sort((a, b) => b.ver - a.ver)
  for (const c of candidates) {
    for (const p of c.paths) {
      if (existsSync(p)) {
        return p
      }
    }
  }
  return null
}

/**
 * <zh/> 启动浏览器（优先缓存中的最新 Chromium，缺失时回退默认） | <en/> Launch the browser (prefers newest cached Chromium, falls back to defaults)
 * @returns <zh/> 浏览器实例 | <en/> browser instance
 */
async function launchBrowser() {
  const executablePath = resolveChromiumExecutable()
  try {
    if (executablePath) {
      return await chromium.launch({ executablePath })
    }
    return await chromium.launch()
  }
  catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!/Executable doesn't exist/i.test(msg)) {
      throw err
    }
    throw new Error(
      `Chromium executable missing. Run \`npx playwright install chromium\` first. Original: ${msg}`,
    )
  }
}

/**
 * <zh/> GC 后读取堆用量与 DOM 规模 | <en/> Read heap usage and DOM size after forced GC
 * @param cdp - <zh/> CDP 会话 | <en/> CDP session
 * @param page - <zh/> 页面 | <en/> page
 * @param selector - <zh/> 表格根选择器 | <en/> table root selector
 * @returns <zh/> 度量快照 | <en/> metric snapshot
 */
async function sampleHeap(cdp, page, selector) {
  await cdp.send('HeapProfiler.collectGarbage')
  const { usedSize } = await cdp.send('Runtime.getHeapUsage')
  const stats = await page.evaluate(sel => ({
    nodes: document.querySelectorAll('*').length,
    tables: document.querySelectorAll(sel).length,
    jsHeap: typeof performance !== 'undefined' && performance.memory
      ? Math.round(performance.memory.usedJSHeapSize)
      : null,
  }), selector)
  return { usedSize, ...stats }
}

/**
 * <zh/> 保存一份完整堆快照（可选，用于 DevTools 离线 diff）——按 chunk 流式落盘，避免大堆下 join 超出字符串长度上限
 * <en/> Save a full heap snapshot (optional, for offline diff in DevTools) — streams chunks to disk to avoid exceeding the max string length on large heaps
 * @param cdp - <zh/> CDP 会话 | <en/> CDP session
 * @param outPath - <zh/> 输出路径 | <en/> output path
 * @returns <zh/> 快照字节数 | <en/> snapshot byte size
 */
async function saveSnapshot(cdp, outPath) {
  const stream = createWriteStream(outPath)
  let bytes = 0
  await new Promise((resolve, reject) => {
    stream.on('error', reject)
    // <zh/> CDP 按序推送 chunk 通知后再回命令响应，故 send resolve 时全部 chunk 已写入
    // <en/> CDP pushes chunk notifications in order before the command response, so all chunks are written when send resolves
    cdp.on('HeapProfiler.addHeapSnapshotChunk', (e) => {
      bytes += e.chunk.length
      stream.write(e.chunk)
    })
    cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false }).then(() => {
      cdp.removeAllListeners('HeapProfiler.addHeapSnapshotChunk')
      stream.end(resolve)
    }, reject)
  })
  return bytes
}

/**
 * <zh/> 烟囱自检：about:blank 上验证 CDP 链路可用 | <en/> Smoke test: verify the CDP chain on about:blank
 */
async function runSmoke() {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.goto('about:blank')
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('HeapProfiler.enable')
    const s = await sampleHeap(cdp, page, '.adv-table')
    console.log(`smoke: heap_used_bytes=${s.usedSize} nodes=${s.nodes} CDP-OK`)
  }
  finally {
    await browser.close()
  }
}

/**
 * <zh/> SPA 内导航：点宿主导航链接切换路由，保持同一执行上下文（泄漏对象在堆内累积才可被观测到）；
 * <zh/> 找不到链接时回退整页 goto（此时堆被重建，只能反映单页加载稳定性，判定效力降级）
 * <en/> In-SPA navigation: click host nav links to switch routes within one execution context (leaked objects
 * <en/> must accumulate in-heap to be observable); falls back to full-page goto when no link exists (heap is
 * <en/> rebuilt then, so only single-load stability is measured and the verdict is downgraded)
 * @param page - <zh/> 页面 | <en/> page
 * @param href - <zh/> 目标路由路径 | <en/> target route path
 * @param cfg - <zh/> 运行配置 | <en/> run config
 * @returns <zh/> 是否走了 SPA 导航 | <en/> whether SPA navigation was used
 */
async function spaNav(page, href, cfg) {
  const link = page.locator(`a[href="${href}"]`).first()
  if (await link.count() > 0) {
    await link.click()
    return true
  }
  console.warn(`warn: no nav link for "${href}", falling back to full reload (weaker leak signal)`)
  await page.goto(`${cfg.url}${href}`, { waitUntil: 'domcontentloaded' })
  return false
}

/**
 * <zh/> 主流程：路由来回导航 + 堆趋势判定 | <en/> Main flow: route toggling + heap trend verdict
 * @param cfg - <zh/> 运行配置 | <en/> run config
 * @returns <zh/> 退出码 | <en/> exit code
 */
async function runProbe(cfg) {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    const urlA = `${cfg.url}${cfg.routeA}`

    try {
      await page.goto(urlA, { waitUntil: 'domcontentloaded', timeout: cfg.timeoutMs })
    }
    catch {
      console.error(`error: cannot reach play dev server at ${urlA}. Start it first: pnpm -C play dev`)
      return 2
    }
    try {
      await page.waitForSelector(cfg.selector, { timeout: cfg.timeoutMs })
    }
    catch {
      console.error(`error: selector "${cfg.selector}" not found on ${urlA}. Is AdvTable rendered there?`)
      return 2
    }

    const cdp = await page.context().newCDPSession(page)
    await cdp.send('HeapProfiler.enable')

    // <zh/> 热身两轮，熨平首屏编译/懒 chunk 噪声 | <en/> Two warmup rounds to flatten first-paint/compile noise
    let downgraded = false
    for (let i = 0; i < 2; i++) {
      downgraded = !(await spaNav(page, cfg.routeB, cfg)) || downgraded
      await page.waitForSelector(cfg.selector, { state: 'detached', timeout: cfg.timeoutMs })
      await page.waitForTimeout(cfg.settleMs)
      downgraded = !(await spaNav(page, cfg.routeA, cfg)) || downgraded
      await page.waitForSelector(cfg.selector, { timeout: cfg.timeoutMs })
      await page.waitForTimeout(cfg.settleMs)
    }
    const baseline = await sampleHeap(cdp, page, cfg.selector)

    const series = []
    let detachedOnB = 0
    for (let i = 0; i < cfg.iterations; i++) {
      downgraded = !(await spaNav(page, cfg.routeB, cfg)) || downgraded
      await page.waitForSelector(cfg.selector, { state: 'detached', timeout: cfg.timeoutMs })
      await page.waitForTimeout(cfg.settleMs)
      const onB = await page.evaluate(sel => document.querySelectorAll(sel).length, cfg.selector)
      detachedOnB = Math.max(detachedOnB, onB)
      downgraded = !(await spaNav(page, cfg.routeA, cfg)) || downgraded
      await page.waitForSelector(cfg.selector, { timeout: cfg.timeoutMs })
      await page.waitForTimeout(cfg.settleMs)
      const s = await sampleHeap(cdp, page, cfg.selector)
      series.push(s)
      console.log(
        `iter ${String(i + 1).padStart(2)}/${cfg.iterations} heap=${(s.usedSize / 1048576).toFixed(2)}MB `
        + `delta=${(((s.usedSize - baseline.usedSize) / 1048576) >= 0 ? '+' : '') + ((s.usedSize - baseline.usedSize) / 1048576).toFixed(2)}MB `
        + `nodes=${s.nodes} tables=${s.tables}`,
      )
    }

    if (cfg.snapshotOut) {
      const bytes = await saveSnapshot(cdp, cfg.snapshotOut)
      console.log(`snapshot saved: ${cfg.snapshotOut} (${(bytes / 1048576).toFixed(1)}MB, open in DevTools > Memory > Load)`)
    }

    const first = series[0].usedSize
    const last = series[series.length - 1].usedSize
    const growthMB = (last - first) / 1048576
    const baseGrowthMB = (last - baseline.usedSize) / 1048576
    console.log(`\nbaseline=${(baseline.usedSize / 1048576).toFixed(2)}MB first=${(first / 1048576).toFixed(2)}MB last=${(last / 1048576).toFixed(2)}MB`)
    console.log(`growth(first->last)=${growthMB >= 0 ? '+' : ''}${growthMB.toFixed(2)}MB threshold=+${cfg.maxGrowthMB.toFixed(2)}MB`)
    console.log(`detached "${cfg.selector}" on routeB max=${detachedOnB} (expect 0)`)

    const leakByHeap = growthMB > cfg.maxGrowthMB
    const leakByDetached = detachedOnB > 0
    if (leakByHeap || leakByDetached) {
      console.log('VERDICT: FAIL — suspected leak. Take two heap snapshots in DevTools > Memory and diff Detached HTMLElement / MutationObserver / ResizeObserver retainers.')
      if (leakByDetached) {
        console.log(`hint: "${cfg.selector}" still present on ${cfg.routeB}; check KeepAlive include / panel destroyOnClose / Teleport targets.`)
      }
      return 1
    }
    console.log(`VERDICT: PASS — heap flat within +${cfg.maxGrowthMB.toFixed(2)}MB over ${cfg.iterations} cycles (baseline delta ${baseGrowthMB >= 0 ? '+' : ''}${baseGrowthMB.toFixed(2)}MB).`)
    if (downgraded) {
      console.log('note: full-reload fallback was used; the verdict reflects single-load stability only, not in-SPA unmount leaks.')
    }
    return 0
  }
  finally {
    await browser.close()
  }
}

const cfg = parseArgs(process.argv.slice(2))
if (cfg.help) {
  console.log('usage: node scripts/memleak-table.mjs [--url http://localhost:5173] [--route-a /table] [--route-b /form] [--selector .adv-table] [--iterations 10] [--settle-ms 800] [--max-growth-mb 2] [--snapshot-out heap.heapsnapshot] [--smoke]')
  process.exit(0)
}

try {
  if (cfg.smoke) {
    await runSmoke()
    process.exit(0)
  }
  process.exit(await runProbe(cfg))
}
catch (err) {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(2)
}
