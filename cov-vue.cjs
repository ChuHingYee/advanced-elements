/* eslint-disable no-console -- <zh/> 覆盖率报告脚本经 stdout 输出 | <en/> coverage report script prints via stdout */
const fs = require('node:fs')
const process = require('node:process')

const covPath = process.argv[2]
const filter = (process.argv[3] || '').toLowerCase()
const data = JSON.parse(fs.readFileSync(covPath, 'utf8'))
const rows = []
for (const k of Object.keys(data)) {
  const kl = k.toLowerCase().replace(/\\/g, '/')
  if (filter && !kl.includes(filter))
    continue
  if (!/\.(vue|tsx)$/.test(kl))
    continue
  const c = data[k]
  const s = Object.values(c.s || {})
  const f = Object.values(c.f || {})
  const sc = s.filter(v => v > 0).length
  const fc = f.filter(v => v > 0).length
  if (!s.length)
    continue
  rows.push({ pct: sc / s.length * 100, line: `${(sc / s.length * 100).toFixed(1)}% s:${sc}/${s.length} f:${fc}/${f.length} gap:${s.length - sc} ${k.split('components').pop()}` })
}
rows.sort((a, b) => a.pct - b.pct)
console.log(rows.map(r => r.line).join('\n'))
console.log('TOTAL-GAP:', rows.reduce(a => a + 0, 0))
