/**
 * @component ColumnRenderer
 * @displayName 列渲染器
 * @displayName Column Renderer
 * @description <zh/> 列头/单元格渲染函数集合（排序指示/筛选面板/展开图标装配） | <en/> Column header/cell render function set (sort indicator / filter panel / expand icon assembly)
 * @category 数据展示 | Data Display
 */
import type { VNode } from 'vue'
import type { ProcessedColumn as LocalColumn } from '../../types'
import type { RowExpandApi, RowGroupApi, TreeRowMeta } from '../../types/config'
import type { SortOrder } from '../../types/sort'
import { h } from 'vue'
import { createDefaultFilterValue, normalizeFilterConfig } from '../../composables/data/use-column-filter'
import { epIcon, epTableExpandIcon, epTableExpandIconExpanded, epTableExpandIconPlaceholder, epTableIndent } from '../../utils/ep-selectors'
import { getColumnKey } from '../../utils/shared'
import ColumnFilterPanel from '../filter-panel/column-filter-panel.vue'
import FloatingFilterCell from '../filter-panel/floating-filter-cell.vue'
import { renderErrorFallback } from '../renderer-core/render-error-fallback'
import { EP_ARROW_PATH, EP_LOADING_PATH, renderHeaderCell, renderHeaderSlot, renderSortIndicator } from '../renderer-core/render-helpers'

export interface SharedHeaderOptions {
  col: LocalColumn
  colIndex: number
  columns: LocalColumn[]
  slots: Record<string, any>
  getSortOrder?: (key: string) => SortOrder
  getSortIndex?: (key: string) => number
  toggleSort?: (prop: string, event?: MouseEvent) => void
  getFilterValue?: (key: string) => any
  setFilter?: (key: string, val: any) => void
  isColumnFiltered?: (key: string) => boolean
  getEnumOptions?: (key: string) => any[] | undefined
  filterT?: (key: string) => string
  onHeaderClick?: (params: { column: LocalColumn, columnIndex: number, event: Event }) => void
  onHeaderContextmenu?: (params: { column: LocalColumn, columnIndex: number, event: Event }) => void
  /**
   * <zh/> headerClick / headerContextmenu 事件 payload 中使用的列索引
   * <zh/> 未提供时回退到 colIndex。virtual 模式下传入统一索引域（含 selection 偏移），
   * <zh/> 与 default 模式基于 columnIndexMap 的索引语义一致
   * <en/> Column index used in headerClick / headerContextmenu event payloads
   * <en/> Falls back to colIndex if not provided. In virtual mode, passes the unified index domain
   * <en/> (including selection offset), consistent with default mode's columnIndexMap-based index
   */
  headerEventColumnIndex?: number
  /** <zh/> 跳过 sort/filter 渲染（分组表头等非叶子列使用） | <en/> Skip sort/filter rendering (for non-leaf columns like group headers) */
  skipActions?: boolean
  /** <zh/> 启用在列头中的内联浮动筛选 | <en/> Enable inline floating filter in column headers */
  floatingFilter?: boolean
  /** <zh/> 共享表头 tooltip 进入回调（替代 per-column ElTooltip） | <en/> Shared header tooltip enter callback (replaces per-column ElTooltip) */
  onHeaderEnter?: (el: HTMLElement, content: string) => void
  /** <zh/> 共享表头 tooltip 离开回调 | <en/> Shared header tooltip leave callback */
  onHeaderLeave?: () => void
}

/**
 * <zh/> 构建共享表头内容（不含外层容器），普通渲染器和虚拟渲染器共用。
 * <en/> Build shared header cell content (without outer container) for both renderers.
 */
export function buildSharedHeaderContent(options: SharedHeaderOptions) {
  const {
    col,
    colIndex,
    columns,
    slots,
    getSortOrder,
    getSortIndex,
    toggleSort,
    getFilterValue,
    setFilter,
    isColumnFiltered,
    getEnumOptions,
    filterT,
    onHeaderClick,
    onHeaderContextmenu,
    skipActions,
  } = options

  const key = getColumnKey(col)

  const slotContent = slots[`${key}-header`]
    ? renderHeaderSlot(col, slots, colIndex)
    : null
  const headerColIdx = options.headerEventColumnIndex ?? colIndex

  const headerContent = slotContent
    ?? renderHeaderCell(col, columns, colIndex) ?? col.prop ?? ''

  const sortOrder = !skipActions ? (getSortOrder?.(key) ?? null) : null
  const sortIndex = !skipActions ? (getSortIndex?.(key) ?? -1) : -1
  // 读写统一用 canonical key（useColumnSort 支持 prop/key 双别名解析）；
  //  key-only 列（无 prop + valueGetter）此前传 col.prop=undefined 导致无法排序。
  const sortIcon = !skipActions
    ? renderSortIndicator(col, sortOrder, (e?: MouseEvent) => toggleSort?.(key, e), sortIndex > 0 ? sortIndex : undefined, filterT)
    : null

  const colSuppressFFBtn = col.suppressFloatingFilterButton
  const filterIcon = !skipActions
    ? (() => {
        const filterConfig = (col.filter !== false && !col.selection && col.valueType !== 'option')
          ? normalizeFilterConfig(col.filter ?? true)
          : null
        return filterConfig
          ? h(ColumnFilterPanel, {
              columnKey: key,
              filterType: filterConfig.type,
              active: isColumnFiltered?.(key) ?? false,
            })
          : null
      })()
    : null

  const align = col.align as 'left' | 'center' | 'right' | undefined
  const justifyContent = align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start'

  // 共享表头 tooltip：当提供了 onHeaderEnter 回调时，使用共享 ElTooltip 实例
  // （由 table.vue 统一渲染），替代 per-column ElTooltip 以减少 N 个 tooltip 实例
  // Shared header tooltip: when onHeaderEnter callback is provided, use shared ElTooltip instance
  // (rendered centrally by table.vue), replacing per-column ElTooltip to reduce N tooltip instances
  const wrappedHeaderContent = col.tooltip
    ? (options.onHeaderEnter
        ? h('span', {
            class: 'adv-table__header-tooltip-trigger',
            onMouseenter: (e: MouseEvent) => options.onHeaderEnter!(e.currentTarget as HTMLElement, col.tooltip as string),
            onMouseleave: () => options.onHeaderLeave?.(),
          }, [headerContent])
        : headerContent)
    : headerContent

  const colFloatingFilter = col.floatingFilter
  const filterConfig = (col.filter !== false && !col.selection && col.valueType !== 'option' && colFloatingFilter !== false)
    ? normalizeFilterConfig(col.filter ?? true)
    : null
  const showFloating = !!(options.floatingFilter && !skipActions && filterConfig && getFilterValue && setFilter)

  const headerRow = h('span', {
    class: 'adv-table__header-cell-content',
    style: { justifyContent },
  }, [
    h('span', {
      class: 'adv-table__header-cell-text',
      onClick: onHeaderClick
        ? (e: Event) => onHeaderClick({ column: col, columnIndex: headerColIdx, event: e })
        : undefined,
      onContextmenu: onHeaderContextmenu
        ? (e: Event) => onHeaderContextmenu({ column: col, columnIndex: headerColIdx, event: e })
        : undefined,
    }, [
      wrappedHeaderContent,
    ]),
    (sortIcon || filterIcon)
      ? h('span', { class: 'adv-table__header-cell-actions' }, [sortIcon, filterIcon])
      : null,
  ])

  if (!showFloating)
    return headerRow

  // Resolve custom floating filter config from filterConfig or col.filter object
  const ffComponent = filterConfig.floatingFilterComponent ?? (typeof col.filter === 'object' ? (col.filter as { floatingFilterComponent?: any }).floatingFilterComponent : undefined)
  const ffParams = filterConfig.floatingFilterParams ?? (typeof col.filter === 'object' ? (col.filter as { floatingFilterParams?: any }).floatingFilterParams : undefined)

  const floatingCell = h('span', { class: 'adv-table__header-cell-floating' }, [
    h(FloatingFilterCell, {
      'columnKey': key,
      'filterType': filterConfig.type,
      'modelValue': getFilterValue!(key) ?? createDefaultFilterValue(filterConfig.type),
      'onUpdate:modelValue': (val: any) => setFilter!(key, val),
      'active': isColumnFiltered?.(key) ?? false,
      'enumOptions': () => getEnumOptions?.(key) ?? [],
      'floatingFilterComponent': ffComponent,
      'floatingFilterParams': ffParams,
      'suppressFilterButton': colSuppressFFBtn,
      't': filterT ?? (() => ''),
    }),
  ])

  return h('span', { class: 'adv-table__header-cell--with-floating' }, [
    headerRow,
    floatingCell,
  ])
}

/**
 * <zh/> 渲染分组头行单元格内容
 *
 * <zh/> 两种渲染器（default / virtual）共用，避免分组头行渲染逻辑重复。
 * <zh/> 当 slots.groupHeader 存在时使用自定义 slot，否则使用默认渲染。
 * @param groupRow - <zh/> 分组头行数据 | <en/> group header row data
 * @param rowGroupApi - <zh/> 行分组 API | <en/> row group API
 * @param slots - <zh/> 组件 slots，用于检查 groupHeader 自定义渲染 | <en/> component slots, for checking groupHeader custom rendering
 * @returns <zh/> 分组头行 VNode | <en/> group header row VNode
 *
 * <en/> Render group header row cell content
 *
 * <en/> Shared by both renderers (default / virtual), avoiding duplicate group header rendering logic.
 * <en/> When slots.groupHeader exists, use custom slot; otherwise use default rendering.
 */
export function renderGroupHeaderCell(
  groupRow: any,
  rowGroupApi: RowGroupApi,
  slots?: Record<string, any>,
  t?: (path: string) => string,
  namespace: string = 'el',
) {
  const isExpanded = groupRow.__groupExpanded
  const groupValue = groupRow.__groupValue
  const groupCount = groupRow.__groupCount
  const groupField = groupRow.__groupField

  const expandLabel = t ? t('table.groupExpand') : 'Expand group'
  const collapseLabel = t ? t('table.groupCollapse') : 'Collapse group'

  // <zh/> 展开/折叠切换按钮——slot 分支与默认分支共用，消除重复的 VNode 构造。
  // <zh/> 必须传入 __groupFieldIndex——多字段分组时缺省 fieldIndex=0 会导致二级组头误切一级组。
  // <en/> Expand/collapse toggle — shared by slot & default branches, removing duplicated VNode trees.
  // <en/> Must pass __groupFieldIndex — omitting it defaults fieldIndex to 0, toggling the level-1 group instead.
  const renderToggleButton = () => h('button', {
    'type': 'button',
    'class': [epTableExpandIcon(namespace), isExpanded && epTableExpandIconExpanded(namespace)],
    'aria-label': isExpanded ? collapseLabel : expandLabel,
    'aria-expanded': String(isExpanded),
    'onClick': (e: Event) => {
      e.stopPropagation()
      rowGroupApi.toggleGroupExpand(groupRow.__groupValue, groupRow.__groupFieldIndex)
    },
  }, [
    h('i', { class: epIcon(namespace) }, [
      h('svg', { viewBox: '0 0 1024 1024', xmlns: 'http://www.w3.org/2000/svg' }, [
        h('path', { fill: 'currentColor', d: EP_ARROW_PATH }),
      ]),
    ]),
  ])

  // <zh/> 插槽名规范：kebab-case（`group-header`）为规范名，camelCase（`groupHeader`）为兼容别名，运行时等价
  // <en/> Slot naming: kebab-case (`group-header`) is canonical, camelCase (`groupHeader`) is the compat alias; equivalent at runtime
  const groupHeaderSlot = slots?.groupHeader ?? slots?.['group-header']
  if (groupHeaderSlot) {
    return h('div', { class: 'adv-table__group-header-cell' }, [
      renderToggleButton(),
      (() => {
        try {
          return groupHeaderSlot({
            field: groupField,
            value: groupValue,
            count: groupCount,
            expanded: isExpanded,
            // <zh/> 聚合结果表（配置 aggregateColumns 时存在），键为 `${field}:${agg}`
            // <en/> Aggregate results (present when aggregateColumns configured), keyed by `${field}:${agg}`
            aggregates: groupRow.__groupAggregates,
            toggle: () => rowGroupApi.toggleGroupExpand(groupRow.__groupValue, groupRow.__groupFieldIndex),
          })
        }
        catch (e) {
          return renderErrorFallback(e, 'header')
        }
      })(),
    ])
  }

  return h('div', { class: 'adv-table__group-header-cell' }, [
    renderToggleButton(),
    h('span', { class: 'adv-table__group-header-value' }, String(groupValue ?? '')),
    h('span', { class: 'adv-table__group-header-count' }, `(${groupCount})`),
  ])
}

/**
 * <zh/> 渲染行展开图标按钮
 *
 * <zh/> 两种渲染器（default / virtual）共用，避免展开行图标渲染逻辑重复。
 * @param rowKeyStr - <zh/> 行唯一标识 | <en/> row unique identifier
 * @param isExpanded - <zh/> 当前展开状态 | <en/> current expand state
 * @param rowExpandApi - <zh/> 行展开 API | <en/> row expand API
 * @returns <zh/> 展开图标 VNode | <en/> expand icon VNode
 *
 * <en/> Render row expand icon button
 *
 * <en/> Shared by both renderers (default / virtual), avoiding duplicate expand icon rendering logic.
 */
export function renderRowExpandIcon(
  rowKeyStr: string | number,
  isExpanded: boolean,
  rowExpandApi: RowExpandApi,
  t?: (path: string) => string,
  namespace: string = 'el',
) {
  const expandLabel = t ? t('table.rowExpandButton') : 'Expand this row'
  const collapseLabel = t ? t('table.rowCollapseButton') : 'Collapse this row'
  return h('button', {
    'type': 'button',
    'class': [epTableExpandIcon(namespace), isExpanded && epTableExpandIconExpanded(namespace)],
    'aria-label': isExpanded ? collapseLabel : expandLabel,
    'aria-expanded': String(isExpanded),
    'onClick': (e: Event) => {
      e.stopPropagation()
      rowExpandApi.toggleRowExpand(rowKeyStr)
    },
  }, [
    h('i', { class: epIcon(namespace) }, [
      h('svg', { viewBox: '0 0 1024 1024', xmlns: 'http://www.w3.org/2000/svg' }, [
        h('path', { fill: 'currentColor', d: EP_ARROW_PATH }),
      ]),
    ]),
  ])
}

/** <zh/> 树形展开/折叠按钮 loading 图标 SVG | <en/> Tree expand/collapse loading icon SVG */
function renderTreeLoadingIcon(namespace: string) {
  return h('i', { class: epIcon(namespace) }, [
    h('svg', { viewBox: '0 0 1024 1024', class: 'adv-table-tree-loading-svg' }, [
      h('path', { fill: 'currentColor', d: EP_LOADING_PATH }),
    ]),
  ])
}

/** <zh/> 树形展开/折叠按钮箭头 SVG | <en/> Tree expand/collapse arrow SVG */
function renderTreeArrowIcon(namespace: string) {
  return h('i', { class: epIcon(namespace) }, [
    h('svg', { viewBox: '0 0 1024 1024', xmlns: 'http://www.w3.org/2000/svg' }, [
      h('path', { fill: 'currentColor', d: EP_ARROW_PATH }),
    ]),
  ])
}

/**
 * <zh/> 渲染树形单元格前缀（缩进 + 展开/折叠图标）
 *
 * <zh/> 两种渲染器（default / virtual）共用，消除树形渲染逻辑冗余。
 * <zh/> 统一处理 indent spacer、loading spinner、占位按钮、a11y 属性。
 * @param meta - <zh/> 行级树形元信息 | <en/> row-level tree metadata
 * @param rowKey - <zh/> 行唯一标识 | <en/> row unique identifier
 * @param onToggle - <zh/> 切换展开/折叠回调，由调用方绑定 treeApi.toggleRowExpand | <en/> toggle expand/collapse callback, bound to treeApi.toggleRowExpand by caller
 * @returns <zh/> 树形前缀 VNode 数组（indentSpacer + expandIcon），不含单元格内容 | <en/> tree prefix VNode array (indentSpacer + expandIcon), excluding cell content
 *
 * <en/> Render tree cell prefix (indent + expand/collapse icon)
 *
 * <en/> Shared by both renderers (default / virtual), eliminating tree rendering logic redundancy.
 * <en/> Uniformly handles indent spacer, loading spinner, placeholder button, and a11y attributes.
 */
export function renderTreeCellPrefix(
  meta: TreeRowMeta,
  rowKey: string | number,
  onToggle: (key: string | number) => void,
  t?: (path: string) => string,
  namespace: string = 'el',
): VNode[] {
  const expandLabel = t ? t('table.rowExpandButton') : 'Expand this row'
  const collapseLabel = t ? t('table.rowCollapseButton') : 'Collapse this row'
  const indentSpacer = meta.indentPx > 0
    ? h('span', { class: [epTableIndent(namespace), 'adv-table-tree-indent'], style: { paddingLeft: `${meta.indentPx}px` } })
    : null

  const expandIcon = meta.hasChildren
    ? h('button', {
        'type': 'button',
        'class': [
          epTableExpandIcon(namespace),
          meta.expanded ? epTableExpandIconExpanded(namespace) : '',
        ],
        'aria-label': meta.expanded ? collapseLabel : expandLabel,
        'aria-expanded': String(!!meta.expanded),
        'onClick': (e: Event) => {
          e.stopPropagation()
          onToggle(rowKey)
        },
      }, [
        meta.loading
          ? renderTreeLoadingIcon(namespace)
          : renderTreeArrowIcon(namespace),
      ])
    : h('button', { 'type': 'button', 'class': [epTableExpandIcon(namespace), epTableExpandIconPlaceholder(namespace)], 'aria-hidden': 'true', 'tabindex': -1 })

  return [indentSpacer, expandIcon].filter((v): v is VNode => v != null)
}
