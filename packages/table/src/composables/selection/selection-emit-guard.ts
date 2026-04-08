import type { SelectionChangeMeta } from './selection-types'

/**
 * <zh/> selectionChange 去重守卫——纯工厂，按键集指纹抑制"键集未变"的重复派发。
 * <en/> selectionChange dedupe guard — a pure factory suppressing repeat dispatches whose key set
 * <en/> did not change, based on a key-set fingerprint.
 *
 * <zh/> 与 `selection-mutation-guard` 的分工：本模块管 **selectionChange 派发去重**，
 * <zh/> `selection-mutation-guard` 管**变更期重入抑制**（深度计数）。两者正交，不要混用。
 * <en/> Relation to `selection-mutation-guard`: this module handles **selectionChange dispatch
 * <en/> dedupe**; `selection-mutation-guard` handles **in-mutation re-entry suppression**.
 * <en/> They are orthogonal — do not mix them up.
 *
 * @remarks
 * <zh/> **为何正确**：`selectionChange` 表达"选中集合发生变化"，键集不变即无变化可言
 * <zh/> （例如对已选中行再次 `toggleRowSelection(row, true)`、或已全选时再次 `selectAll`）。
 * <zh/> 库内既有实现已采用同一语义——`initSelectionByKeys` 在键集未变时提前 return
 * <zh/> （见 `selection-batch`），故本守卫并非新增规则，而是把该语义收敛到唯一派发点。
 * <zh/> 剪除路径（rowMap 变化导致丢键）键集必然变化，不受影响。
 *
 * <zh/> **作用域仅限 `selectionChange`**：`select` / `rowSelected` / `selectAll` 属"用户意图"级事件
 * <zh/> （单行操作、全选动作），仍应无条件派发，避免丢失交互信号——故守卫只包住集合级事件。
 *
 * <zh/> **关于"键同而行对象已换"**：不存在合法路径以未变键集派发——受控回显走 `initSelectionByKeys`，
 * <zh/> 键未变时本就不派发；`rowMap` 变化时的补发也仅在确有键被移除时触发。
 * <zh/> 因此不会出现"消费方需要新行对象却收不到"的场景。
 *
 * <zh/> **分层**：本模块为纯工厂（无响应式状态、无生命周期），与同域其余纯工厂一致。
 *
 * <en/> **Why it is correct**: `selectionChange` means "the selection set changed"; an unchanged key set
 * <en/> means nothing changed (e.g. `toggleRowSelection(row, true)` on an already-selected row, or
 * <en/> `selectAll` when everything is already selected). The library already uses this semantic —
 * <en/> `initSelectionByKeys` returns early on an unchanged key set (see `selection-batch`) — so this
 * <en/> guard is not a new rule but a convergence of that semantic onto the single dispatch point.
 * <en/> The prune path (keys lost when rowMap changes) always changes the key set and is unaffected.
 *
 * <en/> **Scope is limited to `selectionChange`**: `select` / `rowSelected` / `selectAll` are "user
 * <en/> intent" events (single-row action, select-all action) and must still fire unconditionally so no
 * <en/> interaction signal is lost — hence only the set-level event is wrapped.
 *
 * <en/> **On "same keys, replaced row objects"**: no legitimate path dispatches with an unchanged key
 * <en/> set — controlled echo goes through `initSelectionByKeys`, which does not dispatch when keys are
 * <en/> unchanged, and the rowMap-change re-emit only fires when keys were actually removed. So there is
 * <en/> no case where a consumer needs the new row objects and receives nothing.
 *
 * <en/> **Layering**: a pure factory (no reactive state, no lifecycle), consistent with the other pure
 * <en/> factories in this domain.
 */

/** <zh/> 去重守卫依赖 | <en/> Dedupe guard deps */
export interface SelectionEmitGuardOptions<T> {
  /** <zh/> 读取当前选中键集 | <en/> read the current selected-key set */
  getKeys: () => Set<string>
  /** <zh/> 实际派发通道（已包装父级监听的吞错） | <en/> the actual dispatch channel (parent listeners already error-wrapped) */
  emit: (selection: T[], meta: SelectionChangeMeta) => void
}

/** <zh/> 去重守卫实例 | <en/> Dedupe guard instance */
export interface SelectionEmitGuard<T> {
  /**
   * <zh/> 派发 selectionChange——键集与上次已派发者相同时跳过 | <en/> Dispatch selectionChange — skipped when the key set matches the last dispatched one
   * @param selection - <zh/> 选中行快照 | <en/> selected-row snapshot
   * @param meta - <zh/> 选中元信息 | <en/> selection meta payload
   */
  notify: (selection: T[], meta: SelectionChangeMeta) => void
}

/** <zh/> 键集是否完全相同（大小 + 逐元素包含） | <en/> whether two key sets are identical (size + membership) */
function isSameKeySet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size)
    return false
  for (const key of a) {
    if (!b.has(key))
      return false
  }
  return true
}

/**
 * <zh/> 创建 selectionChange 去重守卫 | <en/> Create the selectionChange dedupe guard
 * @param options - <zh/> 守卫依赖 | <en/> guard deps
 * @returns <zh/> 守卫实例 | <en/> guard instance
 */
export function createSelectionEmitGuard<T>(options: SelectionEmitGuardOptions<T>): SelectionEmitGuard<T> {
  /**
   * <zh/> 上一次**已实际派发**的键集快照；仅在真正派发时更新
   * <en/> Key-set snapshot of the last **actually dispatched** change; updated only on real dispatch
   */
  let lastEmittedKeys: Set<string> | null = null

  return {
    notify(selection: T[], meta: SelectionChangeMeta): void {
      const keys = options.getKeys()
      if (lastEmittedKeys !== null && isSameKeySet(lastEmittedKeys, keys))
        return
      lastEmittedKeys = new Set(keys)
      options.emit(selection, meta)
    },
  }
}
