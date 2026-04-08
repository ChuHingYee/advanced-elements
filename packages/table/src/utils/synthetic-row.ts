/**
 * <zh/> 合成行统一判别（单一源）——group header / detail / grand-total / group-total
 * <zh/> 四类内部合成行永不进入业务选择集；`selectAll`、`getCheckStatus`（表头 checkbox 与
 * <zh/> `toggleAllSelection` 分支）必须共用本谓词，不得各自另算一次，否则全选口径分裂。
 * <en/> Single-source synthetic-row predicate — the four internal synthetic kinds never
 * <en/> enter the business selection set; `selectAll` and `getCheckStatus` must share it.
 */
import { AUTO_KEY_NAME } from './normalize-row-key'

/** <zh/> 合成行种类 | <en/> Synthetic row kind */
export type SyntheticRowKind = 'group-header' | 'detail' | 'grand-total' | 'group-total' | 'unknown'

/** <zh/> 合成行种类判别 | <en/> Synthetic row kind predicate */
export function getSyntheticRowKind(row: unknown): SyntheticRowKind {
  if (row == null || typeof row !== 'object')
    return 'unknown'
  const r = row as Record<string, unknown>
  if (r.__isGroupHeader === true)
    return 'group-header'
  if (r.__isDetailRow === true)
    return 'detail'
  if (r.__isGrandTotalRow === true)
    return 'grand-total'
  if (r.__isGroupTotalRow === true)
    return 'group-total'
  return 'unknown'
}

/**
 * <zh/> 合成行稳定键——优先行内 `[AUTO_KEY_NAME]` 预置身份（detail/group-header/group-total/
 * <zh/> grand-total 四类工厂均预置），排序/删除后仍指向同一行；无预置身份（如虚拟追加行）
 * <zh/> 回退 `kind:index`（可能随索引漂移，仅影响引用复用率，不影响正确性）。
 * <zh/> 供 RowViewModel 的 prevRowMap 键控：此前 `__synthetic__${i}` 纯索引键在排序/删除后
 * <zh/> 把旧行引用复用到不同行（引用语义错误）。
 * <en/> Stable synthetic-row key — prefers the preassigned `[AUTO_KEY_NAME]` identity (minted by all
 * <en/> four synthetic factories), which survives sorting/deletion; rows without one (e.g. virtual
 * <en/> append rows) fall back to `kind:index` (may drift with the index, affecting only reuse rate,
 * <en/> never correctness). Keys the RowViewModel prevRowMap: the former `__synthetic__${i}` pure-index
 * <en/> key reused stale references across different rows after sorting/deletion (wrong reference semantics).
 *
 * @param row - <zh/> 合成行对象 | <en/> synthetic row object
 * @param fallbackIndex - <zh/> 无预置身份时的回退索引 | <en/> fallback index when no preassigned identity
 * @returns <zh/> 稳定键 | <en/> stable key
 */
export function getSyntheticRowStableKey(row: unknown, fallbackIndex: number): string {
  const auto = (row as Record<string, unknown>)[AUTO_KEY_NAME]
  if (typeof auto === 'string' && auto !== '')
    return `__synthetic__${auto}`
  if (typeof auto === 'number')
    return `__synthetic__${auto}`
  return `__synthetic__${getSyntheticRowKind(row)}:${fallbackIndex}`
}

/** <zh/> 是否为内部合成行 | <en/> Whether the row is an internal synthetic row */
export function isSyntheticRow(row: unknown): boolean {
  if (row == null || typeof row !== 'object')
    return false
  const r = row as Record<string, unknown>
  return r.__isGroupHeader === true
    || r.__isDetailRow === true
    || r.__isGrandTotalRow === true
    || r.__isGroupTotalRow === true
}

/** <zh/> 是否为分组头行 | <en/> Whether the row is a group header row */
export function isGroupHeaderRow(row: unknown): boolean {
  return row != null && typeof row === 'object' && (row as Record<string, unknown>).__isGroupHeader === true
}

/** <zh/> 是否为展开详情行 | <en/> Whether the row is an expand detail row */
export function isDetailRow(row: unknown): boolean {
  return row != null && typeof row === 'object' && (row as Record<string, unknown>).__isDetailRow === true
}

/** <zh/> 是否为合计行（Grand Total / Group Total，两者均不可选中） | <en/> Whether the row is a total row (grand/group, neither selectable) */
export function isTotalRow(row: unknown): boolean {
  if (row == null || typeof row !== 'object')
    return false
  const r = row as Record<string, unknown>
  return r.__isGrandTotalRow === true || r.__isGroupTotalRow === true
}

/**
 * <zh/> 是否为可参与选择的业务行：先排除合成行，再应用列级 selectable 谓词。
 * <en/> Whether the row is a selectable business row: synthetic rows excluded first, then the column-level selectable predicate.
 */
export function isSelectableBusinessRow<T>(
  row: T,
  index: number,
  selectableFn?: ((row: T, index: number) => boolean) | undefined,
): boolean {
  if (isSyntheticRow(row))
    return false
  if (selectableFn && !selectableFn(row, index))
    return false
  return true
}
