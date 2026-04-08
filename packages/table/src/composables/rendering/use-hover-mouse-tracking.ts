/**
 * <zh/> Hover 鼠标追踪器 — 检测鼠标进出容器，记录视口坐标供滚动后重新发现 hover 行
 *
 * <en/> Hover mouse tracker — detects mouse enter/leave of the container,
 * <en/> records viewport coords for rediscovering the hover row after scroll.
 *
 * @remarks
 * <zh/> 从 use-hover-layer.ts 拆分，收敛 useMouseInElement / window mousemove 监听的生命周期管理。
 * <zh/> 仅在有 hover 操作列时启用，通过 shouldTrack 计算属性控制启停。
 * <zh/> KeepAlive deactivated 时停止监听，onActivated 时恢复。
 *
 * <en/> Extracted from use-hover-layer.ts, consolidating lifecycle management of
 * <en/> useMouseInElement / window mousemove listeners. Enabled only when hover option columns exist,
 * <en/> controlled by the shouldTrack computed. Stops on KeepAlive deactivated, resumes on onActivated.
 */
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { RafHandle } from '../../utils/raf'
import { useEventListener, useMouseInElement } from '@vueuse/core'
import { computed, ref, toValue, watch } from 'vue'
import { rafSchedule } from '../../utils/raf'

export interface UseHoverMouseTrackingOptions {
  /** <zh/> 表格容器元素 ref | <en/> Table container element ref */
  containerRef?: MaybeRefOrGetter<HTMLElement | null | undefined>
  /** <zh/> 是否需要追踪鼠标（有 hover 操作列时为 true） | <en/> Whether to track mouse (true when hover option columns exist) */
  shouldTrack: ComputedRef<boolean>
  /** <zh/> 鼠标离开容器时的回调 | <en/> Callback when mouse leaves the container */
  onContainerLeave: () => void
}

export interface UseHoverMouseTrackingReturn {
  /** <zh/> 最近一次鼠标视口 X 坐标，-1 表示尚未收到 mousemove | <en/> Last mouse viewport X coord, -1 when no mousemove yet */
  lastMouseClientX: Ref<number>
  /** <zh/> 最近一次鼠标视口 Y 坐标，-1 表示尚未收到 mousemove | <en/> Last mouse viewport Y coord, -1 when no mousemove yet */
  lastMouseClientY: Ref<number>
  /** <zh/> 启动鼠标追踪 | <en/> Start mouse tracking */
  startMouseTracking: () => void
  /** <zh/> 停止鼠标追踪 | <en/> Stop mouse tracking */
  stopMouseTracking: () => void
}

/**
 * <zh/> 创建 Hover 鼠标追踪器
 *
 * <en/> Create the hover mouse tracker.
 */
export function useHoverMouseTracking(options: UseHoverMouseTrackingOptions): UseHoverMouseTrackingReturn {
  const { containerRef, shouldTrack, onContainerLeave } = options

  const lastMouseClientX = ref(-1)
  const lastMouseClientY = ref(-1)

  /** useMouseInElement 的 watcher 需显式停止，否则组件卸载后仍监听 DOM 事件 */
  let mouseInElementStop: (() => void) | null = null
  /** isOutside watcher 需显式停止，配合 mouseInElement 动态启停 */
  let isOutsideWatcherStop: (() => void) | null = null
  /** mousemove 监听停止函数，用于追踪最近一次鼠标视口坐标（供滚动结束后重新发现 hover 行） */
  let mouseMoveStop: (() => void) | null = null
  /** <zh/> rAF 合并写入器（共享工具，可取消）——mousemove 每帧仅写一次 ref | <en/> Cancelable rAF coalescing writer (shared util) — refs written once per frame */
  let mouseWriteHandle: RafHandle | null = null
  /** 暂存的鼠标坐标，rAF 回调时写入 ref */
  let pendingMouseX = -1
  let pendingMouseY = -1

  function startMouseTracking() {
    if (mouseInElementStop || !containerRef)
      return
    const containerEl = computed(() => toValue(containerRef))
    const { isOutside, stop: stopMouseInElement } = useMouseInElement(containerEl)
    mouseInElementStop = stopMouseInElement
    /** 鼠标离开容器时隐藏 hover 层（两种模式共用） */
    const outsideStop = watch(isOutside, (outside) => {
      if (outside) {
        onContainerLeave()
      }
    })
    isOutsideWatcherStop = outsideStop
    // <zh/> rAF 合并写入器——每帧最多写一次 ref（共享工具，消除手写 rafId 管理）
    // <en/> rAF coalescing writer — refs written at most once per frame (shared util, no hand-rolled rafId)
    mouseWriteHandle = rafSchedule(() => {
      lastMouseClientX.value = pendingMouseX
      lastMouseClientY.value = pendingMouseY
    })
    /**
     * <zh/> 追踪最近一次鼠标视口坐标，供滚动停止后 rediscoverHoverAfterScroll 使用。
     * <zh/> 使用 rAF 合并：每帧仅写一次 ref，避免 60-120fps mousemove 触发冗余响应式更新。
     * <zh/> 中键自动滚动时鼠标可能移出容器边界，仅监听 container 的 mousemove 会导致
     * <zh/> lastMouseClientX/Y 停留在移出容器前的最后位置，elementFromPoint 使用过期坐标
     * <zh/> 定位到错误的行甚至容器外的元素，引发 hideHoverLayerImmediately 误隐藏。
     * <zh/> 改为监听 window 的 mousemove，确保鼠标移出容器后坐标仍持续更新。
     * <en/> Track the last mouse viewport coords for rediscoverHoverAfterScroll after scroll stops.
     * <en/> Uses rAF batching: writes refs only once per frame, avoiding redundant reactive updates from 60-120fps mousemove.
     * <en/> During middle-button auto-scroll the mouse may move outside the container; only listening
     * <en/> to container mousemove would leave lastMouseClientX/Y stale at the last in-container
     * <en/> position, causing elementFromPoint to use outdated coords and find the wrong row or an
     * <en/> element outside the container, triggering hideHoverLayerImmediately falsely.
     * <en/> Switch to window mousemove so coords keep updating even when the mouse leaves the container.
     */
    mouseMoveStop = useEventListener(window, 'mousemove', (e: MouseEvent) => {
      pendingMouseX = e.clientX
      pendingMouseY = e.clientY
      mouseWriteHandle?.schedule()
    })
  }

  function stopMouseTracking() {
    // <zh/> cancel（而非 schedule）——停止时丢弃待写入帧，避免停止后仍写 ref
    // <en/> cancel (not schedule) — drop the pending frame on stop, no writes after teardown
    mouseWriteHandle?.cancel()
    mouseWriteHandle = null
    isOutsideWatcherStop?.()
    isOutsideWatcherStop = null
    mouseInElementStop?.()
    mouseInElementStop = null
    mouseMoveStop?.()
    mouseMoveStop = null
  }

  watch(
    shouldTrack,
    (shouldTrack) => {
      if (shouldTrack) {
        startMouseTracking()
      }
      else {
        stopMouseTracking()
      }
    },
    { immediate: true },
  )

  return {
    lastMouseClientX,
    lastMouseClientY,
    startMouseTracking,
    stopMouseTracking,
  }
}
