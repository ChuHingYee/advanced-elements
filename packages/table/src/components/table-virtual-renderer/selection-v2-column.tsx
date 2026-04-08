/**
 * @component SelectionV2Column
 * @displayName 虚拟选择列
 * @displayName Selection V2 Column
 * @description <zh/> virtual 模式选择列配置工厂（含 append 合成行守卫） | <en/> Virtual-mode selection column config factory (with append synthetic-row guard)
 * @category 数据展示 | Data Display
 */
import type { MaybeRefOrGetter } from 'vue'
import type { CheckStatus, UseSelectionStateReturn } from '../../composables/selection/use-selection-state'
import type { TreeApi } from '../../types/config'
import { computed, inject, toValue } from 'vue'
import { advTableKey, advTableRowGroupKey, advTableToggleAllSelectionKey } from '../../types/injection-keys'
import { getColumnKey } from '../../utils/shared'
import { isTotalRow } from '../../utils/synthetic-row'
import { ADV_TABLE_COLUMN_KEY_ATTR, ADV_TABLE_ROW_KEY_ATTR } from '../../utils/table-drag'
import {
  renderSelectionCellContent,
  renderSelectionHeaderContent,
} from '../shared/selection-renderer'
import { isAppendRowData } from './append-row-helpers'

/**
 * <zh/> selection 格的 data-adv-cell-col 域外标记——与 default 模式（-1）对齐，
 *  使范围选择的矩形列域在两模式下同构（selection 格不属于普通列索引域）。
 * <en/> Out-of-domain marker for the selection cell's data-adv-cell-col — aligned with
 *  default mode (-1) so the range-selection rect column domain is isomorphic across modes.
 */
const SELECTION_CELL_COL = -1

export interface SelectionV2ColumnProps<T> {
  /** <zh/> 选择列原始配置，非空时才产出 selection 列，并用于派生列键 | <en/> Raw selection column configs; the selection column is emitted only when non-empty, also used to derive the column key */
  selectionColumns: any[]
  /**
   * <zh/> 选择列宽度（像素）
   * <en/> Selection column width (pixels)
   * @default 50
   */
  selectionWidth?: number
  /**
   * <zh/> 选择模式：'single' 单选、'multiple' 多选
   * <en/> Selection mode: 'single' or 'multiple'
   * @default 'multiple'
   */
  selectionMode?: MaybeRefOrGetter<'single' | 'multiple'>
  /** <zh/> 表格数据（可为 ref / getter），用于表头全选计数 | <en/> Table data (ref / getter allowed), used for the header select-all count */
  data: MaybeRefOrGetter<T[]>
  /** <zh/> 当前勾选状态（全选/半选/未选），用于表头复选框渲染 | <en/> Current check status (all/indeterminate/none), for header checkbox rendering */
  checkStatus: MaybeRefOrGetter<CheckStatus>
  /** <zh/> 选择状态 composable 实例，用于读取与切换行选中 | <en/> Selection state composable instance, for reading and toggling row selection */
  selectionState?: UseSelectionStateReturn<T>
  /** <zh/> 判断行是否可选的函数 | <en/> Function determining whether a row is selectable */
  selectableFn?: (row: any, index: number) => boolean
  /** <zh/> 行 key 函数 | <en/> Row key function */
  rowKeyFn: MaybeRefOrGetter<(row: T) => string>
  /** <zh/> 树形 API — 用于半选态计算 | <en/> Tree API — used for indeterminate state calculation */
  treeApi?: TreeApi
}

/**
 * <zh/> 创建 selection V2 列配置
 * <en/> Create selection V2 column configuration
 */
export function useSelectionV2Column<T>(options: SelectionV2ColumnProps<T>) {
  const {
    selectionColumns,
    selectionWidth,
    selectionMode,
    data,
    checkStatus,
    selectionState,
    selectableFn,
    rowKeyFn,
    treeApi,
  } = options

  // <zh/> 按域注入（上帝上下文已删除）| <en/> per-domain injection (god context removed)
  const rowGroupApi = inject(advTableRowGroupKey, undefined)
  const toggleAllSelection = inject(advTableToggleAllSelectionKey, undefined)
  // 行键元信息（后代可选性判定解析行对象用）
  const tableContext = inject(advTableKey, undefined)

  const cellRenderer = ({ rowData, rowIndex }: { rowData: T, rowIndex: number }) => {
    const currentSelectionMode = toValue(selectionMode) ?? 'multiple'

    /**
     * <zh/> Append 合成行不渲染 checkbox——它仅作为 append 插槽的承载容器存在，
     * 不参与用户数据的选中、计数、键映射。但仍输出与普通行一致的 cell 容器及 row-key 标记，
     * 以确保 #row 插槽的 cells 索引布局与 SpanRow 的合并目标定位一致。
     * <zh/> 关键：必须在调用 rowKeyFn 之前判断，否则 rowKey='id' 在合成行上找不到字段会触发 dev 警告。
     * <en/> Append synthetic row does not render checkbox — it only exists as a carrier container for the append slot,
     * does not participate in user data selection, counting, or key mapping. Still outputs the same cell container
     * and row-key marker as normal rows to ensure #row slot's cells index layout is consistent with SpanRow's merge target positioning.
     * <en/> Critical: must check before calling rowKeyFn, otherwise rowKey='id' will trigger a dev warning when the field is missing on the synthetic row.
     */
    if (isAppendRowData(rowData)) {
      return (
        <span
          class="adv-table__cell adv-table__drag-row-marker adv-table__cell--append-row"
          {...{ [ADV_TABLE_ROW_KEY_ATTR]: 'append-row' }}
          data-adv-cell-row={rowIndex}
          data-adv-cell-col={SELECTION_CELL_COL}
        />
      )
    }

    const currentRowKeyFn = toValue(rowKeyFn)
    const rowKeyValue = currentRowKeyFn(rowData)

    if (rowGroupApi?.groupEnabled.value && rowGroupApi.isGroupHeaderRow(rowData)) {
      return (
        <span
          class="adv-table__cell adv-table__drag-row-marker"
          {...{ [ADV_TABLE_ROW_KEY_ATTR]: rowKeyValue }}
          data-adv-cell-row={rowIndex}
          data-adv-cell-col={SELECTION_CELL_COL}
        />
      )
    }

    /**
     * <zh/> 合计行（Grand/Group）不渲染 checkbox——与 default 模式 SelectionColumn 对称，合计行不可选中（AG Grid 对齐）
     * <en/> Total rows (grand/group) render no checkbox — symmetric with default-mode SelectionColumn; totals are not selectable (AG Grid parity)
     */
    if (isTotalRow(rowData)) {
      return (
        <span
          class="adv-table__cell adv-table__drag-row-marker"
          {...{ [ADV_TABLE_ROW_KEY_ATTR]: rowKeyValue }}
          data-adv-cell-row={rowIndex}
          data-adv-cell-col={SELECTION_CELL_COL}
        />
      )
    }

    return (
      <span class="adv-table__cell adv-table__drag-row-marker" {...{ [ADV_TABLE_ROW_KEY_ATTR]: rowKeyValue }} data-adv-cell-row={rowIndex} data-adv-cell-col={SELECTION_CELL_COL}>
        {renderSelectionCellContent({
          row: rowData,
          rowIndex,
          selectionState,
          selectionMode: currentSelectionMode,
          rowKey: currentRowKeyFn,
          selectableFn,
          treeApi,
          rowKeyMeta: (tableContext as unknown as { rowKeyMeta?: { value?: { keyToRow: Map<string, any>, keyToIndex: Map<string, number> } } } | undefined)?.rowKeyMeta?.value,
        })}
      </span>
    )
  }

  const selectionV2Column = computed(() => {
    const currentSelectionMode = toValue(selectionMode) ?? 'multiple'
    const columnKey = getColumnKey(selectionColumns[0] ?? { key: 'selection' }) || 'selection'

    return {
      key: 'selection',
      dataKey: 'selection',
      width: selectionWidth ?? 50,
      flexShrink: 0,
      align: 'center' as const,
      headerCellRenderer: () => {
        const content = renderSelectionHeaderContent({
          selectionMode: currentSelectionMode,
          checkStatus: toValue(checkStatus),
          visibleCount: toValue(data).length,
          // <zh/> 安全调用——上下文缺失时（useSafeInject 已 devWarn）点击为空操作，不再抛 TypeError
          // <en/> Safe call — when the context is missing (useSafeInject already devWarns) the click
          // <en/> is a no-op instead of throwing a TypeError
          toggleAllSelection: () => toggleAllSelection?.(),
        })
        return (
          <span class="adv-table__header-cell adv-table__v2-header-cell" {...{ [ADV_TABLE_COLUMN_KEY_ATTR]: columnKey }}>
            {content}
          </span>
        )
      },
      cellRenderer,
    }
  })

  const selectionV2Columns = computed(() =>
    selectionColumns.length > 0 ? [selectionV2Column.value] : [],
  )

  return { selectionV2Columns }
}
