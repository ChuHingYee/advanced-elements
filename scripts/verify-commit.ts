import fs from 'node:fs'
import process from 'node:process'
import chalk from 'chalk'

const msgPath = process.argv.slice(2)[0]
const msg = fs.readFileSync(msgPath as string, 'utf-8').trim()

// <zh/> 只校验首行（subject）：多行提交信息的 body 不参与格式判定
// <en/> Validate the first line only: commit bodies are out of scope
const subject = msg.split('\n', 1)[0]

const commitRE
  = /^(([\uD83C\uDF00-\uDFFF\uD83D\uDC00-\uDE4F\uDE80-\uDEFF\u2600-\u2B55]) )?(revert: )?(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .{1,50}$/
// <zh/> 发版机器人提交豁免：`chore(release):` 会罗列全部 bumped 包（package@version 列表），
// <zh/> 长度天然超 50 字符，格式仍须合法但不限长
// <en/> Machine release commits are exempt: `chore(release):` lists every bumped
// <en/> package (package@version, …) and legitimately exceeds 50 chars; format still applies
const releaseCommitRE = /^chore\(release\): /
if (!(commitRE.test(subject) || releaseCommitRE.test(subject) || subject.startsWith('Merge'))) {
  console.error(
    `  ${chalk.bgRed.white(' ERROR ')} ${chalk.red(
      '\u63D0\u4EA4\u65E5\u5FD7\u4E0D\u7B26\u5408\u89C4\u8303',
    )}\n\n${chalk.red(
      '  \u5408\u6CD5\u7684\u63D0\u4EA4\u65E5\u5FD7\u683C\u5F0F\u5982\u4E0B(emoji \u548C \u6A21\u5757\u53EF\u9009\u586B)\uFF1A\n\n',
    )}    \n    ${chalk.green(
      '\uD83D\uDCA5 feat(\u6A21\u5757): \u6DFB\u52A0\u4E86\u4E2A\u5F88\u68D2\u7684\u529F\u80FD',
    )}\n    ${chalk.green(
      '\uD83D\uDC1B fix(\u6A21\u5757): \u4FEE\u590D\u4E86\u4E00\u4E9B bug',
    )}\n    ${chalk.green(
      '\uD83D\uDCDD docs(\u6A21\u5757): \u66F4\u65B0\u4E86\u4E00\u4E0B\u6587\u6863',
    )}\n    ${chalk.green(
      '\uD83C\uDFF0 chore(\u6A21\u5757): \u5BF9\u811A\u624B\u67B6\u505A\u4E86\u4E9B\u66F4\u6539',
    )}\n    `,
  )
  process.exit(1) // 返回非0直接退出
}
