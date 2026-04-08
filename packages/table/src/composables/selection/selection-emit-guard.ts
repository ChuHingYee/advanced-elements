import type { SelectionChangeMeta } from './selection-types'

/**
 * <zh/> selectionChange 去重守卫——纯工厂，按键集指纹抑制"键集未变"的重复派发
 * <en/> selectionChange dedupe guard — a pure factory suppressing repeat dispatches whose key set did not change
 *
 * @remarks
 * <zh/> 与 `selection-mutation-guard` 正交：本模块管 selectionChange 派发去重，后者管变更期重入抑制（深度计数）。
 * <zh/> 正确性：`selectionChange` 表达"选中集合变化"，键集不变即无变化（如对已选中行再次 `toggleRowSelection(row, true)`），
 * <zh/> 库内 `initSelectionByKeys` 已采用同语义在键集未变时 return（见 `selection-batch`），本守卫是把该语义收敛到唯一派发点；
 * <zh/> 剪除路径（rowMap 变化丢键）键集必然变化，不受影响。作用域仅限 `selectionChange`：
 * <zh/> `select` / `rowSelected` / `selectAll` 属用户意图事件，无条件派发以保留交互信号。
 * <zh/> 不存在"键同而行对象已换"的合法派发路径：受控回显走 `initSelectionByKeys`（键未变不派发），
 * <zh/> `rowMap` 变化补发仅在确有键移除时触发。纯工厂，无响应式状态、无生命周期。
 * <en/> Orthogonal to `selection-mutation-guard`: this module dedupes selectionChange dispatches,
 * <en/> the latter suppresses in-mutation re-entry (depth count). Correctness: `selectionChange` means
 * <en/> "the selection set changed" — an unchanged key set means nothing changed (e.g. re-selecting an
 * <en/> already-selected row); `initSelectionByKeys` already returns early on unchanged keys (see
 * <en/> `selection-batch`), so this guard converges that semantic onto the single dispatch point. The prune
 * <en/> path (rowMap-change key loss) always changes the key set and is unaffected. Scope is `selectionChange`
 * <en/> only: `select` / `rowSelected` / `selectAll` are user-intent events that always fire. No legitimate
 * <en/> path dispatches with unchanged keys: controlled echo goes through `initSelectionByKeys` (no dispatch
 * <en/> when unchanged), and rowMap-change re-emit fires only when keys were actually removed. Pure factory.
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
