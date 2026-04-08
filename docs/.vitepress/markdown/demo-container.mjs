import fs from 'node:fs'
import path from 'node:path'
import { demoComponentName } from '../demo-name.mjs'

/** <zh/> 容器起始行：`:::demo <标题> <demo 文件>` | <en/> Container opener: `:::demo <title> <demo file>` */
const OPEN_RE = /^:::[ \t]*demo[ \t]*(.*)$/
/** <zh/> 容器结束行：裸 `:::` | <en/> Container closer: a bare `:::` */
const CLOSE_RE = /^:::[ \t]*$/

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }

function escapeHtml(str) {
  return str.replace(/[&<>"]/g, char => HTML_ESCAPES[char])
}

function fail(state, startLine, message) {
  const where = state.env?.path ? `${path.basename(state.env.path)}:${startLine + 1}` : `line ${startLine + 1}`
  throw new Error(`[demo] ${where} ${message}`)
}

/**
 * <zh/> 解析容器参数行——最后一个以 `.vue` 结尾的记号是 demo 文件，其前是标题
 * <en/> Parse the container's argument line — the last `.vue` token is the demo file, the rest is the title
 * @param {string} raw <zh/> 去掉 `:::demo` 后的剩余文本 | <en/> Text after `:::demo`
 * @returns {{ title: string, src: string }} <zh/> 标题与相对 `examples/` 的 demo 路径 | <en/> Title and demo path relative to `examples/`
 */
function parseArgs(raw) {
  const tokens = raw.trim().split(/\s+/).filter(Boolean)
  const src = tokens.findLast(token => token.endsWith('.vue'))
  if (!src)
    return { title: tokens.join(' '), src: '' }
  const title = tokens.filter(token => token !== src).join(' ')
  return { title: title || path.basename(src, '.vue'), src }
}

/**
 * <zh/> markdown-it 插件：`:::demo <标题> table/basic.vue` 渲染成「演示 / 代码」双栏块
 * <en/> markdown-it plugin: `:::demo <title> table/basic.vue` renders a preview/code block.
 *
 * <zh/> 单一真相源是 `.vue` 文件本身：构建期读取源码塞进 fence token（复用 VitePress 的 shiki 高亮与
 * <zh/> 复制按钮），运行期由主题按同名规则注册并渲染真实组件，因此不存在「文档代码与 demo 实现漂移」。
 * <zh/> 面板切换走纯 CSS 的 radio + label，无客户端脚本、无第三方运行时。
 * <en/> The `.vue` file is the single source of truth: its source is read at build time into a fence
 * <en/> token (reusing VitePress's shiki highlighting and copy button) while the theme registers the real
 * <en/> component by the same naming rule, so docs code can never drift from the running demo. Panel
 * <en/> switching is pure CSS (radio + label) — no client script and no third-party runtime.
 *
 * @param {import('markdown-it')} md <zh/> VitePress 传入的 markdown-it 实例 | <en/> markdown-it instance handed over by VitePress
 * @param {object} options <zh/> 插件配置 | <en/> Plugin options
 * @param {string} options.srcDir <zh/> docs 目录（`vitepress dev <srcDir>` 的入参） | <en/> The docs directory passed to `vitepress dev`
 * @param {string} [options.examplesDir] <zh/> demo 源码根目录名，相对 `srcDir` | <en/> Demo source root, relative to `srcDir`
 */
export function demoContainerPlugin(md, { srcDir, examplesDir = 'examples' }) {
  md.block.ruler.before('fence', 'demo', (state, startLine, endLine, silent) => {
    if (state.sCount[startLine] - state.blkIndent >= 4)
      return false

    const start = state.bMarks[startLine] + state.tShift[startLine]
    const matched = OPEN_RE.exec(state.src.slice(start, state.eMarks[startLine]))
    if (!matched)
      return false
    if (silent)
      return true

    const { title, src } = parseArgs(matched[1])
    if (!src)
      fail(state, startLine, '参数格式为 `:::demo <标题> <文件名.vue>`，未找到 .vue 文件')

    const examplesRoot = path.resolve(srcDir, examplesDir)
    const file = path.resolve(examplesRoot, src)
    if (!file.startsWith(`${examplesRoot}${path.sep}`))
      fail(state, startLine, `demo 路径必须位于 ${examplesDir}/ 内：${src}`)
    if (!fs.existsSync(file))
      fail(state, startLine, `demo 文件不存在：${path.join(examplesDir, src)}`)

    let closeLine = -1
    for (let line = startLine + 1; line < endLine; line++) {
      const from = state.bMarks[line] + state.tShift[line]
      if (CLOSE_RE.test(state.src.slice(from, state.eMarks[line]))) {
        closeLine = line
        break
      }
    }
    if (closeLine === -1)
      fail(state, startLine, '容器未闭合，缺少结尾的 `:::`')

    for (let line = startLine + 1; line < closeLine; line++) {
      if (state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]).trim())
        fail(state, line, '容器体内不支持内容，请把说明写进标题或正文')
    }

    const index = (state.env.demoBlocks = (state.env.demoBlocks ?? 0) + 1)
    const domId = `demo-${index}`

    const open = new state.Token('html_block', '', 0)
    open.map = [startLine, closeLine]
    open.content = [
      '<div class="demo-block">',
      `<input class="demo-tab-input" type="radio" name="${domId}" id="${domId}-preview" checked>`,
      `<input class="demo-tab-input" type="radio" name="${domId}" id="${domId}-code">`,
      '<div class="demo-block-header">',
      `<span class="demo-block-title">${escapeHtml(title)}</span>`,
      '<div class="demo-tabs">',
      `<label class="demo-tab" for="${domId}-preview">演示</label>`,
      `<label class="demo-tab" for="${domId}-code">代码</label>`,
      '</div></div>',
      // 预览走 ClientOnly：ElTableV2 虚拟网格依赖实测尺寸，服务端渲染不出行，客户端补渲染必然 hydration mismatch
      `<div class="demo-block-preview"><ClientOnly><${demoComponentName(src)} /><template #fallback><div class="demo-block-placeholder" /></template></ClientOnly></div>`,
      '<div class="demo-block-code">',
    ].join('')

    const code = new state.Token('fence', 'code', 0)
    code.map = [startLine, closeLine]
    code.info = 'vue'
    code.content = `${fs.readFileSync(file, 'utf-8').replace(/\s+$/, '')}\n`
    code.markup = '```'
    code.block = true

    const close = new state.Token('html_block', '', 0)
    close.map = [closeLine, closeLine + 1]
    close.content = '</div></div>'

    state.tokens.push(open, code, close)
    state.line = closeLine + 1
    return true
  }, { alt: ['paragraph', 'reference', 'blockquote'] })
}