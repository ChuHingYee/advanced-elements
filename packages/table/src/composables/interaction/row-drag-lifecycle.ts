import type { MaybeRefOrGetter } from 'vue'
import type { IRendererDomAdapter } from '../../components/renderer-core/dom-adapter'
import { nextTick, toValue } from 'vue'
import { resolveDragContainer } from '../../utils/drag-container-resolver'
import { isDev } from '../../utils/env'

/**
 * Drag container lifecycle, pure code motion from use-row-drag.ts initRowDrag with
 * zero behavior change. 拖拽容器生命周期,纯搬移,零行为变更.
 *
 * Owns the init token, the unmount guard and the resolver observer teardown. A pure
 * factory (no lifecycle hooks inside): the owner wires init/destroy into its own
 * setup-time flow, so dynamic creation without a component instance keeps working.
 * 仅拥有 token/卸载守卫/observer 清理,不注册生命周期钩子,调用方在 setup 期接线.
 */
export interface DragContainerLifecycleDeps {
  enabled: MaybeRefOrGetter<boolean>
  tableId?: string
  getContainer: () => HTMLElement | null
  onContainerReady: (container: HTMLElement) => void
  beforeInit?: () => void
  /**
   * <zh/> 当前模式 DOM 适配器——行拖拽容器观察目标经其 `getBodySelector` 解析（命名空间化）。
   * <zh/> 缺省时回退到表格根元素（`resolveDragContainer` 内置回退）。
   * <en/> Current-mode DOM adapter — resolves the row-drag container observe target via
   * <en/> `getBodySelector` (namespace-aware). Falls back to the table root element without it.
   */
  dom?: MaybeRefOrGetter<IRendererDomAdapter | null | undefined>
}

export interface DragContainerLifecycleReturn {
  /** Resolve the container (async) and hand it to onContainerReady. 解析容器并交付. */
  init: () => void
  destroy: () => void
  /** Permanent teardown for unmount, voids every future init. 卸载期永久销毁,后续 init 不再生效. */
  dispose: () => void
}

/**
 * <zh/> 拖拽容器生命周期工厂——管理容器异步解析、init 版本号失效保护与 observer 清理；纯工厂，接线由调用方在 setup 期完成。
 * <en/> Drag container lifecycle factory — owns async container resolution, init-token invalidation and
 * <en/> observer teardown; a pure factory wired by the owner during setup.
 *
 * @param deps - <zh/> 生命周期依赖（开关、容器读取器、就绪回调与 DOM 适配器） | <en/> Lifecycle deps (enabled switch, container getter, ready callback and DOM adapter)
 * @returns <zh/> init / destroy / dispose 三个生命周期控制方法 | <en/> The init / destroy / dispose lifecycle controls
 */
export function createDragContainerLifecycle(deps: DragContainerLifecycleDeps): DragContainerLifecycleReturn {
  let observerCleanup: (() => void) | null = null
  /**
   * initRowDrag call version, incremented on each call; the nextTick callback verifies
   * it still holds the latest version. Prevents stale pending callbacks from overwriting
   * observerCleanup during rapid consecutive inits, which would permanently leak the
   * previous MutationObserver and its backoff setTimeout.
   * init 调用版本号,防旧 nextTick 回调覆盖 observerCleanup 致泄漏.
   */
  let initToken = 0
  let isUnmounted = false

  function init(): void {
    if (!toValue(deps.enabled))
      return
    deps.beforeInit?.()
    if (observerCleanup) {
      observerCleanup()
    }

    // Increment token to invalidate pending old nextTick callbacks.
    // 递增 token,使正在等待的旧 nextTick 回调失效.
    const currentToken = ++initToken

    nextTick(() => {
      // <zh/> 仅 dispose 取消已排队的 init；destroy 只拆现有资源，排队中的 init 仍须完成
      // <zh/> ——否则 destroy→init 的 KeepAlive 重建序列会丢掉重建意图。
      // <en/> Only dispose cancels a queued init; destroy tears down existing resources only and
      // <en/> a queued init must still run — otherwise the destroy→init rebuild sequence (KeepAlive)
      // <en/> loses the rebuild intent.
      if (isUnmounted || currentToken !== initToken)
        return
      observerCleanup = resolveDragContainer({
        getContainer: deps.getContainer,
        tableId: deps.tableId,
        // <zh/> 观察目标经 DOM 适配器命名空间化解析；缺省回退表格根元素
        // <en/> Observe target resolved namespace-aware via the DOM adapter; falls back to the table root
        observeTargetSelector: toValue(deps.dom)?.getBodySelector(),
        isDev,
        devWarnPrefix: 'useRowDrag',
        onReady: (container) => {
          observerCleanup = null
          deps.onContainerReady(container)
        },
      })
    })
  }

  function destroy(): void {
    // <zh/> 只拆已建立的 observer/timer，不递增 initToken——排队中的 nextTick init 仍会执行。
    // <zh/> 递增 token 会令 destroy 之后（同 tick 内）的 init 重建意图失效：KeepAlive 的
    // <zh/> deactivated→destroy、activated→init 序列下，容器就绪回调将永不触发。
    // <en/> Tears down the established observer/timer only; does NOT bump initToken — a queued
    // <en/> nextTick init still runs. Bumping the token would void the rebuild intent of an init
    // <en/> issued after destroy in the same tick: under KeepAlive's deactivated→destroy /
    // <en/> activated→init sequence the container-ready callback would never fire.
    observerCleanup?.()
    observerCleanup = null
  }

  function dispose(): void {
    // <zh/> 卸载期永久终止：既拆现有资源，也使已排队 + 后续所有 init 失效。
    // <en/> Permanent teardown for unmount: tears down existing resources AND voids both queued
    // <en/> and all future inits.
    isUnmounted = true
    initToken++
    destroy()
  }

  return { init, destroy, dispose }
}
