import type { MaybeRefOrGetter, Ref } from 'vue'
import { refDebounced } from '@vueuse/core'

/**
 * <zh/> 快速筛选文本防抖
 * <en/> Quick filter text debounce
 *
 * @remarks
 * <zh/> 外部 props.quickFilter 变更会延迟指定毫秒后才触发数据管线，避免每次按键触发热管线重算。
 * 基于 VueUse 的 refDebounced 实现：内部 watch 在组件卸载时自动停止，无需手动清理定时器。
 * <en/> External props.quickFilter changes are delayed by the specified milliseconds before triggering the data pipeline, avoiding hot pipeline recomputation on every keystroke.
 * Implemented via VueUse's refDebounced: its internal watch auto-stops on component unmount, removing the need for manual timer cleanup.
 *
 * @param model - <zh/> quickFilter 的 defineModel ref | <en/> quickFilter defineModel ref
 * @param delay - <zh/> 防抖延迟毫秒数（默认 300）——支持 ref/getter，运行时调整即时生效 | <en/> debounce delay in milliseconds (default 300) — accepts ref/getter so runtime changes take effect immediately
 * @returns <zh/> 防抖后的 quickFilterText ref | <en/> debounced quickFilterText ref
 */
export function useQuickFilterDebounce(
  model: Ref<string | undefined>,
  delay: MaybeRefOrGetter<number> = 300,
): Ref<string | undefined> {
  return refDebounced(model, delay)
}
