import type { ComputedRef, ShallowRef } from 'vue'
import type { AdvTableEmitFn } from '../../types'
import type { RowConfig, TreeApi } from '../../types/config'
import type { RendererContext, RowContext } from '../../types/orchestrator-context'
import { computed, shallowRef } from 'vue'
import { createTableEmitter } from '../../utils/table-emitter'
import { useTableSelection } from '../selection/use-table-selection'

/** <zh/> 行选择编排器输入 | <en/> Selection orchestrator input */
export interface UseSelectionOrchestratorOptions<T> extends RowContext<T>, RendererContext {
  selectableFn: ComputedRef<((row: T, index: number) => boolean) | undefined>
  mergedRowConfig: ComputedRef<RowConfig<T>>
  selectedRowKeys: () => any
  visibleData: () => T[]
  finalDisplayData: () => T[]
  treeApi: TreeApi
  emit: AdvTableEmitFn
}

/**
 * <zh/> 行选择编排——统一管理单选/多选/全选/跨页选择。
 *
 * <zh/> 事件契约：`selectionChange` / `select` / `selectAll` / `rowSelected` 四个事件签名对称——
 * <zh/> 末位参数恒为 `tableId`，便于多表场景区分事件来源。新增选择类事件须遵循此契约。
 *
 * <en/> Selection orchestration — unified management of
 * <en/> single/multi/all/cross-page selection.
 *
 * <en/> Event contract: `selectionChange` / `select` / `selectAll` / `rowSelected` are symmetric —
 * <en/> the trailing `tableId` arg disambiguates event source in multi-table scenarios. New selection events must follow this contract.
 */
export type UseSelectionOrchestratorReturn = ReturnType<typeof useSelectionOrchestrator<any>>

/**
 * <zh/> 行选择编排器——委托 useTableSelection 并统一接线选择事件、行键与当前行状态（事件契约见上方 {@linkcode UseSelectionOrchestratorReturn} 文档）。
 * <en/> Row selection orchestrator — delegates to useTableSelection and wires selection events, row keys
 * <en/> and current-row state (see the event contract on {@linkcode UseSelectionOrchestratorReturn} above).
 *
 * @param options - <zh/> 行/渲染器上下文与选择相关配置 | <en/> Row/renderer context and selection config
 * @returns <zh/> 选择状态、全选/反选批量操作与当前行 API | <en/> Selection state, batch select/invert operations and current-row APIs
 */
export function useSelectionOrchestrator<T>(options: UseSelectionOrchestratorOptions<T>) {
  const {
    rowKeyFn,
    tableData,
    rowKeyMeta,
    selectableFn,
    mergedRowConfig,
    selectedRowKeys,
    visibleData,
    finalDisplayData,
    caps,
    treeApi,
    tableId,
    // <zh/> activeRenderer 不再需要——currentRow 三源合一后编排器直接读写共享 ref
    // <en/> activeRenderer no longer needed — after three-sources-unified the orchestrator reads/writes the shared ref directly
    emit,
  } = options

  const tableEmit = createTableEmitter(emit, tableId)

  const {
    selectionState,
    checkStatus,
    refreshSelection,
    toggleAllSelection,
    selectAll,
    selectAllFiltered,
    deselectAllFiltered,
    selectAllOnCurrentPage,
    deselectAllOnCurrentPage,
    getSelectedIndices,
    getCurrentPageData,
  } = useTableSelection<T>({
    rowKey: rowKeyFn,
    allData: tableData,
    rowKeyMeta,
    selectableFn,
    selectionMode: computed(() => mergedRowConfig.value.rowSelection ?? 'multiple'),
    rowMultiSelectWithClick: computed(() => mergedRowConfig.value.rowMultiSelectWithClick ?? true),
    selectedRowKeys,
    visibleData,
    finalDisplayData,
    caps,
    treeApi: computed(() => treeApi),
    onSelectionChange: (rows, meta) => tableEmit('selectionChange', rows, meta),
    onSelect: payload => tableEmit('select', payload),
    onSelectAll: selection => tableEmit('selectAll', selection),
    onRowSelected: payload => tableEmit('rowSelected', payload),
    // <zh/> keepSelectionAcrossPages=true 时保留选中集，关闭 rowMap 剪除
    // <en/> keep selection across pages when keepSelectionAcrossPages=true, disabling rowMap pruning
    pruneOnRowMapChange: computed(() => !mergedRowConfig.value.keepSelectionAcrossPages),
  })
  /**
   * <zh/> 当前行唯一真源（三源合一）——本编排器持有该 ref 并经统一上下文 provide；
   * <zh/> 渲染器经 useSharedCurrentRow 注入取同一引用，故此处读写即为全局读写，
   * <zh/> 无需"渲染器挂载恢复/读时回写"等和解逻辑（已删除，watch 与分支一并移除）。
   * <en/> THE single source of truth for currentRow (three-sources-unified) — this orchestrator
   * <en/> owns the ref and provides it via the unified context; renderers obtain the same reference
   * <en/> through useSharedCurrentRow, so reads/writes here ARE global — the mount-restore and
   * <en/> read-writeback reconciliation logic has been removed along with its watch/branches.
   */
  const currentRowRef: ShallowRef<T | null> = shallowRef<T | null>(null)

  function setCurrentRow(row: T) {
    currentRowRef.value = row
  }

  function getCurrentRow(): T | null {
    return currentRowRef.value
  }

  /**
   * <zh/> 反选当前页可见行——逐行 toggle（selectionState 内部尊重 selectable 谓词与级联），
   * <zh/> 跨页保持语义不受影响。
   * <zh/> 事件批量：N 行切换的事件经 `batchSelectionUpdate` 合并为一次 `selectionChange`，
   * <zh/> 万级数据下避免 O(n²) 事件风暴（逐行派发 × 每次全量构造选中数组）。
   * <en/> Invert selection over the current page's visible rows — per-row toggle (selectionState
   * <en/> internally honors the selectable predicate and tree cascade); cross-page semantics intact.
   * <en/> Batched events: N row toggles collapse into one `selectionChange` via
   * <en/> `batchSelectionUpdate`, avoiding an O(n²) event storm on large data
   * <en/> (per-row dispatch × full selection-array rebuild each time).
   */
  function invertSelection() {
    selectionState.batchSelectionUpdate(() => {
      const rows = visibleData()
      for (const row of rows)
        selectionState.toggleRowSelection(row)
    })
  }

  return {
    selectionState,
    checkStatus,
    refreshSelection,
    toggleAllSelection,
    selectAll,
    selectAllFiltered,
    deselectAllFiltered,
    selectAllOnCurrentPage,
    deselectAllOnCurrentPage,
    getSelectedIndices,
    getCurrentPageData,
    invertSelection,
    currentRowRef,
    setCurrentRow,
    getCurrentRow,
  }
}
