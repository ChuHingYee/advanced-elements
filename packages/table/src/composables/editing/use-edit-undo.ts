import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { ProcessedColumn } from '../../types'
import { computed, shallowRef, toValue } from 'vue'
import { findLeafColumnByProp } from '../../utils/column-tree'
import { replaceRowInArray } from '../../utils/edit-helpers'

/**
 * <zh/> 编辑撤销记录条目
 * <en/> Edit undo entry
 *
 * @remarks
 * <zh/> 记录一次编辑操作的类型、行索引、行键、变更字段及时间戳，用于撤销/重做回放
 * <en/> Records type, row index, row key, changed fields and timestamp of an edit operation for undo/redo replay
 *
 * <zh/> rowKey 用于在数据排序/筛选/删除后可靠定位目标行；若未提供则回退到 rowIndex（此时撤销可能指向错误行）
 * <en/> rowKey is used to reliably locate the target row after data sort/filter/delete; falls back to rowIndex if not provided (undo may point to wrong row)
 */
export interface EditUndoEntry {
  type: 'cell' | 'row'
  rowIndex: number
  /** <zh/> 行唯一标识，撤销时优先通过此字段定位行 | <en/> Row unique identifier, used first for row location during undo */
  rowKey?: string | number
  changes: Array<{ prop: string, oldValue: any, newValue: any }>
  timestamp: number
}

/**
 * <zh/> useEditUndo 配置选项
 * <en/> useEditUndo configuration options
 */
export interface UseEditUndoOptions<T = any> {
  /** <zh/> 最大堆栈大小 | <en/> Maximum stack size */
  maxStackSize?: number | MaybeRefOrGetter<number | undefined>
  /** <zh/> 数据更新回调；source='full' 表示传入全量数据，'view-slice' 表示视图切片（默认）。useEditUndo 操作 tableData 全量数据，应传 'full' | <en/> Data update callback; source='full' for full dataset, 'view-slice' for view slice (default). useEditUndo operates on the full tableData and should pass 'full' */
  onDataUpdate: (newData: T[], source?: 'full' | 'view-slice') => void
  /** <zh/> 表格数据 | <en/> Table data */
  data: ComputedRef<T[]> | Ref<T[]>
  /** <zh/> 行键函数，用于撤销/重做时通过 rowKey 定位行（推荐提供，否则回退到 rowIndex）。支持 Ref/getter 以响应运行时 rowKey 变更 | <en/> Row key function, used for locating rows via rowKey during undo/redo (recommended, otherwise falls back to rowIndex). Supports Ref/getter to respond to runtime rowKey changes */
  rowKeyFn?: MaybeRefOrGetter<(row: T) => string>
  /**
   * <zh/> 条目无法应用时的策略（默认 'skip'）：
   * <zh/> - 'skip'：丢弃死条目并继续尝试后续条目——rowKey 未命中条目不阻塞栈顶
   * <zh/> - 'block'：保留条目并中止本次 undo/redo（旧行为）
   * <en/> Strategy when an entry cannot be applied (default 'skip'):
   * <en/> - 'skip': drop the dead entry and keep trying subsequent ones — a rowKey-missed
   * <en/>   entry never blocks the stack top
   * <en/> - 'block': keep the entry and abort this undo/redo call
   */
  failureStrategy?: MaybeRefOrGetter<'skip' | 'block'>
  /**
   * <zh/> 列配置（可选）——提供后撤销/重做的写入经由列 valueSetter 通道，
   * <zh/> 与正向编辑数据流保持一致；setter 拒写的条目按 failureStrategy 处理。
   * <en/> Column configs (optional) — when provided, undo/redo writes route through column
   * <en/> valueSetter, staying consistent with the forward-edit data flow; setter-rejected
   * <en/> entries follow failureStrategy.
   */
  columns?: ComputedRef<ProcessedColumn[]>
}

/**
 * useEditUndo 返回值
 */
export interface UseEditUndoReturn {
  undoStack: import('vue').ShallowRef<EditUndoEntry[]>
  redoStack: import('vue').ShallowRef<EditUndoEntry[]>
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  pushUndo: (entry: EditUndoEntry) => void
  /**
   * <zh/> 撤销并返回被应用的条目（null = 无可应用条目）——调用方据此补发
   * <zh/> cellValueChanged 等事件，与正向编辑路径对齐。真值语义与旧 boolean 返回兼容。
   * <en/> Undo and return the applied entry (null = nothing applied) — callers use it to emit
   * <en/> cellValueChanged etc., aligning with the forward-edit path. Truthiness matches the
   * <en/> boolean return for programmatic callers.
   */
  undo: () => EditUndoEntry | null
  /** <zh/> 同 undo，方向相反 | <en/> Same as undo, opposite direction */
  redo: () => EditUndoEntry | null
  clear: () => void
}

/**
 * 编辑撤销/重做栈 Composable。
 * 管理单元格和整行编辑的历史记录，支持 Ctrl+Z 撤销和 Ctrl+Shift+Z 重做。
 *
 * Composable for edit undo/redo stack management.
 * Tracks cell and row edit history, supporting Ctrl+Z undo and Ctrl+Shift+Z redo.
 *
 * @param options - 配置选项
 * @returns 撤销/重做 API
 *
 * @example
 * ```ts
 * const { pushUndo, undo, redo, canUndo, canRedo } = useEditUndo({
 *   maxStackSize: 50,
 *   onDataUpdate: (newData) => emit('update:data', newData),
 *   data: computed( => props.data),
 * })
 *
 * // 编辑提交后记录
 * pushUndo({ type: 'cell', rowIndex: 0, changes: [{ prop: 'name', oldValue: 'A', newValue: 'B' }], timestamp: Date.now })
 *
 * // Ctrl+Z 撤销
 * if (canUndo.value) undo
 * ```
 */
export function useEditUndo<T = any>(options: UseEditUndoOptions<T>): UseEditUndoReturn {
  const { onDataUpdate, data } = options
  const rowKeyFn = computed(() => options.rowKeyFn ? toValue(options.rowKeyFn) : undefined)
  const failureStrategy = computed(() => toValue(options.failureStrategy) ?? 'skip')
  const columns = computed(() => options.columns?.value)
  // <zh/> 栈深支持响应式 getter——宿主可经 editConfig.undoMaxStackSize 动态调整
  // <en/> Stack depth supports reactive getter — hosts may adjust via editConfig.undoMaxStackSize
  const effectiveMaxStackSize = computed(() => toValue(options.maxStackSize) ?? 50)

  const undoStack = shallowRef<EditUndoEntry[]>([])
  const redoStack = shallowRef<EditUndoEntry[]>([])

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  /** <zh/> 按 prop 查找带 valueSetter 的列配置（含分组子列，） | <en/> Find a column with valueSetter by prop (including grouped sub-columns,) */
  function findColumnSetter(prop: string): ProcessedColumn['valueSetter'] | undefined {
    const cols = columns.value
    if (!cols)
      return undefined
    return findLeafColumnByProp(cols, prop)?.valueSetter
  }

  /**
   * <zh/> 压入一条编辑记录到撤销栈。新操作清空重做栈（与标准撤销/重做语义一致）。
   *
   * @param entry - <zh/> 编辑记录 | <en/> edit record
   * <en/> Push an edit record onto the undo stack. New operations clear the redo stack (consistent with standard undo/redo semantics).
   */
  function pushUndo(entry: EditUndoEntry): void {
    const stack = [...undoStack.value, entry]
    if (stack.length > effectiveMaxStackSize.value)
      stack.shift()
    undoStack.value = stack
    redoStack.value = []
  }

  /**
   * <zh/> 将变更应用到数据行。
   * <zh/> 撤销时用 oldValue 替换当前值，重做时用 newValue 替换。
   * <zh/> 优先通过 entry.rowKey + rowKeyFn 定位目标行，
   * <zh/> 回退到 entry.rowIndex（数据变更后可能指向错误行）。
   * <zh/> 列配置了 valueSetter 时经 setter 通道写入（与正向编辑数据流一致），拒写视为失败。
   * <zh/> 返回是否成功定位并修改了目标行。
   *
   * @param entry - <zh/> 编辑记录条目 | <en/> edit record entry
   * @param direction - <zh/> 应用方向：'undo' 回退旧值，'redo' 恢复新值 | <en/> apply direction: 'undo' reverts to old value, 'redo' restores new value
   * @returns <zh/> 是否成功定位并修改了目标行 | <en/> whether the target row was found and modified
   *
   * <en/> Apply changes to data row.
   * <en/> Undo replaces current value with oldValue, redo replaces with newValue.
   * <en/> Prioritizes locating target row via entry.rowKey + rowKeyFn,
   * <en/> falls back to entry.rowIndex (may point to wrong row after data changes).
   * <en/> When a column declares valueSetter, writes route through the setter channel
   * <en/> (consistent with forward editing); a rejected write counts as failure.
   * <en/> Returns whether the target row was successfully located and modified.
   */
  function applyEditChanges(entry: EditUndoEntry, direction: 'undo' | 'redo'): boolean {
    const currentData = data.value
    let targetIndex = -1

    // 优先通过 rowKey 定位目标行，确保数据排序/筛选/分页后仍指向正确行
    // Prioritize locating target row via rowKey to ensure correct row after sort/filter/pagination
    if (entry.rowKey != null && rowKeyFn.value) {
      const fn = rowKeyFn.value
      targetIndex = currentData.findIndex(row => fn(row) === entry.rowKey)

      // rowKey 已配置但未命中目标行时，不回退到 rowIndex——
      // 数据变更后 rowIndex 可能指向错误行，写入会污染数据。
      // 返回 false，由调用方按 failureStrategy 决定丢弃或阻塞。
      // When rowKey is configured but not found, do NOT fall back to rowIndex
      // after data changes rowIndex may point to the wrong row, writing would corrupt data.
      // Return false and let the caller drop or block per failureStrategy.
      if (targetIndex === -1) {
        return false
      }
    }
    else {
      // 未配置 rowKey 时回退到 rowIndex（兜底，可能指向错误行）
      // Fall back to rowIndex when rowKey is not configured (fallback, may point to wrong row)
      targetIndex = entry.rowIndex
    }

    // 目标行不存在时不应用变更，避免污染 redo 栈
    // Do not apply changes when target row does not exist, preventing redo stack corruption
    if (targetIndex < 0 || targetIndex >= currentData.length) {
      return false
    }

    // 原地替换模式：仅复制数组 + 替换目标行，避免全量 map | In-place replacement mode: copy array + replace target row only, avoiding full map
    const newData = replaceRowInArray(
      currentData as unknown as T[],
      targetIndex,
      currentData[targetIndex] as T,
    )
    const row = newData[targetIndex] as Record<string, unknown>
    const updated = { ...row }
    for (const change of entry.changes) {
      const target = direction === 'undo' ? change.oldValue : change.newValue
      const setter = findColumnSetter(change.prop)
      if (setter) {
        // 经列 valueSetter 通道写入——与正向编辑共用数据流；
        // 拒写返回 false 视为该条目失败，交由 failureStrategy 处理
        // Route through the column's valueSetter — shared data flow with forward editing;
        // a rejection marks this entry failed and defers to failureStrategy
        const ok = setter({
          row: updated as T,
          column: findLeafColumnByProp(columns.value!, change.prop)!,
          rowIndex: targetIndex,
          oldValue: direction === 'undo' ? change.newValue : change.oldValue,
          newValue: target,
        })
        if (!ok)
          return false
      }
      else {
        updated[change.prop] = target
      }
    }
    newData[targetIndex] = updated as T
    // useEditUndo 操作的是 tableData（全量数据），显式声明 source='full' 走直接替换路径
    // useEditUndo operates on tableData (full dataset), explicitly declare source='full' to take the direct replace path
    onDataUpdate(newData, 'full')
    return true
  }

  /**
   * <zh/> 撤销上一次编辑，对每项变更回退为 oldValue。
   * <zh/> 遇到无法应用的条目（rowKey 未命中/行删除/setter 拒写）按 failureStrategy 处理：
   * <zh/> 'skip'（默认）丢弃并继续尝试更早的条目；'block' 保留条目并中止。
   *
   * @returns <zh/> 被应用的条目（null = 无可应用条目） | <en/> the applied entry (null = nothing applied)
   * <en/> Undo the last edit, reverting each change to oldValue.
   * <en/> Inapplicable entries (rowKey miss / row deleted / setter rejected) follow failureStrategy:
   * <en/> 'skip' (default) drops them and keeps trying earlier entries; 'block' keeps the entry and aborts.
   */
  function undo(): EditUndoEntry | null {
    let applied: EditUndoEntry | null = null
    while (undoStack.value.length > 0) {
      const stack = undoStack.value
      const entry = stack.at(-1)!
      if (!applyEditChanges(entry, 'undo')) {
        if (failureStrategy.value === 'block')
          return applied
        // skip：丢弃死条目继续 | drop the dead entry and continue
        undoStack.value = stack.slice(0, -1)
        continue
      }
      undoStack.value = stack.slice(0, -1)
      redoStack.value = [...redoStack.value, entry]
      applied = entry
      break
    }
    return applied
  }

  /**
   * <zh/> 重做上一次撤销的编辑，对每项变更恢复为 newValue。
   * <zh/> 失败条目处理策略同 undo。
   *
   * @returns <zh/> 被应用的条目（null = 无可应用条目） | <en/> the applied entry (null = nothing applied)
   * <en/> Redo the last undone edit, restoring each change to newValue.
   * <en/> Failed entries follow the same strategy as undo.
   */
  function redo(): EditUndoEntry | null {
    let applied: EditUndoEntry | null = null
    while (redoStack.value.length > 0) {
      const stack = redoStack.value
      const entry = stack.at(-1)!
      if (!applyEditChanges(entry, 'redo')) {
        if (failureStrategy.value === 'block')
          return applied
        redoStack.value = stack.slice(0, -1)
        continue
      }
      redoStack.value = stack.slice(0, -1)
      undoStack.value = [...undoStack.value, entry]
      applied = entry
      break
    }
    return applied
  }

  /**
   * 清空撤销和重做栈。
   * Clear both undo and redo stacks.
   */
  function clear(): void {
    undoStack.value = []
    redoStack.value = []
  }

  return {
    undoStack,
    redoStack,
    canUndo,
    canRedo,
    pushUndo,
    undo,
    redo,
    clear,
  }
}
