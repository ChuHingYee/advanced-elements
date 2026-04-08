import type { WatchSource } from 'vue'
import { toValue, watch } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'

/**
 * <zh/> 状态清理回调签名 | <en/> State cleanup callback signature
 *
 * <zh/> 故意不耦合 table 专有类型（如 CellEditStopReason）——调用方在闭包中自行决定 reason。
 * <en/> Intentionally decoupled from table-specific types (e.g. CellEditStopReason) — caller decides reason in closure.
 */
export interface ModeSwitchCleanup {
  /** <zh/> 取消进行中的编辑（避免编辑中数据丢失） | <en/> Cancel in-flight editing (avoids losing edit data) */
  cancelEditing: () => void
  /** <zh/> 重置 shift-select 上下文（lastClickedKey 等） | <en/> Reset shift-select context (lastClickedKey, etc.) */
  resetShiftSelect: () => void
  /** <zh/> 关闭右键菜单（避免模式切换后菜单残留） | <en/> Close context menu (avoids menu lingering after mode switch) */
  closeContextMenu?: () => void
  /** <zh/> 重置范围选择状态（避免模式切换后范围选择残留） | <en/> Reset range selection state (avoids range selection lingering after mode switch) */
  resetRangeSelection?: () => void
  /** <zh/> 隐藏共享 tooltip（避免模式切换后 tooltip 残留在已卸载的渲染器上） | <en/> Hide shared tooltip (avoids tooltip lingering on unmounted renderer after mode switch) */
  hideSharedTooltip?: () => void
  /**
   * <zh/> 重置渲染错误边界：切换 mode 时只清 renderer error，不清空跨模式业务状态，
   * <zh/> 否则新 renderer 无法挂载、错误 UI 跨模式锁死。
   * <en/> Reset the render error boundary: switching mode only clears renderer errors without wiping cross-mode business state,
   * <en/> otherwise the new renderer cannot mount and the error UI locks across modes.
   */
  resetRendererError?: () => void
}

/**
 * <zh/> 判断是否允许运行时切换 mode 的纯函数预检——Vue 最佳实践：阻止优于事后抛错。
 * <en/> Pure pre-check for whether a runtime mode switch is allowed — Vue best practice: prevent rather than throw after the fact.
 *
 * <zh/> 唯一真正能阻止切换的位置是写入点（赋值前）；watcher 内抛错无法回退已经生效的 prop。
 * <en/> The only place that can truly prevent a switch is the write site (before assignment); throwing inside a watcher cannot revert an already-applied prop.
 */
export function canSwitchMode(
  behavior: 'warn' | 'error' | 'silent' | undefined,
): boolean {
  return behavior !== 'error'
}

/**
 * <zh/> mode 运行时切换通知派发签名 | <en/> Runtime mode-switch notice dispatch signature
 */
export interface ModeSwitchNotice {
  /** <zh/> 派发 info 级通知（不进入 error 事件流） | <en/> Dispatch info-level notice (NOT in error event stream) */
  notify: (cause: { from: string, to: string }) => void
  /**
   * <zh/> 派发 error 级通知（进入 error 事件流）——仅 `'error'` 策略下调用，替代 watcher 内同步抛错。
   * <zh/> 严格遵循 Vue 最佳实践：watch 回调内禁止 throw，错误通过结构化事件与 devWarn 可观测。
   * <en/> Dispatch an error-level notice (enters the error event stream) — invoked only under the
   * <en/> `'error'` strategy, replacing the synchronous throw inside the watcher.
   * <en/> Strict Vue best practice: never throw inside a watcher callback; observability is via structured events and devWarn.
   */
  notifyError?: (cause: { from: string, to: string }) => void
}

/**
 * <zh/> mode 运行时切换的 opt-out 行为策略。
 *
 * <zh/> 该 composable 从 useAdvTable 中抽离，便于单元测试与复用。
 * <zh/> 行为契约见 `AdvTableProps.modeSwitchBehavior`。
 * <zh/> 严格遵循 Vue 最佳实践：watch 回调内永不抛错，`flush: 'sync'` 仅用于保证状态原子性，
 * <zh/> 错误通过 `notifyError` 结构化事件与 `devWarn` 可观测，阻止请在写入点调用 {@link canSwitchMode} 预检。
 *
 * <en/> Runtime mode-switch opt-out behavior strategy.
 *
 * <en/> Extracted from useAdvTable for unit testing and reuse.
 * <en/> Behavior contract: see `AdvTableProps.modeSwitchBehavior`.
 * <en/> Strict Vue best practice: never throw inside a watcher; `flush:'sync'` is only for state atomicity,
 * <en/> errors are observable via `notifyError` and `devWarn`; to truly prevent a switch, pre-check with {@link canSwitchMode} at the write site.
 *
 * @remarks
 * <zh/> 三种策略共用同一段状态清理（{@link ModeSwitchCleanup}），`'error'` 也不例外——
 * <zh/> `mode` prop 在 watcher 触发前已经生效，抛错阻止不了切换；若因抛错跳过清理，最终状态
 * <zh/> 恰是该抛错声称要避免的"半迁移"（新 mode + 旧编辑/选择/菜单状态）。故 `'error'` 先收敛状态再报警，
 * <zh/> 且不抛错（遵循 Vue `watch` 回调不抛错、可观测错误走事件的约定）。
 * <zh/> - `'error'`：执行完整清理 → 派发 error 级通知（经 {@link ModeSwitchNotice.notifyError}）+ devWarn，不抛错
 * <zh/> - `'warn'`（默认）：执行清理 + 派发 info 级通知
 * <zh/> - `'silent'`：执行与 `'warn'` 完全一致的清理，不派发通知
 * <zh/> - `cancelEditing` 抛错时中止剩余清理（故障隔离），该情况下 `'warn'`/`'silent'` 仍派发一次 info 通知
 *
 * <en/> All three strategies share the same cleanup routine ({@link ModeSwitchCleanup}), including
 * <en/> `'error'` — the `mode` prop is already applied before the watcher fires, so throwing cannot
 * <en/> prevent the switch; skipping cleanup would leave exactly the "half-migrated" state the throw
 * <en/> claims to avoid (new mode + stale edit/selection/menu state). So `'error'` converges state first
 * <en/> and does NOT throw (Vue watcher best practice: observable errors go via events).
 * <en/> - `'error'`: full cleanup → error-level notice (via {@link ModeSwitchNotice.notifyError}) + devWarn, no throw
 * <en/> - `'warn'` (default): cleanup + info-level notice
 * <en/> - `'silent'`: identical cleanup to `'warn'`, no notice
 * <en/> - If `cancelEditing` throws, remaining cleanup is aborted (fault isolation) and an info notice
 * <en/>   is still dispatched for `'warn'`/`'silent'`
 */
export function useModeSwitchBehavior(options: {
  mode: WatchSource<string | undefined>
  behavior: WatchSource<'warn' | 'error' | 'silent' | undefined>
  cleanup: ModeSwitchCleanup
  notice: ModeSwitchNotice
}): { stop: () => void } {
  const { mode, behavior, cleanup, notice } = options

  /**
   * <zh/> 执行状态清理——三种策略共用（含 `'error'`），保证任何分支都不会留下半迁移状态。
   *
   * <zh/> 故障隔离：`cancelEditing` 抛错意味着编辑状态可能不一致，中止剩余清理避免在不一致状态下操作；
   * <zh/> 该情况下由调用方决定 `'warn'`/`'silent'` 是否补发 info 通知（默认补发）。
   *
   * <en/> Perform state cleanup — shared by all three strategies (including `'error'`) so no branch
   * <en/> can leave a half-migrated state.
   *
   * <en/> Fault isolation: a throwing `cancelEditing` means edit state may be inconsistent, so the
   * <en/> remaining cleanup is aborted; the caller then decides whether `'warn'`/`'silent'` still
   * <en/> dispatch the info notice (historical behavior: yes).
   *
   * @returns <zh/> 是否完整执行了全部清理 | <en/> whether the full cleanup ran to completion
   */
  function runCleanup(): boolean {
    try {
      cleanup.cancelEditing()
    }
    catch (error) {
      if (isDev)
        devWarn('[AdvTable] cancelEditing failed during mode switch, aborting remaining cleanup:', error)
      return false
    }
    cleanup.resetShiftSelect()
    cleanup.closeContextMenu?.()
    cleanup.resetRangeSelection?.()
    cleanup.hideSharedTooltip?.()
    // mode 切换只重置 renderer error（错误边界），业务状态跨模式保留
    cleanup.resetRendererError?.()
    return true
  }

  const stop = watch(
    mode,
    (newMode, oldMode) => {
      if (newMode === oldMode)
        return
      // modeSwitchBehavior: 'warn'（默认）| 'error' | 'silent'
      const next = toValue(behavior) ?? 'warn'
      const cause = { from: oldMode ?? '', to: newMode ?? '' }

      // 'warn' / 'silent' / 'error' 都必须执行状态清理——
      // mode prop 已生效，抛错阻止不了切换；跳过清理才会留下"新 mode + 旧状态"的半迁移
      // All three must clean up: the mode prop is already applied and throwing cannot prevent the
      // switch; skipping cleanup is what leaves the "new mode + stale state" half-migration
      const cleanupCompleted = runCleanup()

      if (next === 'error') {
        // 严格遵循 Vue 最佳实践：watch 回调内永不抛错。
        // Strict Vue best practice: never throw inside a watcher callback.
        // 可观测性由结构化 error 事件保证，dev 下额外 devWarn 便于本地排障。
        // Observability is via the structured error event; devWarn aids local debugging.
        notice.notifyError?.(cause)
        if (isDev) {
          devWarn(
            `[AdvTable] Runtime mode switch from "${oldMode}" to "${newMode}" is forbidden by modeSwitchBehavior='error'. `
            + 'Use v-if to recreate the component for a clean state transition. '
            + `Pre-check with canSwitchMode(behavior) at the write site to prevent this.`,
          )
        }
        return
      }

      // 'silent' 语义为完全不派发通知；清理中断（fail-open）时降级为 devWarn，
      // 不再把 silent 升级成 info 通知（旧行为违反 silent 契约）。
      // 'silent' means NO notice at all; a fault-isolated cleanup degrades to devWarn
      // instead of upgrading silent to an info notice (old behavior broke the contract).
      if (next === 'warn') {
        notice.notify(cause)
      }
      else if (!cleanupCompleted && isDev) {
        devWarn(
          `[AdvTable] mode switch cleanup from "${oldMode ?? ''}" to "${newMode ?? ''}" was interrupted (fail-open); `
          + 'the table may hold stale state for the previous mode.',
        )
      }
    },
    { flush: 'sync' },
  )

  return { stop }
}
