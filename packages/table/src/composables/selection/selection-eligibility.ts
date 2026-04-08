import type { MaybeRefOrGetter } from 'vue'
import type { TreeApi } from '../../types/config'
import { toValue } from 'vue'
import { filterUnselectableKeys as filterUnselectableKeysUtil } from '../../utils/selection-serialization'

/**
 * <zh/> 选择资格域——「哪些行允许被选中」的判定，与树形级联开关
 * <en/> Selection-eligibility domain — decides which rows may be selected, plus the tree-cascade switch
 *
 * @remarks
 * <zh/> 纯工厂而非 composable：本域不持有任何响应式状态，也不注册 watcher/生命周期，
 * <zh/> 只读 `toValue` 取值后判定。按 Vue 最佳实践，无响应式需求的组合不应加 `use*` 前缀。
 * <en/> A pure factory rather than a composable: this domain owns no reactive state and registers
 * <en/> no watchers or lifecycle hooks — it only reads values via `toValue` and decides. Per Vue
 * <en/> best practice, a composition without reactive needs should not carry the `use*` prefix.
 */
export interface SelectionEligibilityDeps<T = any> {
  /** <zh/> 行键函数 | <en/> row key function */
  rowKey: MaybeRefOrGetter<(row: T) => string>
  /** <zh/> 全量数据（未注入 keyToIndexMap 时回退 findIndex） | <en/> full data (fallback for findIndex when keyToIndexMap is absent) */
  allData: MaybeRefOrGetter<T[]>
  /** <zh/> 行映射 | <en/> row map */
  rowMap: MaybeRefOrGetter<Map<string, T>>
  /** <zh/> 可选中谓词 | <en/> selectable predicate */
  selectableFn?: MaybeRefOrGetter<((row: T, index: number) => boolean) | undefined>
  /** <zh/> key→索引映射（O(1) 查找） | <en/> key→index map (O(1) lookup) */
  keyToIndexMap?: MaybeRefOrGetter<Map<string, number>>
  /** <zh/> 树形 API | <en/> tree API */
  treeApi?: MaybeRefOrGetter<TreeApi | undefined>
}

/** <zh/> 选择资格域返回 | <en/> Selection-eligibility return */
export interface SelectionEligibility<T = any> {
  /**
   * 检查行是否可选中——统一 selectableFn 检查逻辑。
   * Check if a row is selectable — unified selectableFn check.
   *
   * 索引查找优先使用外部注入的 keyToIndexMap（O(1)），未注入时回退到 findIndex（O(n)）。
   * Index lookup prefers the injected keyToIndexMap (O(1)), falling back to findIndex (O(n)).
   * @param row - <zh/> 待检查行 | <en/> row to check
   * @param key - <zh/> 行的唯一标识 | <en/> row's unique key
   * @param shouldSelect - <zh/> 是否意图选中 | <en/> whether the intent is to select
   * @param ignoreSelectable - <zh/> 是否跳过 selectable 检查（如 checkbox 点击） | <en/> whether to skip the selectable check (e.g. checkbox click)
   * @returns <zh/> true 表示行可选中或无需检查 | <en/> true when the row is selectable or needs no check
   */
  isRowSelectable: (row: T, key: string, shouldSelect: boolean, ignoreSelectable?: boolean) => boolean
  /**
   * 从 key 集合中过滤掉不可选行，返回仅包含可选行 key 的新 Set。
   * Filter out non-selectable keys — returns a new Set containing only selectable row keys.
   */
  filterUnselectableKeys: (keys: Set<string>) => Set<string>
  /** <zh/> 树形联动模式下父子节点选中状态是否需要级联 | <en/> whether selection cascades between parents and children in tree mode */
  isTreeCascadeEnabled: () => boolean
}

/**
 * <zh/> 创建选择资格域
 * <en/> Create the selection-eligibility domain
 */
export function createSelectionEligibility<T = any>(deps: SelectionEligibilityDeps<T>): SelectionEligibility<T> {
  const { rowKey, allData, rowMap, selectableFn, keyToIndexMap, treeApi } = deps

  function isRowSelectable(row: T, key: string, shouldSelect: boolean, ignoreSelectable?: boolean): boolean {
    if (!shouldSelect || ignoreSelectable)
      return true
    const selectablePredicate = toValue(selectableFn)
    if (!selectablePredicate)
      return true
    const index = keyToIndexMap
      ? (toValue(keyToIndexMap).get(key) ?? -1)
      : toValue(allData).findIndex(r => toValue(rowKey)(r) === key)
    return selectablePredicate(row, index)
  }

  function filterUnselectableKeys(keys: Set<string>): Set<string> {
    return filterUnselectableKeysUtil(keys, toValue(rowMap), toValue(selectableFn), keyToIndexMap ? toValue(keyToIndexMap) : undefined)
  }

  function isTreeCascadeEnabled(): boolean {
    const api = toValue(treeApi)
    return !!api && api.treeEnabled.value && !api.checkStrictly.value
  }

  return { isRowSelectable, filterUnselectableKeys, isTreeCascadeEnabled }
}
