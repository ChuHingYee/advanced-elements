import type { Ref, ShallowRef } from 'vue'
import { onActivated, onDeactivated, onScopeDispose, onUnmounted, watch } from 'vue'

/**
 * <zh/> loading 桥接依赖 | <en/> Loading-bridge dependencies
 */
export interface UseRequestLoadingBridgeDeps {
  /** <zh/> useRequest 的加载状态 ref | <en/> loading ref from useRequest */
  localLoading: Ref<boolean>
  /** <zh/> update:loading 事件通道 | <en/> the update:loading emit channel */
  updateLoading: (loading: boolean) => void
  /** <zh/> deactivated 附加副作用（manual 请求失效） | <en/> extra side effect on deactivate (manual-request invalidation) */
  onDeactivate?: () => void
  /** <zh/> reactivated 附加副作用（KeepAlive URL 重同步；卸载后不调） | <en/> extra side effect on reactivate (KeepAlive URL resync; skipped once unmounted) */
  onReactivate?: () => void
  isUnmounted: ShallowRef<boolean>
}

/**
 * <zh/> loading 桥接——localLoading → emit('update:loading') 的 KeepAlive 兼容桥。
 *
 * <zh/> deactivated 停 watch 防后台请求完成扰动父级 loading；reactivated 重启并同步当前值；
 * <zh/> scope 停止与卸载时兜底回收。自 use-table-request.ts 原样迁出（COMPLEXITY-PLAN 战线三，
 * <zh/> 刀法 C），停靠/重激活的附加副作用经回调注入，桥体逐字未改。
 * <en/> Loading bridge — the KeepAlive-compatible localLoading → emit('update:loading') bridge.
 *
 * <en/> Watch stops on deactivate so background completions never toggle the parent loading; restarts
 * <en/> on reactivate with a sync of the current value; reclaimed on scope stop and unmount. Migrated
 * <en/> verbatim from use-table-request.ts (COMPLEXITY-PLAN battle line 3, knife C); deactivate/
 * <en/> reactivate extras are injected via callbacks, bridge bodies unchanged.
 */
export function useRequestLoadingBridge(deps: UseRequestLoadingBridgeDeps) {
  const { localLoading, updateLoading, onDeactivate, onReactivate, isUnmounted } = deps

  /**
   * <zh/> localLoading → emit('update:loading') 桥接 watch 的工厂函数。
   * <zh/> 抽取为独立函数消除 onActivated 中重复创建的样板代码。
   * <en/> Factory for the localLoading → emit('update:loading') bridge watch.
   * <zh/> Extracted to eliminate the boilerplate of re-creating it in onActivated.
   */
  function createLoadingWatch(): (() => void) | null {
    return watch(localLoading, (val) => {
      updateLoading(val)
    })
  }

  /**
   * <zh/> 当前活跃的 loading watch 停止函数——由 createLoadingWatch 返回。
   * <zh/> KeepAlive 兼容：deactivated 时停止 watch，避免后台请求完成触发父组件 loading 状态变更；
   * <zh/> reactivated 时重新启动 watch 并同步当前 loading 状态（避免漏 emit）。
   * <en/> Active loading watch stop function — returned by createLoadingWatch.
   * <en/> KeepAlive-compatible: stopped on deactivate to prevent background-request completions from
   * <en/> toggling the parent loading state; restarted on reactivate with a sync to avoid missed emits.
   */
  let stopLoadingWatch: (() => void) | null = createLoadingWatch()

  onDeactivated(() => {
    stopLoadingWatch?.()
    stopLoadingWatch = null
    // <zh/> manual 后台请求随停靠 abort 并推进序号——deactivated 期间完成的旧响应即 stale，
    // <zh/> 经 manualRequestSettled 丢弃，不再写数据（auto 路径已有 cancelRequest 对称处理）。
    // <en/> Abort manual in-flight requests on deactivate and bump the sequence — responses
    // <en/> completing while deactivated are stale via manualRequestSettled and dropped.
    onDeactivate?.()
  })

  onActivated(() => {
    // <zh/> KeepAlive 子组件**初始挂载**同样触发 onActivated——此时 setup 已建 watch1，
    // <zh/> 不先停旧句柄直接覆盖会让 watch1 泄漏（停靠期间 loading 变化仍外发）。
    // <en/> KeepAlive children fire onActivated on INITIAL mount too — the setup already built a
    // <en/> watch; overwriting its handle without stopping it leaks that watch (parked loading
    // <en/> flips keep emitting).
    stopLoadingWatch?.()
    /** <zh/> 重新启动 watch 并同步当前 loading 状态，确保父组件收到最新的 loading 值 | <en/> Restart watch and sync current loading state */
    stopLoadingWatch = createLoadingWatch()
    updateLoading(localLoading.value)

    // <zh/> KeepAlive 重新激活时重读 URL 状态，确保路由前进/后退后分页参数同步。
    // <zh/> 注意走 resync（带副作用扇出）而非静默写入——此时表格已挂过数据，
    // <zh/> 静默改页码会使页码与服务端数据脱节（页变了但未重取）。
    // <en/> Re-read URL state on KeepAlive reactivation, ensuring pagination params sync after route
    // <en/> forward/back. Uses resync (with effect fan-out) instead of silent writes — the table has
    // <en/> already loaded data, and silently changing the page would desync it from server data.
    if (!isUnmounted.value) {
      onReactivate?.()
    }
  })

  /**
   * <zh/> 统一生命周期清理——用 onScopeDispose 兜底，确保 scope 停止时 watch 被回收。
   * <en/> Unified lifecycle cleanup — onScopeDispose as a safety net, ensuring the watch is reclaimed when the scope stops.
   */
  onScopeDispose(() => {
    stopLoadingWatch?.()
    stopLoadingWatch = null
  })

  onUnmounted(() => {
    stopLoadingWatch?.()
    stopLoadingWatch = null
  })
}
