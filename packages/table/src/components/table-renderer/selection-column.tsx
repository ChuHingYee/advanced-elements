/**
 * @component SelectionColumn
 * @displayName 选择列
 * @displayName Selection Column
 * @description <zh/> default 模式选择列组件（checkbox/radio + 表头全选） | <en/> Default-mode selection column component (checkbox/radio plus header select-all)
 * @category 数据展示 | Data Display
 */
import type { PropType } from 'vue'
import type { CheckStatus, UseSelectionStateReturn } from '../../composables/selection/use-selection-state'
import type { TreeApi } from '../../types/config'
import { ElTableColumn } from 'element-plus'
import { defineComponent, h, inject } from 'vue'
import { advTableKey, advTableRowExpandKey, advTableRowGroupKey, advTableSelectionKey, advTableToggleAllSelectionKey, advTableTreeKey } from '../../types/injection-keys'
import { getColumnKey } from '../../utils/shared'
import { isTotalRow } from '../../utils/synthetic-row'
import { ADV_TABLE_ROW_KEY_ATTR } from '../../utils/table-drag'
import { renderHeaderDragMarker } from '../renderer-core/render-helpers'
import { renderSelectionCellContent, renderSelectionHeaderContent } from '../shared/selection-renderer'

/**
 * <zh/> Selection 列组件——渲染单选/多选的 checkbox/radio 列
 * <en/> Selection column component — renders single/multi select checkbox/radio column
 */
export const SelectionColumn = defineComponent({
  name: 'AdvSelectionColumn',
  props: {
    selectionColumns: { type: Array as PropType<any[]>, default: () => [] },
    visibleData: { type: Array as PropType<any[]>, default: () => [] },
    checkStatus: {
      type: Object as PropType<CheckStatus>,
      default: () => ({ isAllSelected: false, isIndeterminate: false }),
    },
    selectableFn: {
      type: Function as PropType<(row: any, index: number) => boolean>,
      default: undefined,
    },
    rowKey: { type: Function as PropType<(row: any) => string>, required: true },
    selectionMode: { type: String as PropType<'single' | 'multiple'>, default: 'multiple' },
  },
  setup(props) {
    // <zh/> 按域注入（上帝上下文已删除）| <en/> per-domain injection (god context removed)
    const selectionState = inject(advTableSelectionKey, undefined) as UseSelectionStateReturn | undefined
    const toggleAllSelection = inject(advTableToggleAllSelectionKey, undefined)
    const treeApi = inject(advTableTreeKey, undefined) as TreeApi | undefined
    // 行键元信息（后代可选性判定解析行对象用）
    const tableContext = inject(advTableKey, undefined)
    const rowGroupApi = inject(advTableRowGroupKey, undefined)
    const rowExpandApi = inject(advTableRowExpandKey, undefined)

    /** <zh/> 合并 cellSpan + renderRowDragMarker 为单层容器 | <en/> Merge cellSpan + renderRowDragMarker into a single-layer container */
    const defaultSlot = ({
      row,
      $index,
    }: {
      row: any
      $index: number
    }) => {
      /**
       * <zh/> 合成行（详情展开行 / 分组头行 / 合计行）提前返回，避免在调用 rowKeyFn 时
       * 因合成行缺少 rowKey 字段（如 'id'）触发 dev 警告；合计行不可选中（AG Grid 对齐）。
       * <en/> Early return for synthetic rows (detail expand row / group header row / total rows) to avoid
       * calling rowKeyFn on rows missing the rowKey field (e.g. 'id'), which would trigger a dev warning;
       * total rows are not selectable (AG Grid parity).
       */
      if (rowExpandApi?.expandEnabled.value && rowExpandApi.isDetailRow(row))
        return null

      if (rowGroupApi?.groupEnabled.value && rowGroupApi.isGroupHeaderRow(row))
        return null

      // <zh/> 合计行不可选中（与虚拟模式对称，见 selection-v2-column） | <en/> Total rows are not selectable (symmetric with virtual mode, see selection-v2-column)
      if (isTotalRow(row))
        return null

      return h('span', {
        'class': ['adv-table__cell', 'adv-table__drag-row-marker'],
        [ADV_TABLE_ROW_KEY_ATTR]: props.rowKey(row),
        'data-adv-cell-row': $index,
        'data-adv-cell-col': -1,
      }, renderSelectionCellContent({
        row,
        rowIndex: $index,
        selectionState,
        selectionMode: props.selectionMode!,
        rowKey: props.rowKey,
        selectableFn: props.selectableFn,
        treeApi,
        rowKeyMeta: tableContext?.rowKeyMeta?.value,
      }))
    }

    return () =>
      props.selectionColumns.map((selectionCol: any, index: number) => {
        const selectionKey = getColumnKey(selectionCol) || `selection-${index}`
        const isSingle = props.selectionMode === 'single'
        return (
          <ElTableColumn key={selectionKey} width={50} align="center">
            {{
              header: () => isSingle
                ? renderHeaderDragMarker(selectionKey, null)
                : renderHeaderDragMarker(
                    selectionKey,
                    renderSelectionHeaderContent({
                      selectionMode: props.selectionMode!,
                      checkStatus: props.checkStatus,
                      visibleCount: props.visibleData.length,
                      // <zh/> 安全调用——上下文缺失时（useSafeInject 已 devWarn）点击为空操作，不再抛 TypeError
                      // <en/> Safe call — when the context is missing (useSafeInject already devWarns) the click
                      // <en/> is a no-op instead of throwing a TypeError
                      toggleAllSelection: () => toggleAllSelection?.(),
                    }),
                  ),
              default: defaultSlot,
            }}
          </ElTableColumn>
        )
      })
  },
})
