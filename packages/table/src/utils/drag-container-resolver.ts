/**
 * <zh/> 拖拽容器解析器 — 等待并定位拖拽目标容器
 *
 * <en/> Drag container resolver — waits for and locates the drag target container.
 *
 * @remarks
 * <zh/> 行拖拽（use-row-drag）与列拖拽（use-column-drag）共享相同的容器解析逻辑：
 * <zh/>   1. 立即尝试获取容器
 * <zh/>   2. 若未就绪，通过 tableId 定位表格元素，用 MutationObserver 监听子树变化
 * <zh/>   3. 观察到容器出现时立即回调 onReady
 * <zh/>   4. 超时后线性退避重试（3s × 次数），达到上限后放弃
 *
 * <zh/> 抽取为公共工具消除两处重复实现（各 ~75 行），并使重试计数作用域更精确（每次 init 独立）。
 *
 * <en/> Row drag (use-row-drag) and column drag (use-column-drag) share the same container-resolution logic:
 * <en/>   1. Try to get the container immediately
 * <en/>   2. If not ready, locate the table element by tableId and observe subtree mutations via MutationObserver
 * <en/>   3. Call onReady as soon as the container appears
 * <en/>   4. Retry with linear backoff (3s × count) on timeout, up to maxRetries
 *
 * <en/> Extracted as a shared utility to eliminate ~75 lines of duplication in each caller,
 * <en/> with more precise retry-count scoping (fresh budget per init).
 */
import { devWarn } from './dev-warn'

export interface ResolveDragContainerOptions {
  /** <zh/> 尝试获取拖拽容器 | <en/> Attempt to get the drag container */
  getContainer: () => HTMLElement | null
  /** <zh/> 表格元素 ID（用于 fallback 定位） | <en/> Table element ID (for fallback lookup) */
  tableId?: string
  /**
   * <zh/> 容器祖先选择器（如 '.el-table__body-wrapper, .el-table-v2__body'）
   * <zh/> 命中时仅观察该元素的直接子节点（subtree=false）；未命中时回退到 tableEl 并观察整棵子树
   *
   * <en/> Ancestor selector (e.g. '.el-table__body-wrapper, .el-table-v2__body').
   * <en/> When matched, observes only its direct children (subtree=false); falls back to tableEl with full subtree otherwise.
   */
  observeTargetSelector?: string
  /** <zh/> 容器就绪回调 | <en/> Container-ready callback */
  onReady: (container: HTMLElement) => void
  /** <zh/> 最大重试次数，默认 2 | <en/> Max retry count, default 2 */
  maxRetries?: number
  /** <zh/> 是否开发环境（控制警告输出） | <en/> Whether in dev mode (controls warning output) */
  isDev?: boolean
  /** <zh/> 警告前缀 | <en/> Warning prefix */
  devWarnPrefix?: string
}

/**
 * <zh/> 解析拖拽容器——立即尝试，未就绪时用 MutationObserver + 线性退避重试
 *
 * <en/> Resolve the drag container — tries immediately, retries with MutationObserver + linear backoff when not ready.
 *
 * @returns <zh/> 清理函数（断开 observer、清除 timeout） | <en/> Cleanup function (disconnects observer, clears timeout)
 */
export function resolveDragContainer(options: ResolveDragContainerOptions): () => void {
  const { getContainer, tableId, observeTargetSelector, onReady, isDev, devWarnPrefix = 'useDrag' } = options
  const maxRetries = options.maxRetries ?? 2

  let retryCount = 0
  let observer: MutationObserver | null = null
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let cleaned = false

  function cleanup() {
    if (cleaned)
      return
    cleaned = true
    observer?.disconnect()
    observer = null
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  function attempt() {
    if (cleaned)
      return

    const container = getContainer()
    if (container) {
      cleanup()
      onReady(container)
      return
    }

    const tableEl = tableId ? document.getElementById(tableId) : null
    if (!tableEl) {
      // <zh/> 经 devWarn 收敛（去重+统一前缀）；tableId 缺失多因容器尚未挂载，重试而非报错
      // <en/> Converged via devWarn (dedup + unified prefix); a missing tableId usually means
      // <en/> the container is not mounted yet — retry instead of erroring
      if (isDev) {
        devWarn(`[${devWarnPrefix}] 表格容器未找到`, tableId)
      }
      return
    }

    observer = new MutationObserver(() => {
      if (cleaned)
        return
      const retryContainer = getContainer()
      if (retryContainer) {
        cleanup()
        onReady(retryContainer)
      }
    })

    const specificTarget = observeTargetSelector
      ? tableEl.querySelector(observeTargetSelector)
      : null
    const observeTarget = specificTarget ?? tableEl
    observer.observe(observeTarget, {
      childList: true,
      subtree: !specificTarget,
    })

    // 重试退避延迟：3s 基数 × (重试次数+1)，线性退避避免频繁重试
    // Retry backoff delay: 3s base × (retry count+1), linear backoff to avoid frequent retries
    const delay = 3000 * (retryCount + 1)
    timeoutId = setTimeout(() => {
      if (cleaned)
        return
      cleanup()
      if (retryCount < maxRetries) {
        retryCount++
        attempt()
      }
      else {
        retryCount = 0
        if (isDev) {
          devWarn(`[${devWarnPrefix}] 拖拽容器初始化失败，已达最大重试次数`)
        }
      }
    }, delay)
  }

  attempt()

  return cleanup
}
