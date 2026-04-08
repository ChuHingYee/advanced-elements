/**
 * <zh/> 树形选择级联工具 — 纯函数操作 Set<string>，处理父子节点选中联动
 *
 * <en/> Tree selection cascade utilities — pure functions operating on Set<string>,
 * <en/> handling parent/child selection cascading.
 *
 * @remarks
 * <zh/> 从 use-selection-state.ts 拆分，消除 handleTreeToggle / selectAll / clearVisibleRows 中
 * <zh/> 重复的 "遍历子孙/祖先 key" 循环逻辑。纯函数无副作用，接收 Set 并直接修改。
 *
 * <en/> Extracted from use-selection-state.ts, eliminating duplicated
 * <en/> "iterate descendant/ancestor keys" loops across handleTreeToggle / selectAll / clearVisibleRows.
 * <en/> Pure functions with no side effects — receive and mutate a Set in place.
 */
import type { TreeApi } from '../types/config'

/**
 * <zh/> 检查指定行的所有子孙节点是否都在 keys 中
 * <zh/> 传入 isSelectable 时只统计可选后代（不可选后代恒不计入），
 * <zh/> 与“所有可选子节点全选即可选父节点”的公开契约对齐。
 *
 * <en/> Check whether all descendants of the given row key are present in `keys`.
 */
export function isAllDescendantsSelected(
  rowKey: string,
  keys: Set<string>,
  api: TreeApi,
  isSelectable?: (dk: string | number) => boolean,
): boolean {
  const descendantKeys = api.getDescendantKeys(rowKey)
  if (descendantKeys.size === 0)
    return true
  let hasSelectable = false
  for (const dk of descendantKeys) {
    if (isSelectable && !isSelectable(dk))
      continue
    hasSelectable = true
    if (!keys.has(String(dk)))
      return false
  }
  // 无可选后代时保守返回 false（与既有行为一致，避免凭空选中父节点）
  return hasSelectable
}

/**
 * <zh/> 向 Set 中添加 key 的所有子孙 key（可选：通过 isSelectable 过滤不可选子孙）
 *
 * <en/> Add all descendant keys of `key` to the Set (optionally filtering out non-selectable descendants via isSelectable).
 *
 * @param newSet - <zh/> 目标 key 集合 | <en/> target key set
 * @param key - <zh/> 级联起始行 key | <en/> cascade root row key
 * @param api - <zh/> 树查询 API | <en/> tree query API
 * @param isSelectable - <zh/> 可选：不可选子孙过滤谓词 | <en/> optional non-selectable-descendant predicate
 * @param covered - <zh/> 可选：同步登记「本行级联已写入 newSet」的子孙，供 selectAll 短路跳过
 *   <zh/> 已被祖先整棵覆盖的可见行（只登记**实际加入**的子孙，故被过滤者不会被误标） | <en/>
 *   optional: also record the descendants this cascade actually wrote into `newSet`, letting selectAll
 *   short-circuit visible rows already covered wholesale by an ancestor (only **actually added** ones are
 *   recorded, so filtered-out descendants are never mislabeled)
 */
export function addDescendantKeysToSet(
  newSet: Set<string>,
  key: string,
  api: TreeApi,
  isSelectable?: (dk: string | number) => boolean,
  covered?: Set<string>,
): void {
  const descendantKeys = api.getDescendantKeys(key)
  for (const dk of descendantKeys) {
    if (!isSelectable || isSelectable(dk)) {
      const dkStr = String(dk)
      newSet.add(dkStr)
      covered?.add(dkStr)
    }
  }
}

/**
 * <zh/> 从 Set 中移除 key 及其所有子孙和祖先 key
 *
 * <en/> Remove `key` along with all its descendant and ancestor keys from the Set.
 *
 * @remarks
 * <zh/> 用于取消选中时的级联清理——子孙必然取消，祖先也必然取消（因为子被移除后祖先不再满选）。
 * <en/> Used for cascade cleanup on deselect — descendants are always removed,
 * <en/> and ancestors are always removed (since removing a child means the ancestor is no longer fully selected).
 */
export function removeKeyAndTreeRelatives(newSet: Set<string>, key: string, api: TreeApi): void {
  newSet.delete(key)
  const descendantKeys = api.getDescendantKeys(key)
  for (const dk of descendantKeys) {
    newSet.delete(String(dk))
  }
  const ancestorKeys = api.getAncestorKeys(key)
  for (const ak of ancestorKeys) {
    newSet.delete(ak)
  }
}

/**
 * <zh/> 扫描 Set 中已存在的 key，将"所有子孙均已选中"的祖先 key 补入 Set
 *
 * <en/> Scan existing keys in the Set and add ancestor keys whose descendants are all selected.
 *
 * @remarks
 * <zh/> 用于 selectAll 场景——先添加所有可见行及其子孙，再扫描补全满足条件的祖先。
 * <zh/> 使用 checkedAncestors 去重，避免对同一祖先重复检查。
 *
 * <en/> Used in selectAll — first add all visible rows and their descendants,
 * <en/> then scan to complete ancestors that meet the "all descendants selected" condition.
 * <en/> Uses a checkedAncestors set to avoid re-checking the same ancestor.
 */
export function completeAncestors(
  newSet: Set<string>,
  api: TreeApi,
  isSelectable?: (dk: string | number) => boolean,
): void {
  const checkedAncestors = new Set<string>()
  for (const key of newSet) {
    const ancestorKeys = api.getAncestorKeys(key)
    for (const ak of ancestorKeys) {
      if (!checkedAncestors.has(ak)) {
        checkedAncestors.add(ak)
        if (isAllDescendantsSelected(ak, newSet, api, isSelectable)) {
          newSet.add(ak)
        }
      }
    }
  }
}
