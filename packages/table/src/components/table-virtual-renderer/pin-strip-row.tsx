/**
 * @component PinStripRow
 * @displayName 固定行条带
 * @displayName Pin Strip Row
 * @description <zh/> 固定行条带行 — 虚拟模式 pin-strip 单元格渲染（left/main/right 三分区） | <en/> Pinned strip row — virtual pin-strip cell rendering (left/main/right partitions)
 * @category 数据展示 | Data Display
 */
import type { PropType, VNodeArrayChildren } from 'vue'
/**
 * <zh/> 固定行条带行 — 虚拟模式 pin-strip 单元格渲染
 * <en/> Pinned strip row — virtual pin-strip cell rendering
 *
 * @remarks
 * <zh/> 直接调用列工厂 cellRenderer 闭包，复用 valueType/format/编辑态/dirty 全量逻辑，零复制。
 * <zh/> ****：按 fixed 分 left/main/right 三区（与 VirtualSummaryFooter / EP 固定列布局一致）——
 * <zh/> 左/右固定列不再随主区横向平移；仅 main 区跟随 scrollLeft 平移。
 * <zh/> cellRenderer 收到的 columnIndex 始终是**全列序全局索引**（渲染域），索引敏感 renderer 不受分区影响。
 * <zh/> 行事件转发至共享 rowEventHandlers，rowIndex=-1 标注渲染域外，越界守卫安全跳过。
 * <en/> Directly invokes column-factory cellRenderer closures, reusing all cell logic with zero duplication.
 * <en/> ****: partitions cells into left/main/right by `fixed` (mirroring VirtualSummaryFooter / EP
 * <en/> fixed-column layout) — left/right no longer translate with the main area; only main follows scrollLeft.
 * <en/> cellRenderer always receives the **global** columnIndex of the full column order (render domain).
 * <en/> Row events forward to shared handlers; rowIndex=-1 marks outside the render domain.
 */
import { defineComponent, h } from 'vue'
import { getColumnKey } from '../../utils/shared'
import { ADV_TABLE_ROW_KEY_ATTR } from '../../utils/table-drag'

/** <zh/> 条带单元格条目：列配置 + 全列序全局索引 | <en/> Strip cell entry: column config + global index in the full column order */
export interface PinStripCellEntry {
  column: any
  columnIndex: number
}

export const PinStripRow = defineComponent({
  name: 'AdvV2PinStripRow',
  props: {
    /** <zh/> 左固定区单元格（fixed: true / 'left'） | <en/> Left-fixed cells (`fixed: true` / `'left'`) */
    leftEntries: { type: Array as PropType<PinStripCellEntry[]>, required: false, default: () => [] },
    /** <zh/> 主区单元格（无 fixed） | <en/> Main-area cells (no `fixed`) */
    mainEntries: { type: Array as PropType<PinStripCellEntry[]>, required: false, default: () => [] },
    /** <zh/> 右固定区单元格（fixed: 'right'） | <en/> Right-fixed cells (`fixed: 'right'`) */
    rightEntries: { type: Array as PropType<PinStripCellEntry[]>, required: false, default: () => [] },
    /** <zh/> 主区横向平移样式（跟随 scrollLeft） | <en/> Main-area translate style (follows scrollLeft) */
    mainStyle: { type: Object as PropType<Record<string, string>>, required: false, default: undefined },
    row: { type: Object as PropType<object>, required: true },
    handlers: { type: Object as PropType<Record<string, (...args: any[]) => void>>, required: false, default: undefined as unknown as PropType<Record<string, (...args: any[]) => void> | undefined> },
    rowKeyValue: { type: String as PropType<string>, required: false, default: '' },
  },
  setup(stripProps) {
    const forward = (name: string) => (event: Event) => {
      const hdl = stripProps.handlers as Record<string, (p: unknown) => void> | undefined
      if (!hdl || typeof hdl[name] !== 'function')
        return
      hdl[name]({ rowData: stripProps.row, rowIndex: -1, event, rowKey: stripProps.rowKeyValue })
    }

    function renderCells(entries: PinStripCellEntry[]) {
      return entries.map(({ column, columnIndex }) =>
        h(
          'div',
          {
            key: String(getColumnKey(column as unknown as Parameters<typeof getColumnKey>[0]) ?? columnIndex),
            class: 'adv-table-v2__pin-strip__cell',
            style: { width: `${Number((column as { width?: unknown })?.width ?? 0)}px` },
          },
          [typeof column?.cellRenderer === 'function'
            ? (column.cellRenderer as (p: { rowData: unknown, columnIndex: number }) => unknown)({ rowData: stripProps.row, columnIndex })
            : null] as VNodeArrayChildren,
        ),
      )
    }

    function renderRegion(region: 'left' | 'main' | 'right', entries: PinStripCellEntry[], style?: Record<string, string>) {
      return h(
        'div',
        {
          key: region,
          class: [
            'adv-table-v2__pin-strip__region',
            `adv-table-v2__pin-strip__region--${region}`,
          ],
          style,
        },
        renderCells(entries),
      )
    }

    return () =>
      h(
        'div',
        {
          class: 'adv-table-v2__pin-strip__cells',
          [ADV_TABLE_ROW_KEY_ATTR]: stripProps.rowKeyValue,
          onClick: forward('onClick'),
          onDblclick: forward('onDblclick'),
          onContextmenu: forward('onContextmenu'),
        },
        [
          renderRegion('left', stripProps.leftEntries),
          renderRegion('main', stripProps.mainEntries, stripProps.mainStyle),
          renderRegion('right', stripProps.rightEntries),
        ],
      )
  },
})
