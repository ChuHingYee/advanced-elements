import type { MaybeRefOrGetter } from 'vue'
import { onScopeDispose, toValue, watch } from 'vue'
import { devWarn } from './dev-warn'
import { isBrowser } from './env'

/**
 * <zh/> 存活表格实例 ID 注册表——检测同页重复 tableId。
 * <zh/> 重复 ID 会导致列持久化互踩（storageKey 相同）与拖拽容器定位错误（getElementById 取首个）。
 * <en/> Live table-instance ID registry — detects duplicate tableIds on the same page.
 * <en/> Duplicate IDs corrupt column-state persistence (same storageKey) and drag-container
 * <en/> lookup (getElementById returns the first match).
 *
 * @remarks
 * <zh/> 进程级 **Map<string, 引用计数>**，浏览器环境恒启用（含生产）：单 watch + Map
 * <zh/> 操作，开销可忽略；SSR 跳过，避免跨请求误报。dev 经 devWarn 输出，生产经 onDuplicate
 * <zh/> 回调进入表格 error 事件流（warn 级），裸 console 仍被禁止。
 * <zh/> **为何是计数而非 Set**：注册失败的实例（重复 ID）若在销毁时按 Set 语义删除，
 * <zh/> 会把仍存活实例占用的 ID 一并释放，使后续实例不再告警——真实冲突被掩盖。
 * <zh/> 计数只在**成功取得占用**时递增，释放方必须是自己取得过占用的那一实例
 * <zh/> （`useTableIdGuard` 持有 acquired 标志），失败方永不参与增减。
 * <en/> Process-level **Map<string, refcount>**, always on in browsers (including
 * <en/> production): one watch plus Map ops, negligible cost; skipped under SSR to avoid
 * <en/> cross-request false positives. Dev reports via devWarn, production via the onDuplicate
 * <en/> callback into the table error-event stream (warn level); bare console stays forbidden.
 * <en/> **Why a refcount, not a Set**: an instance whose registration failed (duplicate id) would,
 * <en/> under Set semantics, delete the id still held by the live instance on dispose — masking the
 * <en/> real conflict. The count only increments on a **successful** claim, and only an instance that
 * <en/> acquired a claim may release it (`useTableIdGuard` tracks that flag).
 */
const liveTableIds = new Map<string, number>()

/**
 * <zh/> 注册表格 ID，已存在返回 false（失败时不改变计数——占用仍属首个成功注册的实例）
 * <en/> Register a table ID, false when already taken (a failed claim never changes the count)
 */
export function registerTableId(id: string): boolean {
  if (liveTableIds.has(id))
    return false
  liveTableIds.set(id, 1)
  return true
}

/**
 * <zh/> 注销表格 ID（释放本实例持有的那一份占用；计数归零才移除）
 * <en/> Unregister a table ID (releases this instance's claim; removed only at zero)
 */
export function unregisterTableId(id: string): void {
  const count = liveTableIds.get(id)
  if (count === undefined)
    return
  if (count <= 1)
    liveTableIds.delete(id)
  else
    liveTableIds.set(id, count - 1)
}

/** <zh/> 测试辅助——清空注册表 | <en/> Test helper — clear the registry */
export function resetTableIdRegistryForTests(): void {
  liveTableIds.clear()
}

/**
 * <zh/> 表格 ID 守卫——在组件作用域内跟踪 ID 并检测重复。
 * <zh/> ID 变更时先注销旧值；作用域停止时自动注销；重复 ID 触发一次性 dev 告警，
 * <zh/> 并经 onDuplicate 回调上报（生产调用方由此进入 error 事件流）。
 * <en/> Table ID guard — tracks the ID within the component scope and detects duplicates.
 * <en/> Unregisters the old value on change and auto-unregisters on scope dispose;
 * <en/> duplicate IDs emit a one-time dev warning and report via the onDuplicate callback
 * <en/> (production callers route it into the error-event stream).
 */
export function useTableIdGuard(idSource: MaybeRefOrGetter<string>, onDuplicate?: (id: string) => void): void {
  // <zh/> 非浏览器环境（SSR）跳过——进程级 Map 会跨请求误报
  // <en/> Skip off-browser (SSR) — a process-level Map would false-positive across requests
  if (!isBrowser)
    return
  let current: string | null = null
  /** <zh/> 本实例是否**成功取得**了 current 的占用——只有 true 时才由本实例释放 | <en/> Whether this instance successfully claimed `current` — only then may it release it */
  let acquired = false
  const sync = () => {
    const id = toValue(idSource)
    if (id === current)
      return
    if (current !== null && acquired)
      unregisterTableId(current)
    current = id
    acquired = registerTableId(id)
    if (!acquired) {
      devWarn(
        `[AdvTable] Duplicate tableId "${id}" detected. Tables on the same page must use distinct `
        + 'ui-config.tableId values, otherwise column-state persistence collides and drag containers '
        + 'may resolve to the wrong table. If sharing one tableId is intentional, isolate persistence '
        + 'explicitly via column-state storageKey.',
      )
      onDuplicate?.(id)
    }
  }
  watch(() => toValue(idSource), sync, { immediate: true })
  onScopeDispose(() => {
    // 注册失败（重复 ID）的实例不得释放他人仍持有的占用
    if (current !== null && acquired)
      unregisterTableId(current)
    current = null
    acquired = false
  })
}
