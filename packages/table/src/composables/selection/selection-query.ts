import type { MaybeRefOrGetter, ShallowRef } from 'vue'
import type { CheckStatus } from './selection-types'
import { toValue } from 'vue'
import { deriveCheckStatus } from '../../utils/checkbox-state'
import {
  getSelectedCountValue,
  getSelectedKeysArray,
  getSelectedRowIndices,
  isKeySelected,
  iterateSelectedRows,
} from '../../utils/selection-serialization'
import { isSelectableBusinessRow } from '../../utils/synthetic-row'

/**
 * <zh/> 选中查询域——只读派生，不修改状态
 * <en/> Selection-query domain — read-only derivations that never mutate state
 *
 * @remarks
 * <zh/> 纯工厂而非 composable：全部为同步派生，无响应式状态与 watcher。
 * <zh/> 依赖 `selectedKeys` 的**引用**（`ShallowRef`），而非解构值，避免响应式丢失。
 * <en/> A pure factory rather than a composable: everything is a synchronous derivation with no
 * <en/> reactive state or watchers. It depends on the **reference** to `selectedKeys`
 * <en/> (a `ShallowRef`) rather than a destructured value, so reactivity is never lost.
 */
export interface SelectionQueryDeps<T = any> {
  /** <zh/> 选中键集（状态核持有，本域只读） | <en/> selected key set (owned by the core; this domain only reads) */
  selectedKeys: ShallowRef<Set<string>>
  /** <zh/> 行键函数 | <en/> row key function */
  rowKey: MaybeRefOrGetter<(row: T) => string>
  /** <zh/> 行映射 | <en/> row map */
  rowMap: MaybeRefOrGetter<Map<string, T>>
  /** <zh/> 可选中谓词（getCheckStatus 的默认来源） | <en/> selectable predicate (default source for getCheckStatus) */
  selectableFn?: MaybeRefOrGetter<((row: T, index: number) => boolean) | undefined>
}

/** <zh/> 选中查询域返回 | <en/> Selection-query return */
export interface SelectionQuery<T = any> {
  isSelectedByKey: (key: string | number) => boolean
  getSelectedKeys: () => string[]
  getSelectedCount: () => number
  forEachSelected: (callback: (row: T, key: string) => void) => void
  getSelectedIndices: (allData: T[]) => number[]
  getCheckStatus: (visibleRows: T[], customSelectableFn?: (row: T, index: number) => boolean) => CheckStatus
}

/**
 * <zh/> 创建选中查询域
 * <en/> Create the selection-query domain
 */
export function createSelectionQuery<T = any>(deps: SelectionQueryDeps<T>): SelectionQuery<T> {
  const { selectedKeys, rowKey, rowMap, selectableFn } = deps

  function isSelectedByKey(key: string | number): boolean {
    return isKeySelected(selectedKeys.value, key)
  }

  function getSelectedKeys(): string[] {
    return getSelectedKeysArray(selectedKeys.value)
  }

  function getSelectedCount(): number {
    return getSelectedCountValue(selectedKeys.value)
  }

  function forEachSelected(callback: (row: T, key: string) => void): void {
    iterateSelectedRows(selectedKeys.value, toValue(rowMap), callback)
  }

  function getSelectedIndices(allData: T[]): number[] {
    return getSelectedRowIndices(selectedKeys.value, allData, toValue(rowKey))
  }

  function getCheckStatus(
    visibleRows: T[],
    customSelectableFn?: (row: T, index: number) => boolean,
  ): CheckStatus {
    const selectablePredicate = customSelectableFn ?? toValue(selectableFn)
    const currentRowKey = toValue(rowKey)
    let total = 0
    let selectedCount = 0
    for (let i = 0; i < visibleRows.length; i++) {
      const row = visibleRows[i]
      // 与 selectAll 同口径——合成行永不计入（共用 isSelectableBusinessRow）
      if (!isSelectableBusinessRow(row, i, selectablePredicate))
        continue
      total++
      if (selectedKeys.value.has(currentRowKey(row)))
        selectedCount++
    }
    return deriveCheckStatus(selectedCount, total)
  }

  return { isSelectedByKey, getSelectedKeys, getSelectedCount, forEachSelected, getSelectedIndices, getCheckStatus }
}
