/**
 * <zh/> 单元格脏标记追踪 composable — 管理编辑状态下的 dirtyCells Map
 * <en/> Cell dirty tracking composable — manages dirtyCells Map during editing
 *
 * @remarks
 * <zh/> 从 use-cell-edit.ts 拆出，职责单一：
 * <zh/> - 记录编辑开始时的原始值
 * <zh/> - 判断单元格是否处于 dirty 状态
 * <zh/> - 提交后清除脏标记
 * <zh/> - 数据行减少时清理过期条目
 * <en/> Extracted from use-cell-edit.ts, single responsibility:
 * <en/> - Records original value when editing starts
 * <en/> - Determines if a cell is dirty
 * <en/> - Clears dirty flag after commit
 * <en/> - Cleans up stale entries when data rows decrease
 *
 * @remarks
 * <zh/> 以 rowKey 为键，排序/筛选/分页后脏标记跟随物理行而非可见索引。
 * <en/> Uses rowKey as key, dirty flag follows physical row instead of visible index after sort/filter/pagination.
 */
import type { ComputedRef, ShallowRef } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { EditConfig, EditingCellState } from '../../types/edit'
import { computed, shallowRef, triggerRef, watch } from 'vue'
import { traverseColumnTree } from '../../utils/column-tree'
import { DIRTY_KEY_SEP } from '../../utils/edit-helpers'
import { shallowEqual } from '../../utils/equality'
import { getColumnKey } from '../../utils/shared'

export interface UseEditDirtyDeps<T = any> {
  /** <zh/> 表格行数据 | <en/> Table row data */
  data: ComputedRef<T[]>
  /** <zh/> 列配置 | <en/> Column config */
  columns: ComputedRef<ProcessedColumn[]>
  /** <zh/> 编辑配置 | <en/> Edit config */
  editConfig: ComputedRef<EditConfig | undefined>
  /** <zh/> 行键函数 | <en/> Row key function */
  rowKey: ComputedRef<((row: T) => string) | null>
  /** <zh/> 当前编辑中的单元格 | <en/> Currently editing cell */
  editingCell: ShallowRef<EditingCellState | null>
  /**
   * <zh/> fullRow 编辑态（可选）——编辑缓冲值不写入 data，缺省时 fullRow 行的
   * <zh/> isCellDirty 恒为 false（showStatus 在 fullRow 模式下形同虚设的根因）。
   * <en/> fullRow editing state (optional) — edit-buffer values never touch data; without this
   * <en/> isCellDirty is always false for fullRow rows (root cause of showStatus being a no-op
   * <en/> in fullRow mode).
   */
  fullRowEditing?: {
    isFullRowEdit: ComputedRef<boolean>
    editingRowIndex: ShallowRef<number | null>
    editingValues: ShallowRef<Record<string, any>>
  }
}

export interface UseEditDirtyReturn {
  /** <zh/> 脏单元格集合 | <en/> Dirty cells collection */
  dirtyCells: ShallowRef<Map<string, any>>
  /**
   * <zh/> 持有脏记录的行键集合（rowKey 域）——增量维护，与 dirtyCells 同步更新。
   * <zh/> 供 RowViewModel 稀疏化反转"受影响行集"，避免每次重算解析 Map 键。
   * <en/> Set of row keys holding dirty records (rowKey domain) — incrementally maintained
   * <en/> in sync with dirtyCells. Consumed by the sparse RowViewModel to invert the
   * <en/> "affected row set" without parsing map keys on every recomputation.
   */
  dirtyRowKeys: ShallowRef<ReadonlySet<string>>
  /** <zh/> 列 key 到列配置的映射 | <en/> Column key to column config mapping */
  columnKeyMap: ComputedRef<Map<string, ProcessedColumn>>
  isCellDirty: (rowIndex: number, columnKey: string) => boolean
  recordOriginalValue: (rowIndex: number, columnKey: string, value: any) => void
  clearDirtyCell: (rowIndex: number, columnKey: string) => void
}

export function useEditDirty<T = any>(deps: UseEditDirtyDeps<T>): UseEditDirtyReturn {
  const { data, columns, editConfig, rowKey, editingCell, fullRowEditing } = deps

  const dirtyCells = shallowRef<Map<string, any>>(new Map())

  /**
   * <zh/> 持有脏记录的行键集合——与 dirtyCells 在全部三个变更点（记录/清除/清理）同步增量维护。
   * <zh/> 采用与 dirtyCells 相同的"原地变更 + triggerRef"模式。
   * <en/> Set of row keys holding dirty records — incrementally synced at all three mutation
   * <en/> sites (record/clear/cleanup). Uses the same "in-place mutate + triggerRef" pattern as dirtyCells.
   */
  const dirtyRowKeysSet = new Set<string>()
  const dirtyRowKeys = shallowRef<ReadonlySet<string>>(dirtyRowKeysSet)

  /**
   * <zh/> 列 key 到列配置的 Map 缓存，避免 isCellDirty 等高频调用中的 O(n) 线性查找。
   * 列变化时自动重建。
   * <en/> Map cache from column key to column config, avoiding O(n) linear lookup in high-frequency calls like isCellDirty.
   * Automatically rebuilt when columns change.
   */
  const columnKeyMap = computedColumnKeyMap(columns)

  /**
   * <zh/> 判断单元格是否处于 dirty 状态（值已修改但未提交）。
   * - 编辑中：存在原始值记录即为 dirty（editingValue 依赖在 ElTable slot 中可能不被追踪）
   * - 非编辑中：比较 data 中的当前值与存储的原始值
   * recordOriginalValue 在编辑开始时写入原始值，clearDirtyCell 在提交后清除。
   * <en/> Determine whether a cell is in dirty state (value modified but not committed).
   * - During editing: dirty if original value record exists (editingValue dependency may not be tracked in ElTable slot)
   * - Not editing: compare current value in data with stored original value
   * recordOriginalValue writes original value when editing starts, clearDirtyCell clears it after commit.
   */
  function isCellDirty(rowIndex: number, columnKey: string): boolean {
    if (!editConfig.value?.showStatus)
      return false
    const row = data.value[rowIndex]
    if (!row)
      return false
    const rk = rowKey.value
    if (!rk)
      return false
    const key = `${rk(row)}${DIRTY_KEY_SEP}${columnKey}`
    if (!dirtyCells.value.has(key))
      return false

    // 编辑中的单元格：存在原始值记录即为 dirty
    if (editingCell.value
      && editingCell.value.rowIndex === rowIndex
      && editingCell.value.columnKey === columnKey) {
      // 无 prop 列没有数据绑定，无法判定脏状态（与下方非编辑分支语义一致）
      const col = columnKeyMap.value.get(columnKey)
      const prop = col?.prop ?? col?.property
      if (!prop)
        return false
      return true
    }

    // <zh/> fullRow 编辑中：编辑缓冲（editingValues）不写入 data，data 仍持原始值——
    // <zh/> 若走下方非编辑分支则恒判"未变更"。改为比较编辑缓冲与原始值，
    // <zh/> 只有真正改过的列才显示脏标（单格语义对齐：有记录 + 值已变）。
    // <en/> fullRow editing: the edit buffer (editingValues) never touches data, so data still
    // <en/> holds the original value — the non-editing branch below would always report
    // <en/> "unchanged". Compare the buffer against the original instead so only truly modified
    // <en/> columns show the dirty marker (aligned with the single-cell semantics).
    if (fullRowEditing
      && fullRowEditing.isFullRowEdit.value
      && fullRowEditing.editingRowIndex.value === rowIndex) {
      const col = columnKeyMap.value.get(columnKey)
      const prop = col?.prop ?? col?.property
      if (!prop)
        return false
      return !shallowEqual(fullRowEditing.editingValues.value[columnKey], dirtyCells.value.get(key))
    }

    // 非编辑中的单元格：比较 data 中的当前值
    const col = columnKeyMap.value.get(columnKey)
    const prop = col?.prop ?? col?.property
    if (!prop)
      return false
    return !shallowEqual((row as Record<string, unknown>)[prop], dirtyCells.value.get(key))
  }

  function recordOriginalValue(rowIndex: number, columnKey: string, value: any): void {
    if (!editConfig.value?.showStatus)
      return
    const row = data.value[rowIndex]
    if (!row)
      return
    const rk = rowKey.value
    if (!rk)
      return
    const rowKeyStr = rk(row)
    const key = `${rowKeyStr}${DIRTY_KEY_SEP}${columnKey}`
    if (!dirtyCells.value.has(key)) {
      dirtyCells.value.set(key, value)
      triggerRef(dirtyCells)
      if (!dirtyRowKeysSet.has(rowKeyStr)) {
        dirtyRowKeysSet.add(rowKeyStr)
        triggerRef(dirtyRowKeys)
      }
    }
  }

  function clearDirtyCell(rowIndex: number, columnKey: string): void {
    const row = data.value[rowIndex]
    if (!row)
      return
    const rk = rowKey.value
    if (!rk)
      return
    const rowKeyStr = rk(row)
    const key = `${rowKeyStr}${DIRTY_KEY_SEP}${columnKey}`
    if (dirtyCells.value.has(key)) {
      dirtyCells.value.delete(key)
      triggerRef(dirtyCells)
      // <zh/> 该行已无任何脏记录时才移除行键 | <en/> Remove the row key only when the row holds no dirty records
      const prefix = `${rowKeyStr}${DIRTY_KEY_SEP}`
      let remains = false
      for (const k of dirtyCells.value.keys()) {
        if (k.startsWith(prefix)) {
          remains = true
          break
        }
      }
      if (!remains && dirtyRowKeysSet.delete(rowKeyStr))
        triggerRef(dirtyRowKeys)
    }
  }

  /**
   * 数据行减少时清理超出范围的 dirtyCells 条目，防止内存泄漏。
   * 场景：删除行、筛选导致行数减少后，已删除行的 dirtyCells 条目无意义且无法自动回收。
   *
   * 优化：仅收集 dirty 行的 rowKey（O(dirtyCount)），遍历 newData 标记命中后提前退出。
   * 常见场景（dirty 行仍存在）下复杂度从 O(n) 降为 O(dirtyCount)。
   */
  /**
   * <zh/> 脏标记剪除回调——data 引用变化时清理已消失行的 dirtyCells 条目（防内存泄漏）
   * <en/> Dirty-mark prune callback — drops dirtyCells entries of vanished rows on data change (leak guard)
   */
  function onDataChangedPruneDirtyCells(newData: typeof data.value): void {
    const dirtyMap = dirtyCells.value
    if (dirtyMap.size === 0)
      return
    const rk = rowKey.value
    if (!rk) {
      dirtyMap.clear()
      triggerRef(dirtyCells)
      if (dirtyRowKeysSet.size > 0) {
        dirtyRowKeysSet.clear()
        triggerRef(dirtyRowKeys)
      }
      return
    }

    /** <zh/> 收集 dirty 行的 rowKey——仅这些行需要存在性检查 | <en/> Collect dirty row keys — only these rows need existence checks */
    const staleRowKeys = new Set<string>()
    for (const key of dirtyMap.keys()) {
      staleRowKeys.add(key.split(DIRTY_KEY_SEP)[0])
    }

    /** 遍历 newData 标记命中行，全部命中时提前退出 */
    for (const row of newData) {
      staleRowKeys.delete(rk(row))
      if (staleRowKeys.size === 0)
        return // 所有 dirty 行仍存在——无需清理
    }

    /** 剩余未命中的 rowKey 对应行已被删除——清理其 dirty 条目 */
    let changed = false
    for (const key of dirtyMap.keys()) {
      if (staleRowKeys.has(key.split(DIRTY_KEY_SEP)[0])) {
        dirtyMap.delete(key)
        changed = true
      }
    }
    if (changed) {
      triggerRef(dirtyCells)
      // <zh/> 同步收缩行键集合——移除已无任何脏记录的行键 | <en/> Shrink the row-key set — drop keys with no remaining dirty records
      let rowKeysChanged = false
      for (const rowKeyStr of [...dirtyRowKeysSet]) {
        const prefix = `${rowKeyStr}${DIRTY_KEY_SEP}`
        let remains = false
        for (const k of dirtyMap.keys()) {
          if (k.startsWith(prefix)) {
            remains = true
            break
          }
        }
        if (!remains && dirtyRowKeysSet.delete(rowKeyStr))
          rowKeysChanged = true
      }
      if (rowKeysChanged)
        triggerRef(dirtyRowKeys)
    }
  }

  // <zh/> 点燃链（接上条）：同源 tableData 变化 → 剪除已消失行的脏格；与取消编辑守卫并行，排查编辑态残留时两处对照
  // <en/> Ignition chain (cont.): same-source tableData change → prune dirty cells of vanished rows; parallel with the cancel-editing guard
  watch(data, onDataChangedPruneDirtyCells, { flush: 'post' })

  return {
    dirtyCells,
    dirtyRowKeys,
    columnKeyMap,
    isCellDirty,
    recordOriginalValue,
    clearDirtyCell,
  }
}

/**
 * 列 key → 列配置 的 Map 缓存。
 * 独立为工厂函数，保持 useEditDirty 主体简洁。
 */
function computedColumnKeyMap(columns: ComputedRef<ProcessedColumn[]>): ComputedRef<Map<string, ProcessedColumn>> {
  return computed(() => {
    const map = new Map<string, ProcessedColumn>()
    traverseColumnTree(columns.value, (col) => {
      map.set(getColumnKey(col), col)
    })
    return map
  })
}
