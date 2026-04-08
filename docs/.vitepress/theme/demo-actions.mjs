/**
 * <zh/> demo 块操作栏的「复制代码」：document 级事件委托，SSR 下不注册
 * <zh/> 源码不额外打进 bundle——从已高亮的 DOM 反解（与 VitePress 自带复制按钮同一口径）
 * <en/> The demo block "copy code" button: document-level event delegation, skipped during SSR.
 * <en/> Sources are not shipped separately — they are recovered from the highlighted DOM, matching how
 * <en/> VitePress's own copy button works.
 * <zh/> 折叠/展开不用这里：`.demo-fold-input` checkbox + `for` label 的纯 CSS 方案在无 JS 时同样可用
 * <en/> Folding needs none of this: the `.demo-fold-input` checkbox plus its `for` label folds in pure CSS
 */

const COPY_FEEDBACK_MS = 2000

const resetTimers = new WeakMap()

/**
 * <zh/> 写剪贴板：优先 `navigator.clipboard`，非安全上下文（http / 老浏览器）回落到隐藏 textarea + `execCommand`
 * <en/> Write to the clipboard — `navigator.clipboard` first, hidden textarea + `execCommand` as the
 * <en/> fallback for insecure contexts and older browsers
 * @param {string} text <zh/> 待写入文本 | <en/> Text to write
 * @returns {Promise<void>} <zh/> 复制完成后 resolve | <en/> Resolves once the text is on the clipboard
 */
async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return
  }
  catch {
    // <zh/> 非安全上下文下 clipboard API 不存在或被拒，走 DOM 兜底
    // <en/> No usable clipboard API outside secure contexts, fall back to the DOM
  }
  const element = document.createElement('textarea')
  element.value = text
  element.setAttribute('readonly', '')
  element.style.position = 'absolute'
  element.style.left = '-9999px'
  element.style.fontSize = '12pt'
  document.body.appendChild(element)
  element.select()
  element.selectionStart = 0
  element.selectionEnd = text.length
  document.execCommand('copy')
  document.body.removeChild(element)
}

/**
 * <zh/> 反解 demo 源码：shiki 把每行渲成 `.line` span，行间是真实换行符，`textContent` 即原始源码
 * <en/> Recover the demo source — shiki renders each line as a `.line` span separated by real newlines,
 * <en/> so `textContent` is the original source
 * @param {Element} block <zh/> `.demo-block` 元素 | <en/> The `.demo-block` element
 * @returns {string} <zh/> 去掉尾部空行的源码 | <en/> Source with trailing blank lines trimmed
 */
function readDemoSource(block) {
  const code = block.querySelector('.demo-source pre')
  return (code?.textContent ?? '').replace(/\n+$/, '')
}

/**
 * <zh/> 复制成功的视觉反馈：对勾图标 + 文案切换，2s 后还原
 * <en/> Visual feedback for a successful copy: check icon plus label swap, reverted after 2s
 * @param {HTMLButtonElement} button <zh/> 被点击的复制按钮 | <en/> The clicked copy button
 */
function flashCopied(button) {
  const reset = () => {
    button.classList.remove('copied')
    button.title = '复制代码'
    button.setAttribute('aria-label', '复制代码')
    resetTimers.delete(button)
  }
  button.classList.add('copied')
  button.title = '已复制'
  button.setAttribute('aria-label', '已复制')
  const previous = resetTimers.get(button)
  if (previous)
    clearTimeout(previous)
  resetTimers.set(button, setTimeout(reset, COPY_FEEDBACK_MS))
}

/**
 * <zh/> 在 VitePress 主题里挂上 demo 操作栏行为（`enhanceApp` 调一次，跨页路由无需重复绑定）
 * <en/> Wire up the demo action bar for the VitePress theme (called once from `enhanceApp`; routing
 * <en/> re-renders content but never rebinds)
 */
export function setupDemoActions() {
  if (typeof document === 'undefined')
    return

  document.addEventListener('click', async (event) => {
    const target = event.target
    if (!(target instanceof Element))
      return
    const button = target.closest('[data-demo-copy]')
    if (!button)
      return
    const block = button.closest('.demo-block')
    if (!block)
      return
    event.preventDefault()
    await writeClipboard(readDemoSource(block))
    flashCopied(button)
  })
}
