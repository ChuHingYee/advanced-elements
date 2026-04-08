/* eslint-disable no-console -- <zh/> 覆盖率报告脚本经 stdout 输出 | <en/> coverage report script prints via stdout */
const fs = require('node:fs')
const process = require('node:process')

const data = JSON.parse(fs.readFileSync('packages/table/coverage/coverage-final.json', 'utf8'))
const needle = process.argv[2]
for (const k of Object.keys(data)) {
  if (k.includes(needle)) {
    const c = data[k]
    const uncovered = []
    for (const [id, loc] of Object.entries(c.statementMap || {})) {
      if (c.s[id] === 0)
        uncovered.push(`${loc.start.line}-${loc.end.line}`)
    }
    console.log(k.split('table').pop())
    console.log(`  uncovered: ${uncovered.slice(0, 60).join(',')}`)
  }
}
