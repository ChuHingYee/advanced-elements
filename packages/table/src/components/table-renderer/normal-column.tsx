/**
 * @component NormalColumn
 * @displayName 普通列
 * @displayName Normal Column
 * @description <zh/> default 模式普通列组件（ElTableColumn 封装 + 悬停/编辑装配） | <en/> Default-mode normal column component (ElTableColumn wrapper plus hover/edit assembly)
 * @category 数据展示 | Data Display
 */
import type { PropType } from 'vue'
import type { ProcessedColumn as LocalColumn } from '../../types'
import type { Translator } from '../../types/translator'
import { ElTableColumn } from 'element-plus'
import { computed, defineComponent, h } from 'vue'
import { useSafeInject } from '../../composables/shared/use-safe-inject'
import { advTableHoverLayerKey } from '../../types/config'
import { findColumnByKey } from '../../utils/column-tree'
import { getColumnKey, isGroupColumn, resolveCellClassRules } from '../../utils/shared'
import { resolveCellValue } from '../../utils/value-pipeline'
import { resolveStretchLowerBound, shouldShowInlineHover } from '../renderer-core/column-build-shared'
import { createColumnVNodeFactory } from '../renderer-core/column-vnode-factory'
import { COLLAPSED_ARROW_PATH, EXPANDED_ARROW_PATH, extractColumnRenderProps, injectRendererContext, renderHeaderDragMarker, renderHeaderSlot } from '../renderer-core/render-helpers'
import { renderDetailRowContent } from '../shared/cell-render-pipeline'
import { renderRowExpandIcon as renderExpandIconShared, renderGroupHeaderCell, renderTreeCellPrefix as renderTreeCellPrefixShared } from '../shared/column-renderer'

export const NormalColumn = defineComponent({
  name: 'AdvNormalColumn',
  props: {
    col: { type: Object as PropType<LocalColumn>, required: true },
    colIndex: { type: Number, required: true },
    displayNormalColumns: { type: Array as PropType<LocalColumn[]>, required: true },
    hasHoverOptionColumns: { type: Boolean, required: true },
    slots: { type: Object as PropType<Record<string, any>>, required: true },
    t: { type: Function as PropType<() => Translator | undefined>, required: true },
    rowKey: { type: Function as PropType<(row: any) => string>, required: true },
    /** <zh/> 原始列（未过滤），用于 canCollapse 检查 | <en/> Original (unfiltered) columns for canCollapse check */
    originalColumns: { type: Array as PropType<LocalColumn[]>, default: () => [] },
    /** <zh/> 检查列是否可折叠 | <en/> Check if a column can be collapsed */
    canCollapse: { type: Function as PropType<(col: LocalColumn) => boolean>, default: () => false },
    /** <zh/> 检查列是否已折叠 | <en/> Check if a column is collapsed */
    isCollapsed: { type: Function as PropType<(key: string) => boolean>, default: () => false },
    /** <zh/> 切换列分组折叠 | <en/> Toggle column group collapse */
    onToggleColumnGroupCollapse: { type: Function as PropType<(key: string) => void>, default: undefined },
    autoSizeColumns: { type: Boolean, default: false },
    floatingFilter: { type: Boolean, default: false },
    editConfig: { type: Object as PropType<Record<string, any>>, default: undefined },
  },
  setup(props) {
    const {
      tableContext,
      editApi,
      filterSortApi,
      treeApi,
      rowGroupApi,
      rowExpandApi,
      sharedHeaderTooltip,
      rowViewModelContext,
    } = injectRendererContext()

    // NormalColumn 是 table-renderer 的真实子组件，注入由渲染器 provide 的
    // advTableHoverLayerKey 是合法的（inject 读取父级 provides）。
    // NormalColumn is a real child of table-renderer, so injecting the
    // renderer-provided advTableHoverLayerKey is legitimate (inject reads parent provides).
    const hoverApi = useSafeInject(advTableHoverLayerKey, 'NormalColumn')

    /**
     * <zh/> 首个普通列索引——树形/展开前缀只落在此列（与 virtual 侧 `firstNormalColIndex` 同口径）。
     * <zh/> displayNormalColumns 正常不含 selection 列（恒为 0），此处按 virtual 同款谓词防御式查找，
     * <zh/> selection 混入时仍定位到首个数据列；全 selection 的退化情形返回 undefined（双端都不落前缀）。
     * <en/> First normal-column index — tree/expand prefixes land only here (same caliber as the
     * <en/> virtual side's `firstNormalColIndex`). displayNormalColumns normally excludes selection
     * <en/> (always 0); resolved defensively with the virtual side's predicate so a mixed-in selection
     * <en/> column still resolves to the first data column, and the all-selection degenerate case
     * <en/> yields undefined (no prefix on either side).
     */
    const firstNormalColIndex = computed(() => {
      const idx = props.displayNormalColumns.findIndex(col => !col.selection)
      return idx >= 0 ? idx : undefined
    })

    /**
     * <zh/> 列 VNode 工厂——单元格/表头内容管线统一由此产出；
     * <zh/> 本组件退化为布局插件：ElTableColumn 插槽装配 + 宽度拉伸策略 + 分组递归。
     * <en/> Column VNode factory — cell/header content pipelines come from here;
     * <en/> this component degrades to a layout plugin: ElTableColumn slot assembly,
     * <en/> width stretch policy and group recursion.
     */
    const factory = createColumnVNodeFactory(
      {
        tableContext,
        editApi,
        filterSortApi,
        treeApi,
        rowGroupApi,
        rowExpandApi,
        sharedHeaderTooltip,
        rowViewModelContext,
      },
      {
        getEditConfig: () => props.editConfig,
        resolveHoverTeleport: () => hoverApi?.shouldUseTeleport?.value ?? hoverApi?.hoverOptionTeleport?.value ?? false,
        resolveHoverColumns: () => hoverApi?.hoverOptionColumns?.value ?? [],
        // <zh/> default 模式编辑态同样保留展开图标——图标并入自身 resolveTreePrefix，
        // <zh/> 故关闭工厂的尾部自动附加以避免双图标。
        // <en/> default mode keeps the expand icon in edit state too — the icon folds into its own
        // <en/> resolveTreePrefix, so the factory's tail auto-append is disabled to avoid doubles.
        autoExpandIcon: false,
        resolveTreePrefix: ({ row, rowKeyStr, isFirstNormalTarget }) => {
          // <zh/> 非首普通列直接空数组——树形缩进/展开图标只属于首个数据列（与 virtual 同口径）。
          // <zh/> 此前缺此门控：tree/expand 开启时每一列都塞占位图标，每格内容被顶右约一个图标宽，
          // <zh/> 与 virtual（仅首列）左右 padding 失齐。
          // <en/> Non-first normal columns get an empty array — tree indents/expand icons belong
          // <en/> only to the first data column (same caliber as virtual). Without this gate every
          // <en/> column received a placeholder icon while tree/expand was on, pushing each cell's
          // <en/> content right by about an icon width and desyncing horizontal padding from virtual
          // <en/> (first column only).
          if (!isFirstNormalTarget)
            return []
          const nodes: any[] = []
          if (rowExpandApi?.expandEnabled.value && !treeApi?.treeEnabled.value) {
            nodes.push(renderRowExpandIconLike(rowKeyStr))
          }
          if (treeApi?.treeEnabled.value) {
            const meta = treeApi.getTreeMeta(row)
            if (meta)
              nodes.push(...renderTreeCellPrefixLike(meta, rowKeyStr))
          }
          return nodes
        },
        renderDetailFirstCol: rowData => renderDetailRowContent({
          rowData,
          slots: props.slots,
          t: props.t,
          className: 'adv-table__expand-row',
        }),
        renderSyntheticEmptyCol: () => null,
        renderGroupFirstCol: rowData => renderGroupHeaderCell(rowData, rowGroupApi!, props.slots, undefined, tableContext?.namespace?.value ?? 'el'),
      },
    )

    /** <zh/> 展开图标渲染——转发至共享实现 | <en/> Expand icon render — forwards to the shared impl */
    function renderRowExpandIconLike(rowKeyStr: string): any {
      const isExpanded = rowExpandApi!.expandedRowKeys.value.has(rowKeyStr)
      return renderExpandIconShared(rowKeyStr, isExpanded, rowExpandApi!, undefined, tableContext?.namespace?.value ?? 'el')
    }

    function renderTreeCellPrefixLike(meta: any, rowKeyStr: string): any[] {
      return renderTreeCellPrefixShared(meta, rowKeyStr, (k) => {
        void treeApi!.toggleRowExpand(String(k))
      }, undefined, tableContext?.namespace?.value ?? 'el')
    }

    return () => {
      const { col, colIndex, ...rest } = props
      const key = getColumnKey(col)
      if (isGroupColumn(col) && col.children) {
        const originalCol = findColumnByKey(rest.originalColumns, key) ?? col
        const collapsible = rest.canCollapse?.(originalCol) ?? false
        const collapsed = rest.isCollapsed?.(key) ?? false

        const allChildren = col.children as LocalColumn[]
        const filteredChildren = allChildren.filter((child) => {
          const gs = child.columnGroupShow
          if (gs === null || gs === undefined)
            return true
          if (collapsed)
            return gs === 'closed'
          return gs === 'open'
        })

        const groupProps: Record<string, any> = {
          label: col.label ?? '',
        }
        if (col.align)
          groupProps.align = col.align
        if (col.headerAlign)
          groupProps.headerAlign = col.headerAlign
        if (col.className)
          groupProps.className = col.className

        const displayCols = rest.displayNormalColumns

        const mergedSlots = collapsible
          ? {
              ...rest.slots,
              [`${key}-header`]: () => h('span', { class: 'adv-table-column-group-header' }, [
                h('span', { class: 'adv-table-column-group-header__text' }, col.label ?? ''),
                h('span', {
                  class: ['adv-table-column-group-header__toggle', collapsed ? 'adv-table-column-group-header__toggle--collapsed' : 'adv-table-column-group-header__toggle--expanded'],
                  // <zh/> default 模式表头文字默认可选：mousedown 不阻止原生选句，点击折叠按钮会选中相邻列文字
                  // <en/> Default-mode header text is selectable by default: without mousedown prevention, clicking the toggle selects adjacent column text
                  onMousedown: (e: Event) => e.preventDefault(),
                  onClick: (e: Event) => {
                    e.stopPropagation()
                    props.onToggleColumnGroupCollapse?.(key)
                  },
                }, [
                  h('svg', {
                    viewBox: '0 0 24 24',
                    width: 16,
                    height: 16,
                    fill: 'currentColor',
                  }, [
                    h('path', {
                      d: collapsed ? COLLAPSED_ARROW_PATH : EXPANDED_ARROW_PATH,
                    }),
                  ]),
                ]),
              ]),
            }
          : rest.slots

        const headerContent = factory.buildHeaderContent({
          col,
          key,
          colIndex,
          columns: displayCols,
          slots: mergedSlots,
          skipActions: true,
          wrap: (_k, c) => c,
        })

        // 以 collapsed 作为组列 key：EP 内部 `TableColumnRenderer` 用“无 props/无 children”的子 vnode
        // 渲染 default 插槽，组列重渲染不会让它更新，子列的挂载/卸载永不发生，折叠态下子列不切换；
        // 改 key 强制折叠翻转时重挂载，使 EP 重新 insertColumn/removeColumn。
        // Key the group column by `collapsed`: EP's internal `TableColumnRenderer` renders the default
        // slot as a child vnode with no props/children, so re-rendering the group never updates it and
        // child columns are never mounted/unmounted. A changing key forces a remount so EP re-registers them.
        return (
          <ElTableColumn
            key={`${key}:${collapsed ? 'closed' : 'open'}`}
            {...groupProps}
          >
            {{
              header: () => renderHeaderDragMarker(key, headerContent),
              default: () => filteredChildren.map((child) => {
                const childKey = getColumnKey(child)
                const globalIndex = displayCols.findIndex(c => getColumnKey(c) === childKey)
                return [
                  <NormalColumn
                    key={childKey}
                    col={child}
                    colIndex={globalIndex >= 0 ? globalIndex : colIndex}
                    {...rest}
                  />,
                ]
              }),
            }}
          </ElTableColumn>
        )
      }

      const colProps = extractColumnRenderProps(col)

      if (rest.autoSizeColumns) {
        const isStretchDisabled = col.stretch === false
        const hasWidth = 'width' in col

        if (isStretchDisabled) {
          // stretch: false → 固定宽度，不参与拉伸分配
          // stretch: false → fixed width, does not participate in stretch distribution
          if (hasWidth) {
            colProps.width = col.width
          }
        }
        else {
          // 参与拉伸：设 minWidth 为下限，清除 width 让 ElTable 等比分配
          // Participate in stretching: set minWidth as lower bound, clear width to let ElTable distribute proportionally
          // <zh/> 下限口径与 virtual 侧同源（resolveStretchLowerBound），修一处即两端同步
          // <en/> The lower-bound rule is shared with the virtual side (resolveStretchLowerBound); one fix covers both
          const lowerBound = resolveStretchLowerBound(col)
          if (lowerBound !== undefined)
            colProps.minWidth = lowerBound
          colProps.width = undefined
        }
      }

      if (col.cellClassRules) {
        type ElColumnClassName = string | ((params: { row: unknown, rowIndex: number, column: unknown }) => string)
        const staticClassName = (colProps as { className?: ElColumnClassName }).className
          ; (colProps as { className?: ElColumnClassName }).className = ({ row, rowIndex }: { row: unknown, rowIndex: number }) => {
          const base = typeof staticClassName === 'function'
            ? staticClassName({ row, rowIndex, column: col })
            : (staticClassName || '')
          // <zh/> 经值管线取值——与排序/筛选/导出同源，条件规则可基于 valueGetter 派生值
          // <en/> Resolve via the value pipeline — same source as sort/filter/export,
          // <en/> so class rules can key off valueGetter-derived values
          const cellData = resolveCellValue(row, col, rowIndex)
          const rulesResult = resolveCellClassRules(col.cellClassRules, {
            row,
            cellData,
            column: col,
            rowIndex,
            columnIndex: colIndex,
          })
          return [base, rulesResult].filter(Boolean).join(' ')
        }
      }

      const showInlineHover = shouldShowInlineHover(colIndex, rest.displayNormalColumns.length, rest.hasHoverOptionColumns)

      return (
        <ElTableColumn {...colProps} class={showInlineHover ? 'adv-table__hover-cell' : undefined}>
          {{
            header: () => {
              if (rest.slots[`${key}-header`]) {
                return renderHeaderDragMarker(key, renderHeaderSlot(col, rest.slots, colIndex))
              }

              return factory.buildHeaderContent({
                col,
                key,
                colIndex,
                columns: rest.displayNormalColumns,
                slots: rest.slots,
                floatingFilter: rest.floatingFilter,
                wrap: (k, c, ariaSort) => renderHeaderDragMarker(k, c, ariaSort),
              })
            },
            default: ({
              row,
              $index,
            }: {
              row: Record<string, any>
              $index: number
            }) => {
              const showInlineHover = shouldShowInlineHover(colIndex, rest.displayNormalColumns.length, rest.hasHoverOptionColumns)

              return factory.renderCell({
                col,
                key,
                colIndex,
                spanColIndex: colIndex,
                columns: rest.displayNormalColumns,
                row,
                rowIndex: $index,
                showInlineHover,
                syntheticFirstColIndex: 0,
                firstNormalColIndex: firstNormalColIndex.value,
                slots: rest.slots,
                t: rest.t(),
                rowKeyFn: rest.rowKey,
              })
            },
          }}
        </ElTableColumn>
      )
    }
  },
})
