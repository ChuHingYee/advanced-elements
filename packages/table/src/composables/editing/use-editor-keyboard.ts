/**
 * <zh/> 编辑器键盘与提交状态管理 composable
 * <en/> Editor keyboard and commit state management composable
 * @remarks
 * <zh/> 统一处理所有单元格编辑器的键盘快捷键、blur 提交和 committed 防重复提交逻辑
 * <en/> Unified handling of keyboard shortcuts, blur commit, and committed anti-duplicate logic for all cell editors
 */
import { onActivated, onMounted, shallowRef } from 'vue'

/**
 * <zh/> 键盘快捷键配置选项
 * <en/> Keyboard shortcut configuration options
 */

export interface UseEditorKeyboardOptions {
  /** <zh/> 是否跳过 Enter 键提交（textarea 模式下 Enter 为换行而非提交） | <en/> Whether to skip Enter key commit (in textarea mode, Enter is newline instead of commit) */
  skipEnter?: boolean
  /** <zh/> 是否在 Enter 时提交（多选 select 模式下 Enter 确认提交） | <en/> Whether to commit on Enter (in multi-select mode, Enter confirms the selection) */
  enterCommits?: boolean
  /** <zh/> Home/End 导航回调 — 返回目标单元格位置以提交并导航，返回 null 则忽略 | <en/> Home/End navigation callback — return target cell to commit and navigate, null to ignore */
  onHomeEnd?: (key: 'Home' | 'End') => { rowIndex: number, columnKey: string, prop: string } | null
}

export interface UseEditorKeyboardReturn {
  /** <zh/> 防重复提交标记——首次 stopEditing 后置 true，阻止 blur/visible-change 重复触发 | <en/> Anti-duplicate commit flag — set to true after first stopEditing, prevents blur/visible-change from triggering again */
  committed: import('vue').Ref<boolean>
  /** <zh/> 键盘事件处理器——绑定到编辑器组件的 @keydown | <en/> Keyboard event handler — bind to @keydown on editor component */
  handleKeydown: (e: Event | KeyboardEvent) => void
  /** <zh/> blur 事件处理器——绑定到编辑器组件的 @blur，已 committed 时跳过 | <en/> Blur event handler — bind to @blur on editor component, skipped when already committed */
  handleBlur: () => void
  /** <zh/> 标记为已提交——供 change/visible-change 等非键盘事件使用 | <en/> Mark as committed — for non-keyboard events like change/visible-change */
  markCommitted: () => void
  /** <zh/> 重置 committed 标记——在 onMounted 中自动调用 | <en/> Reset committed flag — called automatically in onMounted */
  resetCommitted: () => void
}
/**
 * 提取编辑器通用的键盘快捷键与 committed 防重复提交逻辑。
 * 所有单元格编辑器共享 Escape 取消、Enter/Tab 确认、blur 自动提交等行为，
 * 通过此 composable 消除编辑器间的重复代码。
 *
 * @param stopEditing - 结束编辑回调
 * @param [options] - 键盘行为配置
 * @returns 键盘处理器和 committed 状态
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const emit = defineEmits<{ (e: 'stopEditing', commit: boolean, reason?: string): void }>
 * const { committed, handleKeydown, handleBlur, markCommitted } = useEditorKeyboard(emit.stopEditing)
 * </script>
 * ```
 */
export function useEditorKeyboard(
  stopEditing: (commit: boolean, reason?: string) => void,
  options: UseEditorKeyboardOptions = {},
): UseEditorKeyboardReturn {
  const { skipEnter = false, enterCommits = true, onHomeEnd } = options

  const committed = shallowRef(false)

  function resetCommitted(): void {
    committed.value = false
  }

  function markCommitted(): void {
    committed.value = true
  }

  onMounted(() => {
    resetCommitted()
  })

  /**
   * <zh/> KeepAlive/虚拟复用下组件实例可能不重挂载（mounted 不重跑），committed 残留 true 会导致
   * <zh/> 后续 blur 永不提交——激活时同样重置（非 KeepAlive 下无操作）。
   * <en/> Reused editor instances (KeepAlive/virtual reuse) may skip remounting, leaving a stale
   * <en/> committed=true that blocks all later blur commits — reset on activation as well (no-op
   * <en/> without KeepAlive).
   */
  onActivated(() => {
    resetCommitted()
  })

  /**
   * <zh/> 统一键盘事件处理器
   * <en/> Unified keyboard event handler
   *
   * <zh/> 根据按键类型执行对应的编辑操作：
   * - Escape: 取消编辑，不提交
   * - Enter: 确认提交（skipEnter 时跳过，适用于 textarea 多行编辑）
   * - Tab: 确认提交并跳到下一单元格（Shift+Tab 跳到上一单元格）
   * - Home/End: 提交并导航到行首/行尾可编辑列（需配置 onHomeEnd 回调）
   * <en/> Performs the corresponding edit operation based on key type:
   * - Escape: cancel edit, no commit
   * - Enter: confirm commit (skipped when skipEnter is true, for textarea multiline editing)
   * - Tab: confirm commit and navigate to next cell (Shift+Tab for previous cell)
   * - Home/End: commit and navigate to first/last editable column (requires onHomeEnd callback)
   *
   * @param e - <zh/> 键盘事件对象 | <en/> keyboard event object
   */
  /**
   * <zh/> IME（输入法）组合输入检测——中文/日文/韩文等输入法在组词期间按 Enter 是"确认候选词"
   * <zh/> 而非"提交编辑"，keyCode 229 为组合中各浏览器通用的历史标记。
   * <zh/> 缺失此守卫时，CJK 用户确认候选词会误提交单元格（audit）。
   * <en/> IME composition detection — during CJK composition, Enter confirms the candidate word
   * <en/> rather than committing the edit; keyCode 229 is the legacy cross-browser in-composition marker.
   * <en/> Without this guard, CJK users confirming candidates would accidentally commit the cell (audit).
   */
  function isComposing(e: KeyboardEvent): boolean {
    if (e.isComposing)
      return true
    return (e as KeyboardEvent & { keyCode?: number }).keyCode === 229
  }

  function handleKeydown(e: Event | KeyboardEvent): void {
    if (!('key' in e))
      return
    const keyEvent = e as KeyboardEvent
    // <zh/> 组合输入期间的 Enter/Tab/Home/End 一律放行为输入法事件，不做编辑操作 | <en/> During composition, Enter/Tab/Home/End belong to the IME — no edit actions
    if (isComposing(keyEvent))
      return
    if (e.key === 'Escape') {
      e.stopPropagation()
      markCommitted()
      stopEditing(false, 'escape')
    }
    else if (e.key === 'Enter' && enterCommits && !skipEnter) {
      e.stopPropagation()
      markCommitted()
      stopEditing(true, 'enter')
    }
    else if (e.key === 'Tab') {
      e.preventDefault()
      e.stopPropagation()
      markCommitted()
      stopEditing(true, e.shiftKey ? 'shift-tab' : 'tab')
    }
    else if ((e.key === 'Home' || e.key === 'End') && onHomeEnd) {
      const target = onHomeEnd(e.key)
      if (target) {
        e.preventDefault()
        e.stopPropagation()
        markCommitted()
        stopEditing(true, e.key === 'Home' ? 'home' : 'end')
      }
    }
  }

  function handleBlur(): void {
    if (committed.value)
      return
    stopEditing(true)
  }

  return {
    committed,
    handleKeydown,
    handleBlur,
    markCommitted,
    resetCommitted,
  }
}
