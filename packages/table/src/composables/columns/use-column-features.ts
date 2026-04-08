/**
 * <zh/> 列特性子编排器 — 列分类、列状态、列分组、筛选面板
 *
 * <en/> Column features sub-orchestrator — column categorization, column state, column group, filter panel.
 *
 * @remarks
 * <zh/> 从 useAdvTableDataColumns 拆分，收敛"依赖列编排 + 数据管线"的下游列元数据管理：
 * <zh/>   - useColumnCategorization（列分类，依赖 columnClassification）
 * <zh/>   - useColumnState（列状态持久化，依赖 sortState）
 * <zh/>   - useFilterPanel（筛选面板，依赖 filterState）
 * <zh/>   - useColumnGroup（列分组，依赖 localColumns）
 *
 * <en/> Extracted from useAdvTableDataColumns, consolidating downstream column-metadata management
 * <en/> that depends on both column orchestration and the data pipeline (see above).
 */
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { ColumnStatePersistence } from '../../types/column-state'
import type { ColumnConfig, ColumnGroupApi, FilterConfig, FilterPanelApi } from '../../types/config'
import type { ColumnFilterValue } from '../../types/filter'
import type { SortState } from '../../types/sort'
import type { ColumnClassification } from '../data/use-table-data-pipeline'
import type { UseColumnStateReturn } from './use-column-state'
import { computed } from 'vue'
import { useFilterPanel } from '../features/use-filter-panel'
import { useColumnCategorization } from './use-column-categorization'
import { useColumnGroup } from './use-column-group'
import { useColumnState } from './use-column-state'

export interface UseColumnFeaturesOptions {
  // ── 列编排输入 | Column orchestration inputs ──
  localColumns: ShallowRef<ProcessedColumn[]>
  resetColumns: () => void
  setColumns: (cols: ProcessedColumn[]) => void
  touchColumns: () => void

  // ── 数据管线输入 | Data pipeline inputs ──
  columnClassification: ComputedRef<ColumnClassification>
  sortState: Ref<SortState[]>
  filterState: Ref<Record<string, ColumnFilterValue>>
  setSorts: (sorts: SortState[]) => void
  resetAllFilters: () => void

  // ── Props 透传 | Props passthrough ──
  filterConfig: () => FilterConfig | undefined
  columnState: () => ColumnStatePersistence | undefined
  mode: () => 'default' | 'virtual'

  // ── Core 透传 | Core passthrough ──
  mergedColumnConfig: ComputedRef<ColumnConfig<any>>
  /**
   * <zh/> 表格唯一标识 getter——透传给 useColumnState 推导持久化 storageKey；
   * <zh/> getter 形态使运行时 tableId 变更能反映到 storageKey（与 mode 的透传约定一致）
   * <en/> Unique table ID getter — forwarded to useColumnState to derive the persistence storageKey;
   * <en/> the getter form lets runtime tableId changes reach storageKey (consistent with `mode` passthrough)
   */
  tableId: () => string

  /**
   * <zh/> 重置列宽拖拽缓存的回调——传递给 useColumnState.onResetColumnWidths
   * <zh/> applyColumnState 恢复列宽前调用，清空 useColumnResize.columnWidths 中的陈旧拖拽值
   * <en/> Callback to reset column resize drag cache — passed to useColumnState.onResetColumnWidths
   * <en> Called before applying column widths in applyColumnState, clearing stale drag widths from useColumnResize.columnWidths
   */
  onResetColumnWidths?: () => void
}

export interface UseColumnFeaturesReturn {
  // ── 列分类 | Column categorization ──
  hoverOptionColumns: ComputedRef<ProcessedColumn[]>
  hasHoverOptionColumns: ComputedRef<boolean>
  hoverOptionTeleport: ComputedRef<boolean>
  displayNormalColumns: ComputedRef<ProcessedColumn[]>
  selectionColumnSyncKey: ComputedRef<string>
  columnKeepAlive: ComputedRef<boolean>

  // ── 列状态/分组/筛选面板 | Column state/group/filter panel ──
  getColumnState: UseColumnStateReturn['getColumnState']
  applyColumnState: UseColumnStateReturn['applyColumnState']
  resetColumnState: UseColumnStateReturn['resetColumnState']
  columnGroupApi: ColumnGroupApi
  filterPanelApi: FilterPanelApi
}

/**
 * <zh/> 创建列特性子编排器
 *
 * <en/> Create the column features sub-orchestrator.
 */
export function useColumnFeatures(options: UseColumnFeaturesOptions): UseColumnFeaturesReturn {
  const {
    localColumns,
    resetColumns,
    setColumns,
    touchColumns,
    columnClassification,
    sortState,
    filterState,
    setSorts,
    resetAllFilters,
    filterConfig,
    columnState,
    mode,
    mergedColumnConfig,
    tableId,
    onResetColumnWidths,
  } = options

  // ── 列分类（依赖列编排）| Column categorization (needs column orchestration) ──
  const {
    hoverOptionColumns,
    hasHoverOptionColumns,
    hoverOptionTeleport,
    displayNormalColumns,
    selectionColumnSyncKey,
    keepAlive: columnKeepAlive,
  } = useColumnCategorization({
    selectionColumns: computed(() => columnClassification.value.selection),
    hoverOptionColumns: computed(() => columnClassification.value.hoverOptionColumns),
    displayNormalColumns: computed(() => columnClassification.value.displayNormalColumns),
    hasTeleport: computed(() => columnClassification.value.hasTeleport),
    hasFixed: computed(() => columnClassification.value.hasFixed),
    allKeepAlive: computed(() => columnClassification.value.allKeepAlive),
  })

  // ── 列状态/分组/筛选面板（依赖数据管线）| Column state/group/filter panel (needs data pipeline) ──
  const { getColumnState, applyColumnState, resetColumnState } = useColumnState({
    localColumns,
    sortState,
    resetColumns,
    setColumns,
    touchColumns,
    setSorts,
    persistence: computed(() => columnState()),
    tableId,
    mode,
    onResetColumnWidths,
  })

  const filterPanelApi = useFilterPanel({
    filterConfig,
    filterState,
    resetAllFilters,
  })

  const columnGroupApi = useColumnGroup({
    mergedColumnConfig,
    localColumns,
    setColumns,
  })

  return {
    hoverOptionColumns,
    hasHoverOptionColumns,
    hoverOptionTeleport,
    displayNormalColumns,
    selectionColumnSyncKey,
    columnKeepAlive,
    getColumnState,
    applyColumnState,
    resetColumnState,
    columnGroupApi,
    filterPanelApi,
  }
}
