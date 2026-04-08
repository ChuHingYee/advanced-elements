import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { EditConfig } from '../../types/edit'
import type { CellState, DecorationRangeRect } from '../view-model/use-row-view-model'
import { computed, toValue } from 'vue'
import { flattenLeafColumns } from '../../utils/column-tree'
import { buildRowViewModelMap } from '../view-model/build-row-view-model-map'
import { useRowViewModel } from '../view-model/use-row-view-model'

/**
 * <zh/> 编辑行视图模型装配依赖 | <en/> Editing row-view-model assembly deps
 */
export interface UseEditingViewModelDeps<T> {
  editConfig: MaybeRefOrGetter<EditConfig | undefined>
  effectiveColumns: Ref<ProcessedColumn[]>
  rendererData: ComputedRef<T[]>
  rowKeyFn: ComputedRef<(row: T) => string>
  isCellInRangeSelection: (rowIndex: number, colIndex: number) => boolean
  rangeSelectionRange?: ComputedRef<DecorationRangeRect | null>
  editingCell: Ref<{ rowIndex: number, columnKey: string } | null>
  editingRowIndex: Ref<number | null>
  isFullRowEdit: ComputedRef<boolean>
  dirtyRowKeys: Ref<ReadonlySet<string>>
  isCellEditing: (rowIndex: number, colKey: string) => boolean
  isCellDirty: (rowIndex: number, colKey: string) => boolean
}

/**
 * <zh/> 编辑行视图模型装配——稀疏快照源（编辑/脏域/选区差分）与 useRowViewModel/映射表。
 *
 * <zh/> 自 use-editing-orchestrator.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C），主体逐字未改。
 * <en/> Editing row-view-model assembly — the sparse snapshot source (editing/dirty/selection
 * <en/> diffs) and useRowViewModel / its map.
 *
 * <en/> Migrated verbatim from use-editing-orchestrator.ts (COMPLEXITY-PLAN battle line 3, knife C).
 */
export function useEditingViewModel<T>(deps: UseEditingViewModelDeps<T>) {
  const {
    editConfig: editConfigInput,
    effectiveColumns,
    rendererData,
    rowKeyFn,
    isCellInRangeSelection,
    rangeSelectionRange,
    editingCell,
    editingRowIndex,
    isFullRowEdit,
    dirtyRowKeys,
    isCellEditing,
    isCellDirty,
  } = deps

  // <zh/> 无范围选择时也构造最小快照复用稀疏路径——rangeSelection 取 null，
  // <zh/> 编辑/脏域仍参与差分，单格提交由 O(n×m) 降为 O(受影响行×m)；选区矩形为 null 时差分恒等，无卡死风险。
  // <en/> always assemble a minimal snapshot (rangeSelection null when absent) to reuse the
  // <en/> sparse path — single-cell cost drops from O(n×m) to O(affected×m); null rect diffs as identity.
  const sparseSnapshotSource = () => ({
    editingCell: editingCell.value,
    editingRowIndex: editingRowIndex.value,
    isFullRowEdit: isFullRowEdit.value,
    rangeSelection: rangeSelectionRange?.value ?? null,
    dirtyRowKeys: dirtyRowKeys.value,
    dirtyTrackingEnabled: !!toValue(editConfigInput)?.showStatus,
  })

  const { rowViewModels: tableRowViewModels } = useRowViewModel<T>({
    visibleData: rendererData,
    rowKeyFn: () => rowKeyFn.value,
    isCellEditing: (rowIndex, colKey) => isCellEditing(rowIndex, colKey),
    isCellDirty: (rowIndex, colKey) => isCellDirty(rowIndex, colKey),
    isCellSelected: (rowIndex, colIndex) => isCellInRangeSelection(rowIndex, colIndex),
    // RowViewModel 必须按叶子列计数：顶层组头会使 cells 按组计数，与渲染器叶子索引错位。
    // 叶子序必须与渲染器同源（flattenLeafColumns 的 DFS 前序）——历史上的手写 BFS 会先输出
    // 第一层叶子再输出深层叶子，分组表下 cells[i] 与渲染器实际绘制顺序错位。
    // RowViewModel must count by leaf columns: top-level group headers would make cells grouped,
    // misaligned with the renderer's leaf indices. The leaf order must share the renderer's source
    // (flattenLeafColumns' DFS pre-order) — the historical hand-written BFS emitted first-level
    // leaves before deeper ones, misaligning cells[i] with the actual draw order under grouped columns.
    columns: computed(() => flattenLeafColumns(effectiveColumns.value).filter(
      c => !(c as unknown as { selection?: unknown }).selection,
    )),
    snapshot: sparseSnapshotSource,
  })

  const rowViewModelMap = computed<Map<string, readonly CellState[]>>(buildRowViewModelMap(tableRowViewModels))

  return { tableRowViewModels, rowViewModelMap }
}
