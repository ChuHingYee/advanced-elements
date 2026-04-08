/**
 * <zh/> 降级复制（使用 document.execCommand）。
 * <en/> Fallback copy (using document.execCommand).
 *
 * <zh/> Clipboard API 在某些上下文（iframe / 非 HTTPS）不可用，此函数通过动态创建隐藏 textarea 实现通用复制。
 * <en/> The Clipboard API is unavailable in some contexts (iframe / non-HTTPS); this function copies universally via a dynamically created hidden textarea.
 *
 * @param text - <zh/> 待复制的文本内容 | <en/> text content to copy
 * @returns <zh/> 是否复制成功 | <en/> whether the copy succeeded
 * @see https://developer.mozilla.org/zh-CN/docs/Web/API/Document/execCommand
 */
function fallbackCopy(text: string): boolean {
  // SSR 环境无 document，直接返回失败由调用方处理
  // Without document in SSR, return failure for the caller to handle
  if (typeof document === 'undefined')
    return false
  const textarea = document.createElement('textarea')
  textarea.value = text
  // <zh/> 瞬态复制节点——readonly 避免移动端弹出键盘，tabindex/aria-hidden 使其脱离焦点流与无障碍树
  // <en/> Transient copy node — readonly avoids mobile keyboards, tabindex/aria-hidden keep it out
  // <en/> of the focus order and the accessibility tree
  textarea.setAttribute('readonly', '')
  textarea.setAttribute('aria-hidden', 'true')
  textarea.setAttribute('tabindex', '-1')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  try {
    textarea.focus()
    textarea.select()
    return document.execCommand('copy')
  }
  catch {
    return false
  }
  finally {
    try {
      document.body.removeChild(textarea)
    }
    catch {
      // 兜底：若 removeChild 失败（如已被移除），静默忽略
      // Fallback: silently ignore if removeChild fails (e.g. already removed)
    }
  }
}

/**
 * <zh/> 复制文本到剪贴板（纯函数，无副作用）。
 * <en/> Copy text to the clipboard (pure function, no side effects).
 *
 * <zh/> 优先使用 Clipboard API，不支持时降级到 execCommand；不依赖 Vue 响应式系统，可在任意上下文调用。
 * <en/> Prefers the Clipboard API and falls back to execCommand when unavailable; does not depend on Vue's reactivity, so it can be called in any context.
 *
 * @param text - <zh/> 要复制到剪贴板的文本 | <en/> text to copy to the clipboard
 * @returns <zh/> Promise<boolean> —— 复制成功返回 true，失败返回 false | <en/> Promise<boolean> — true on success, false on failure
 *
 * @example
 * await copyToClipboard('hello world')
 * // => true
 *
 * @example
 * if (await copyToClipboard('data')) {
 *   // 复制成功
 * }
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // SSR 环境无 navigator，直接走失败路径
  // Without navigator in SSR, take the failure path directly
  if (typeof navigator === 'undefined')
    return false
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    }
    catch {
      // <zh/> Clipboard 写入失败（如权限拒绝）时回落到 execCommand 方案 | <en/> Fall back to the execCommand path when Clipboard write fails (e.g. permission denied)
    }
  }

  return fallbackCopy(text)
}
