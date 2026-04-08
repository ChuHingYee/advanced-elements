import type { ComputedRef, Ref } from 'vue'
import type { CellEditStopReason, EditConfig } from '../../types/edit'

import { onClickOutside } from '@vueuse/core'
import { computed, watch } from 'vue'
import { EP_ANY_POPPER_SELECTOR } from '../../utils/ep-selectors'

/**
 * <zh/> 编辑器失焦提交逻辑
 * <en/> Editor blur commit logic
 *
 * @remarks
 * <zh/> 仅在编辑状态下注册 onClickOutside 监听，避免非编辑时全局 click 事件处理开销。
 * 排除编辑器弹层（Select/DatePicker/DateTimePicker 等 Teleport 到 body 的面板）防止点击下拉项或日期面板时误触提交
 * <en/> Only registers onClickOutside listener during editing, avoiding global click event overhead when not editing.
 * Excludes editor popups (Select/DatePicker/DateTimePicker panels teleported to body) to prevent accidental commit when clicking dropdown items or date panels
 *
 * @param options - <zh/> 失焦提交选项 | <en/> blur commit options
 * @param options.containerRef - <zh/> 表格根元素 ref | <en/> table root element ref
 * @param options.editingCell - <zh/> 当前编辑中的单元格状态 ref | <en/> current editing cell state ref
 * @param options.editingRowIndex - <zh/> 当前编辑行索引 ref | <en/> current editing row index ref
 * @param options.editConfig - <zh/> 编辑配置 getter | <en/> edit config getter
 * @param options.stopEditing - <zh/> 停止编辑函数 | <en/> stop editing function
 * @returns isEditingActive - <zh/> 编辑是否激活的 computed | <en/> computed indicating whether editing is active
 */
export function useEditorBlur(options: {
  containerRef: Ref<HTMLElement | null>
  editingCell: Ref<{ rowIndex: number, columnKey: string } | null | undefined>
  editingRowIndex: Ref<number | null | undefined>
  editConfig: () => EditConfig | undefined
  stopEditing: (reason: CellEditStopReason, commit?: boolean) => void
}): ComputedRef<boolean> {
  // <zh/> 命名空间无关的子串匹配（见 ep-selectors.ts 注记）：任意前缀的 EP 弹层均命中
  // <en/> Namespace-agnostic substring matching (see the ep-selectors.ts note): EP popups of any prefix hit
  const EDITOR_POPUP_SELECTORS = [EP_ANY_POPPER_SELECTOR]

  /**
   * <zh/> 判断点击目标是否位于编辑器弹出层内部
   * <en/> Determine whether the click target is inside the editor popup layer
   */
  function isEditorPopup(target: EventTarget | null): boolean {
    if (!target || !(target instanceof Element))
      return false
    return EDITOR_POPUP_SELECTORS.some(sel => target.closest(sel))
  }

  /** 编辑状态 computed：仅当存在活跃编辑时为 true */
  const isEditingActive = computed(() =>
    !!options.editingCell.value || options.editingRowIndex.value !== null,
  )

  /**
   * <zh/> 条件注册 onClickOutside：编辑开始时注册，编辑结束后解绑。
   * <zh/> 监听源同时包含容器引用——编辑开始时容器可能尚未注入（null），
   * <zh/> 若只监听编辑态，本次注册空转返回后，容器延迟注入不会重新触发，失焦提交永久失效。
   * <en/> Conditionally registers onClickOutside: on edit start, off on edit end.
   * <en/> The container ref is part of the watch source — it may still be null when editing
   * <en/> starts; watching only the editing flag would miss the late container injection
   * <en/> and break blur-commit forever.
   */
  watch([isEditingActive, () => options.containerRef.value], ([active, container], _prev, onCleanup) => {
    if (!active)
      return
    if (!container)
      return
    const stop = onClickOutside(
      options.containerRef,
      (event) => {
        if (isEditorPopup(event.target))
          return
        const isFullRow = options.editConfig()?.editType === 'fullRow'
        if (isFullRow || options.editConfig()?.stopEditingWhenCellsLoseFocus) {
          options.stopEditing('blur', true)
        }
      },
    )
    onCleanup(stop)
  }, { immediate: true })

  return isEditingActive
}
