/**
 * @file debounce.ts
 * @description
 * <zh/> 尾随防抖唯一出口（收敛）——手写 `setTimeout` 三件套（列状态落盘、远程 refetch 触发器）的收敛点。
 * <zh/> 语义：尾随触发 + cancel + flush（KeepAlive 停用前落盘用），卸载时调用方负责 cancel/dispose。
 * <zh/> 与 `useDebounceFn`（无 flush/cancel，不适用）`refDebounced`（值防抖）`rafThrottle`（帧节流）分工不同，
 * <zh/> 详见 `docs/ownership-matrix.md`。
 * <en/> Trailing-debounce single outlet (convergence) — converges the hand-rolled `setTimeout`
 * <en/> triplets (column-state persist, remote-refetch trigger).
 * <en/> Semantics: trailing fire + cancel + flush (flush-before-deactivate); callers cancel/dispose on unmount.
 * <en/> Distinct from `useDebounceFn` (no flush/cancel), `refDebounced` (value debounce) and
 * <en/> `rafThrottle` (frame throttle); see `docs/ownership-matrix.md`.
 */

export interface TrailingDebounce {
  /** <zh/> 调度一次尾随执行（重复调用重置计时） | <en/> Schedule one trailing run (repeat calls reset the timer) */
  call: () => void
  /** <zh/> 取消待执行任务 | <en/> Cancel the pending run */
  cancel: () => void
  /** <zh/> 有待执行任务时立即执行并清空计时 | <en/> Run immediately when pending and clear the timer */
  flush: () => void
}

/**
 * <zh/> 创建尾随防抖——每次 call 重置计时，仅最后一次生效；cancel 丢弃，flush 立即执行。
 * <zh/> ms 支持 getter（运行时调整防抖即时生效）。
 * <en/> Create a trailing debounce — each call resets the timer, only the last one fires; cancel drops it, flush runs it now.
 * <en/> ms accepts a getter (runtime debounce tweaks take effect immediately).
 */
export function createTrailingDebounce(fn: () => void, ms: number | (() => number)): TrailingDebounce {
  const resolveMs = (): number => (typeof ms === 'function' ? ms() : ms)
  let timer: ReturnType<typeof setTimeout> | null = null
  function clear(): void {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
  }
  return {
    call: () => {
      clear()
      timer = setTimeout(() => {
        timer = null
        fn()
      }, resolveMs())
    },
    cancel: () => clear(),
    flush: () => {
      if (timer != null) {
        clear()
        fn()
      }
    },
  }
}
