import fs from 'node:fs'
import path from 'node:path'
import { demoComponentName } from '../demo-name.mjs'

/** <zh/> 容器起始行：`:::demo <标题> <demo 文件>` | <en/> Container opener: `:::demo <title> <demo file>` */
const OPEN_RE = /^:::[ \t]*demo[ \t]*(.*)$/
/** <zh/> 容器结束行：裸 `:::` | <en/> Container closer: a bare `:::` */
const CLOSE_RE = /^:::[ \t]*$/

/** <zh/> 示例源码在 GitHub 上的定位（分支可由 `DOCS_REPO_BRANCH` 覆盖，因为 master 只有 LICENSE，源码在 develop） | <en/> Where example sources live on GitHub (override the branch via `DOCS_REPO_BRANCH`; `master` holds only LICENSE, sources live on `develop`) */
const REPO_URL = process.env.DOCS_REPO_URL ?? 'https://github.com/ChuHingYee/advanced-elements'
const REPO_BRANCH = process.env.DOCS_REPO_BRANCH ?? 'develop'
/** <zh/> StackBlitz 在线编辑入口：`?file=` 直达示例文件，不用先在文件树里翻 | <en/> StackBlitz online editor entry — `?file=` deep-links straight to the example file */
const STACKBLITZ_URL = process.env.DOCS_STACKBLITZ_URL ?? 'https://stackblitz.com/github/ChuHingYee/advanced-elements'

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

/** <zh/> 16×16 图标（beaker / github / copy / done / code），操作栏用，跟随 `currentColor` | <en/> 16×16 icons (beaker / github / copy / done / code) for the action bar, following `currentColor` */
const ICON = {
  beaker: '<path d="M6 2v5.5L3.4 12.8A2 2 0 0 0 5.1 16h5.8a2 2 0 0 0 1.7-3.2L10 7.5V2"/><path d="M5 2h6"/><path d="M4.6 11h6.8"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  done: '<path d="M20 6 9 17l-5-5"/>',
  code: '<path d="M6 4 2 8l4 4"/><path d="M10 4l4 4-4 4"/>',
  /** <zh/> GitHub 官方 mark（实心），避免与线性图标风格割裂 | <en/> Official GitHub mark (filled) so it does not clash with the line icons */
  github: '<path fill="currentColor" stroke="none" d="M8 .2a8 8 0 0 0-2.5 15.6c.4.1.5-.2.5-.4v-1.4c-2.2.5-2.7-1-2.7-1-.4-1-.9-1.2-.9-1.2-.7-.5 0-.5 0-.5.8.1 1.2.8 1.2.8.7 1.2 1.9.9 2.4.7 0-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.2 0 0 .7-.2 2.2.8a7.5 7.5 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.5 1.2.2 2 .1 2.2.5.5.8 1.2.8 2.1 0 3.1-1.9 3.8-3.7 4 .3.2.5.8.5 1.6v2.4c0 .2.2.5.6.4A8 8 0 0 0 8 .2Z"/>',
}

/**
 * <zh/> 生成操作栏图标（外链与复制按钮共用，尺寸/描边一致）
 * <en/> Build an action-bar icon (shared by external links and the copy button)
 * @param {keyof typeof ICON} name <zh/> 图标名 | <en/> Icon name
 * @returns {string} <zh/> inline SVG 字符串 | <en/> Inline SVG markup
 */
function icon(name) {
  return `<svg class="demo-op-icon demo-op-icon-${name}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`
}

/**
 * <zh/> markdown-it 插件：`:::demo <标题> table/basic.vue` 渲染成 element-plus 同构的「示例 + 操作栏 + 可折叠源码」块
 * <en/> markdown-it plugin: `:::demo <title> table/basic.vue` renders an element-plus-shaped
 * <en/> "showcase + action bar + collapsible source" block.
 *
 * <zh/> 单一真相源是 `.vue` 文件本身：构建期读取源码塞进 fence token（复用 VitePress 的 shiki 高亮与
 * <zh/> 复制按钮），运行期由主题按同名规则注册并渲染真实组件，因此不存在「文档代码与 demo 实现漂移」。
 * <zh/> 源码折叠走纯 CSS 的 checkbox + label（无 JS 也能展开），仅「复制代码」需要主题侧的事件委托。
 * <en/> The `.vue` file is the single source of truth: its source is read at build time into a fence
 * <en/> token (reusing VitePress's shiki highlighting and copy button) while the theme registers the real
 * <en/> component by the same naming rule, so docs code can never drift from the running demo. Source
 * <en/> folding is pure CSS (checkbox + label, works without JS); only "copy code" needs the theme's
 * <en/> event delegation.
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
    const repoPath = `${examplesDir}/${src.split(path.sep).join('/')}`
    const editUrl = `${REPO_URL}/edit/${REPO_BRANCH}/docs/${repoPath}`
    const stackblitzUrl = `${STACKBLITZ_URL}?file=docs/${repoPath}`

    const open = new state.Token('html_block', '', 0)
    open.map = [startLine, closeLine]
    open.content = [
      // 标题在卡片外（element-plus 的 description 位置），卡片内只留示例与操作栏
      `<div class="demo-block-title" id="${domId}-title">${escapeHtml(title)}</div>`,
      `<div class="demo-block" data-demo-src="${escapeHtml(src)}" aria-labelledby="${domId}-title">`,
      // 折叠用的 checkbox 必须是 .demo-block 的首个子元素：操作栏里的 label 才能用 `for` + 兄弟选择器纯 CSS 展开源码
      `<input class="demo-fold-input" type="checkbox" id="${domId}-fold">`,
      '<div class="demo-showcase">',
      // 预览走 ClientOnly：ElTableV2 虚拟网格依赖实测尺寸，服务端渲染不出行，客户端补渲染必然 hydration mismatch
      `<ClientOnly><${demoComponentName(src)} /><template #fallback><div class="demo-placeholder" /></template></ClientOnly>`,
      '</div>',
      '<div class="demo-op-btns">',
      `<a class="demo-op-btn" href="${escapeHtml(stackblitzUrl)}" target="_blank" rel="noopener noreferrer" title="在 StackBlitz 中在线编辑" aria-label="在 StackBlitz 中在线编辑">${icon('beaker')}</a>`,
      `<a class="demo-op-btn" href="${escapeHtml(editUrl)}" target="_blank" rel="noopener noreferrer" title="在 GitHub 中编辑此示例" aria-label="在 GitHub 中编辑此示例">${icon('github')}</a>`,
      `<button type="button" class="demo-op-btn demo-op-copy" data-demo-copy title="复制代码" aria-label="复制代码">${icon('copy')}${icon('done')}</button>`,
      `<label class="demo-op-btn demo-op-fold" for="${domId}-fold" title="查看 / 隐藏源码" aria-label="查看或隐藏源码">${icon('code')}</label>`,
      '</div>',
      '<div class="demo-source">',
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
