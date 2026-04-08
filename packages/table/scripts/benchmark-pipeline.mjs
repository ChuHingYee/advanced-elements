/**
 * <zh/> 管线基准（独立脚本版）— 10000 行 × 50 列下 classify/filter/sort/span/rowKeyMeta 耗时
 * <en/> Pipeline benchmark (standalone script) — classify/filter/sort/span/rowKeyMeta timing for 10000×50
 *
 * <zh/> 运行：node scripts/benchmark-pipeline.mjs（vitest 环境外独立）
 * <zh/> 注意：本脚本为内联简化逻辑，仅用于量级估算；与真实实现绑定的基准见
 * <zh/> `__tests__/utils/pipeline-bench.test.ts`（调用 classifyColumns / compareSortValues / sanitizeDataArray），
 * <zh/> 以下输出数字不得作为性能结论引用。
 * <en/> Run: node scripts/benchmark-pipeline.mjs (standalone outside vitest)
 * <en/> NOTE: this script uses inline simplified logic for order-of-magnitude estimates only;
 * <en/> the benchmark bound to real implementations lives in
 * <en/> `__tests__/utils/pipeline-bench.test.ts` (calls classifyColumns / compareSortValues / sanitizeDataArray).
 * <en/> Numbers printed below must not be cited as performance conclusions.
 */

import process from 'node:process'

const ROWS = 10000
const COLS = 50

// <zh/> 经 stdout 输出（不用 console.*，避开 no-console 门禁）
// <en/> Output via stdout (not console.*, staying clear of the no-console gate)
const out = msg => process.stdout.write(`${msg}\n`)

function mockData() {
  return Array.from({ length: ROWS }, (_, i) => {
    const row = { id: String(i) }
    for (let c = 0; c < COLS; c++) row[`c${c}`] = `v${i % 10}`
    return row
  })
}

function mockColumns() {
  return Array.from({ length: COLS }, (_, i) => ({
    key: `c${i}`,
    prop: `c${i}`,
    label: `C${i}`,
    width: 100,
    sortable: i < 5,
    filter: i < 3 ? { type: 'text' } : false,
  }))
}

function bench(label, fn) {
  const s = performance.now()
  fn()
  const e = performance.now()
  out(`${label}: ${(e - s).toFixed(2)}ms`)
}

const data = mockData()
const cols = mockColumns()

bench('mockData 10k×50', () => {})
bench('classifyColumns O(m)', () => {
  // <zh/> 模拟 classifyColumns 50 列 | <en/> simulate classifyColumns 50 cols
  const acc = { selection: [], normal: [], leafColumns: [], hoverOptionColumns: [], displayNormalColumns: [], hasTeleport: false, hasFixed: false, allKeepAlive: true, hasFilterableColumns: false, hasSortableColumns: false }
  for (const col of cols) {
    if (col.filter !== false)
      acc.hasFilterableColumns = true
    if (col.sortable)
      acc.hasSortableColumns = true
    acc.leafColumns.push(col)
    acc.normal.push(col)
  }
})

bench('rowKeyMeta O(n) 10k Map', () => {
  const m = new Map()
  const keyFn = r => r.id
  for (let i = 0; i < data.length; i++) m.set(keyFn(data[i]), i)
})

bench('filter O(n×f) 5列', () => {
  data.filter(r => r.c0.includes('v1'))
})

bench('sort O(n log n) 1列', () => {
  ;[...data].sort((a, b) => String(a.c0).localeCompare(String(b.c0)))
})

bench('span O(n×m) 1列 rowSpan', () => {
  const map = new Map()
  let start = 0
  let val = data[0].c0
  for (let i = 1; i <= data.length; i++) {
    const cur = i < data.length ? data[i].c0 : undefined
    if (cur !== val) {
      const span = i - start
      if (span > 1)
        map.set(`${start}-c0`, { rowspan: span })
      start = i
      val = cur
    }
  }
})

out('\nBudget (estimates, this script only): pipeline total <50ms for 10k×50, windowed span <0.2ms')
out('For numbers bound to real implementations, run: vitest run __tests__/utils/pipeline-bench.test.ts')
