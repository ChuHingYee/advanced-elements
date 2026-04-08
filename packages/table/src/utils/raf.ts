/**
 * @file raf.ts
 * @description
 * <zh/> requestAnimationFrame 调度工具——收敛全库多处手写的 "rafId ??= requestAnimationFrame +
 * cancel" 同构模式，消除各处重复实现与 cancel 遗漏风险。
 *
 * <en/> requestAnimationFrame scheduling utilities — consolidates hand-rolled
 * "rafId ??= requestAnimationFrame + cancel" clones across the codebase into one implementation,
 * removing duplication and the risk of missed cancels.
 */

/**
 * <zh/> 可取消的 rAF 调度句柄 | <en/> Cancelable rAF scheduling handle
 */
export interface RafHandle {
  /**
   * <zh/> 调度到下一帧执行（去抖语义）：已有待执行任务时为空操作 | <en/> Schedule onto the next frame (debounce semantics): no-op when a task is already pending
   */
  schedule: () => void
  /**
   * <zh/> 取消待执行任务；无待执行任务时为空操作，可安全重复调用 | <en/> Cancel the pending task; safe no-op when nothing is pending
   */
  cancel: () => void
}

/**
 * <zh/> 是否存在原生 rAF——SSR / JSDOM / mini 环境可能缺失，需回退 setTimeout
 * <en/> Whether native rAF exists — SSR / JSDOM / mini runtimes may lack it, fall back to setTimeout
 */
function hasNativeRaf(): boolean {
  return typeof requestAnimationFrame === 'function' && typeof cancelAnimationFrame === 'function'
}

/**
 * <zh/> 创建下一帧合并执行器：重复 schedule 仅保留最后一次，flush 于下一帧运行。
 * <zh/> 组件卸载/停止时调用 cancel 即可避免卸载后写 DOM/响应式状态。
 * <zh/> 无 rAF 环境（SSR）时回退 setTimeout(16ms)，cancel 对称清理。
 * <en/> Creates a next-frame coalescing runner: repeated schedules keep only the last one,
 * <en/> flushed on the next frame. Call cancel on unmount/stop to avoid post-unmount DOM/reactive writes.
 * <en/> Falls back to setTimeout(16ms) without rAF (SSR), with symmetric cancel.
 */
export function rafSchedule(fn: () => void): RafHandle {
  let rafId: number | ReturnType<typeof setTimeout> | null = null

  const flush = () => {
    rafId = null
    fn()
  }

  return {
    schedule: () => {
      if (rafId != null)
        return
      if (hasNativeRaf())
        rafId = requestAnimationFrame(flush)
      else
        rafId = setTimeout(flush, 16)
    },
    cancel: () => {
      if (rafId != null) {
        if (hasNativeRaf())
          cancelAnimationFrame(rafId as number)
        else
          clearTimeout(rafId as ReturnType<typeof setTimeout>)
        rafId = null
      }
    },
  }
}

/**
 * <zh/> 可取消的空闲调度取消函数 | <en/> Cancelable idle-schedule cancel function
 */
export type IdleCancel = () => void

/**
 * <zh/> 空闲调度（收敛）：requestIdleCallback 优先（SSR/无实现时回退 setTimeout 0），返回对称 cancel。
 * <zh/> 收敛 `use-cell-span` 与 `use-async-summary` 两套同构实现；代际守卫仍由调用方持有。
 * <en/> Idle scheduling (convergence): prefers requestIdleCallback (falls back to setTimeout 0 without it),
 * <en/> returns a symmetric cancel. Converges the two clones in `use-cell-span` and `use-async-summary`;
 * <en/> generation guards stay with the callers.
 */
export function idleSchedule(fn: () => void, timeout = 100): IdleCancel {
  const g = globalThis as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
    cancelIdleCallback?: (id: number) => void
  }
  if (typeof g.requestIdleCallback === 'function') {
    const handle = g.requestIdleCallback(fn, { timeout })
    return () => {
      try {
        g.cancelIdleCallback?.(handle)
      }
      catch {
        // <zh/> 取消失败不影响调用方 | <en/> Cancel failures must not affect callers
      }
    }
  }
  const handle = setTimeout(fn, 0)
  return () => clearTimeout(handle)
}

/**
 * <zh/> 帧节流：高频事件（scroll/mousemove）中每帧最多执行一次，参数取最后一次调用值。
 * <zh/> 返回 [节流后的函数, 取消函数] 元组。
 * <en/> Frame throttle: at most once per frame under high-frequency events (scroll/mousemove),
 * <en/> using the latest call's arguments. Returns [throttledFn, cancelFn] tuple.
 */
export function rafThrottle<A extends unknown[]>(fn: (...args: A) => void): [(...args: A) => void, () => void] {
  let rafId: number | ReturnType<typeof setTimeout> | null = null
  let latestArgs: A

  const flush = () => {
    rafId = null
    fn(...latestArgs)
  }

  const throttled = (...args: A) => {
    latestArgs = args
    if (rafId != null)
      return
    if (hasNativeRaf())
      rafId = requestAnimationFrame(flush)
    else
      rafId = setTimeout(flush, 16)
  }

  const cancel = () => {
    if (rafId != null) {
      if (hasNativeRaf())
        cancelAnimationFrame(rafId as number)
      else
        clearTimeout(rafId as ReturnType<typeof setTimeout>)
      rafId = null
    }
  }

  return [throttled, cancel]
}
