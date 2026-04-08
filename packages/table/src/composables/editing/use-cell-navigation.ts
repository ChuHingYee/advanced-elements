import type { ComputedRef } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { EditConfig } from '../../types/edit'
import { getColumnKey } from '../../utils/shared'

export interface UseCellNavigationOptions<T> {
  /** <zh/> 可编辑列配置 | <en/> Editable columns config */
  editableColumns: ComputedRef<ProcessedColumn[]>
  /** <zh/> 表格行数据 | <en/> Table row data */
  data: ComputedRef<T[]>
  /** <zh/> 编辑配置 | <en/> Edit config */
  editConfig: ComputedRef<EditConfig | undefined>
}

export interface UseCellNavigationReturn {
  /** <zh/> 查找下一个/上一个可编辑单元格 | <en/> Find next/previous editable cell */
  findNextEditableCell: (fromRowIndex: number, fromColumnKey: string, direction?: 'next' | 'previous', vertical?: boolean) => { rowIndex: number, columnKey: string, prop: string } | null
  /** <zh/> 查找指定行第一个可编辑单元格 | <en/> Find first editable cell in the specified row */
  findFirstEditableCell: (rowIndex: number) => { rowIndex: number, columnKey: string, prop: string } | null
  /** <zh/> 查找指定行最后一个可编辑单元格 | <en/> Find last editable cell in the specified row */
  findLastEditableCell: (rowIndex: number) => { rowIndex: number, columnKey: string, prop: string } | null
}

/**
 * <zh/> 单元格导航算法组合式函数
 * <en/> Cell navigation algorithm composable
 *
 * @remarks
 * <zh/> 从 use-cell-edit 拆分，纯查找逻辑无副作用。支持 Tab/Shift+Tab 水平导航与垂直导航，
 * 可通过 editConfig.tabToNextCell 自定义导航行为
 * <en/> Extracted from use-cell-edit, pure lookup logic with no side effects. Supports Tab/Shift+Tab horizontal navigation
 * and vertical navigation, customizable via editConfig.tabToNextCell
 */
export function useCellNavigation<T>(options: UseCellNavigationOptions<T>): UseCellNavigationReturn {
  const { editableColumns, data, editConfig } = options

  interface NavigableEntry { cols: Array<ProcessedColumn & { prop: string }>, keys: string[], props: string[] }
  /**
   * <zh/> 可导航列缓存（源数组引用键控，WeakMap 自动回收）——Tab 高频路径免去每次 O(m) 过滤+双 map。
   * <en/> Navigable-column cache (keyed by source array reference, GC-safe via WeakMap) — spares the
   * <en/> hot Tab path a per-call O(m) filter + double map.
   */
  const navCache = new WeakMap<readonly ProcessedColumn[], NavigableEntry>()

  /**
   * <zh/> 可导航列：仅含 `prop != null` 的可持久化列。
   * <zh/> 单格提交以 `prop` 为写键（`{...row, [prop]: value}`），无 prop 列导航可达但提交会写出
   * <zh/> `undefined` 字段——与整行提交的跳过口径（`prop == null && !valueSetter`）对齐，此处直接不可达。
   * <en/> Navigable columns: only persistable columns with `prop != null`.
   * <en/> Single-cell commit writes by `prop` (`{...row, [prop]: value}`); a prop-less column reachable
   * <en/> via navigation would write an `undefined` field — aligned with the full-row skip caliber,
   * <en/> such columns are unreachable here.
   */
  function navigableColumns(): NavigableEntry {
    const src = editableColumns.value
    let entry = navCache.get(src)
    if (!entry) {
      const cols = src.filter(
        (col): col is ProcessedColumn & { prop: string } => col.prop != null,
      )
      entry = { cols, keys: cols.map(c => getColumnKey(c)), props: cols.map(c => c.prop) }
      navCache.set(src, entry)
    }
    return entry
  }

  function findNextEditableCell(
    fromRowIndex: number,
    fromColumnKey: string,
    direction: 'next' | 'previous' = 'next',
    vertical = false,
  ): { rowIndex: number, columnKey: string, prop: string } | null {
    const { cols, keys: colKeys, props: colProps } = navigableColumns()
    if (cols.length === 0)
      return null

    const totalRows = data.value.length
    if (totalRows === 0)
      return null

    const tabConfig = editConfig.value?.tabToNextCell
    if (!vertical && typeof tabConfig === 'function') {
      return tabConfig({ rowIndex: fromRowIndex, columnKey: fromColumnKey, direction })
    }

    if (vertical) {
      const currentColIdx = colKeys.indexOf(fromColumnKey)
      if (currentColIdx === -1)
        return null

      let rowIdx = fromRowIndex
      const step = direction === 'next' ? 1 : -1
      rowIdx += step

      if (rowIdx < 0 || rowIdx >= totalRows)
        return null

      return {
        rowIndex: rowIdx,
        columnKey: colKeys[currentColIdx]!,
        prop: colProps[currentColIdx]!,
      }
    }

    const currentColIdx = colKeys.indexOf(fromColumnKey)
    if (currentColIdx === -1)
      return null

    let nextColIdx = currentColIdx + (direction === 'next' ? 1 : -1)
    let rowIdx = fromRowIndex

    if (nextColIdx >= colKeys.length) {
      nextColIdx = 0
      rowIdx++
    }
    else if (nextColIdx < 0) {
      nextColIdx = colKeys.length - 1
      rowIdx--
    }

    if (rowIdx < 0 || rowIdx >= totalRows)
      return null

    return {
      rowIndex: rowIdx,
      columnKey: colKeys[nextColIdx]!,
      prop: colProps[nextColIdx]!,
    }
  }

  function findFirstEditableCell(rowIndex: number): { rowIndex: number, columnKey: string, prop: string } | null {
    const { cols, keys } = navigableColumns()
    if (cols.length === 0)
      return null
    if (rowIndex < 0 || rowIndex >= data.value.length)
      return null
    const first = cols[0]!
    return { rowIndex, columnKey: keys[0]!, prop: first.prop }
  }

  function findLastEditableCell(rowIndex: number): { rowIndex: number, columnKey: string, prop: string } | null {
    const { cols, keys, props } = navigableColumns()
    if (cols.length === 0)
      return null
    if (rowIndex < 0 || rowIndex >= data.value.length)
      return null
    return { rowIndex, columnKey: keys.at(-1)!, prop: props.at(-1)! }
  }

  return {
    findNextEditableCell,
    findFirstEditableCell,
    findLastEditableCell,
  }
}
