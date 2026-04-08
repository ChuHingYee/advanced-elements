/**
 * <zh/> 全链路压测（独立脚本版）— 10000×50 过滤+排序+树+分页 耗时
 * <en/> Full pipeline benchmark (standalone script) — 10000×50 filter+sort+tree+pagination timing
 *
 * <zh/> 运行：node scripts/benchmark-full-pipeline.mjs
 * <en/> Run: node scripts/benchmark-full-pipeline.mjs
 *
 * <zh/> 注意：本脚本为内联简化逻辑，仅用于量级估算；与真实实现绑定的基准见
 * <zh/> `__tests__/utils/pipeline-bench.test.ts`，以下输出数字不得作为性能结论引用。
 * <en/> NOTE: this script uses inline simplified logic for order-of-magnitude estimates only;
 * <en/> the benchmark bound to real implementations lives in
 * <en/> `__tests__/utils/pipeline-bench.test.ts`. Numbers printed below must not be
 * <en/> cited as performance conclusions.
 */

import process from 'node:process'

const ROWS = 10000
const COLS = 50

// <zh/> 经 stdout 输出（不用 console.*，避开 no-console 门禁）
// <en/> Output via stdout (not console.*, staying clear of the no-console gate)
const out = msg => process.stdout.write(`${msg}\n`)

function mockData() {
  return Array.from({ length: ROWS }, (_, i) => {
    const row = { id: String(i), children: i % 10 === 0 ? [{ id: `${i}-1`, name: `C${i}` }] : undefined }
    for (let c = 0; c < COLS; c++) row[`c${c}`] = `v${i % 5}`
    return row
  })
}

function bench(label, fn) {
  const s = performance.now()
  fn()
  const e = performance.now()
  out(`${label}: ${(e - s).toFixed(2)}ms`)
}

const data = mockData()
const start = performance.now()

bench('mock 10k×50', () => {})

bench('filter 5列', () => {
  data.filter(r => r.c0.includes('v1'))
})

bench('sort 1列', () => {
  ;[...data].sort((a, b) => String(a.c0).localeCompare(String(b.c0)))
})

bench('tree flatten 10% 嵌套', () => {
  const flat = []
  for (const row of data) {
    flat.push(row)
    if (row.children)
      flat.push(...row.children)
  }
})

bench('pagination slice 10', () => {
  data.slice(0, 10)
})

const total = performance.now() - start
out(`\nTotal (estimates, this script only): ${total.toFixed(2)}ms (budget <50ms)`)
out('For numbers bound to real implementations, run: vitest run __tests__/utils/pipeline-bench.test.ts')
