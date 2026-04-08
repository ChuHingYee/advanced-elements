import type { Slots, VNode } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { HeaderCellContext } from '../../types/column'
import type { SortOrder } from '../../types/sort'
import type { Translator } from '../../types/translator'
import { CaretBottom, CaretTop } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'
import { Fragment, h, inject } from 'vue'
import { resolvePath } from '../../locale'
import { advLocaleKey, advTableEditKey, advTableFilterSortKey, advTableKey, advTableRowExpandKey, advTableRowGroupKey, advTableRowViewModelKey, advTableSharedHeaderTooltipKey, advTableTreeKey } from '../../types/injection-keys'
import { getColumnKey } from '../../utils/shared'
import { ADV_TABLE_COLUMN_KEY_ATTR, ADV_TABLE_ROW_KEY_ATTR } from '../../utils/table-drag'
import { renderErrorFallback } from './render-error-fallback'

/**
 * <zh/> 渲染拖拽标记占位单元格——统一表头和行的拖拽标记渲染
 * <en/> Render drag marker placeholder cell — unifies header and row drag marker rendering
 *
 * @param className - <zh/> CSS class 名 | <en/> CSS class name
 * @param dataAttr - <zh/> data 属性名 | <en/> data attribute name
 * @param dataValue - <zh/> data 属性值 | <en/> data attribute value
 * @param content - <zh/> 占位内容 | <en/> placeholder content
 * @returns <zh/> 拖拽标记 span VNode | <en/> drag marker span VNode
 */
export function renderDragMarker(
  className: string,
  dataAttr: string,
  dataValue: string,
  content: unknown,
): VNode {
  // <zh/> any 说明（已用 vue-tsc 验证）：此处 h() 重载要求 `RawChildren | RawSlots`，
  // <zh/> 该类型未从 'vue' 导出不可命名；`VNodeChild`/`NonNullable<VNodeChild>` 均因含 void 成员不被重载接受。
  // <zh/> content 本为 unknown，断言仅收窄调用点，运行时逐字节不变。
  // <en/> Why any (verified with vue-tsc): this h() overload demands `RawChildren | RawSlots`,
  // <en/> which is not exported from 'vue' and cannot be named; `VNodeChild` / `NonNullable<VNodeChild>`
  // <en/> are rejected for their void member. The assertion only narrows the call site; runtime is byte-identical.
  return h('span', {
    class: className,
    [dataAttr]: dataValue,
  }, content as any)
}

/**
 * <zh/> 渲染表头拖拽标记占位单元格
 * <en/> Render header drag marker placeholder cell
 */
export function renderHeaderDragMarker(columnKey: string, content: unknown, ariaSort?: string): VNode {
  const props: Record<string, unknown> = {
    class: 'adv-table__header-cell adv-table__drag-header-marker',
    [ADV_TABLE_COLUMN_KEY_ATTR]: columnKey,
  }
  if (ariaSort) {
    props['aria-sort'] = ariaSort
    props.role = 'columnheader'
  }
  // <zh/> 同上：重载要求的精确类型不可命名，此处保留 any（见 renderDragMarker 处说明）
  // <en/> Same as above: the exact type the overload demands is not nameable; any stays (see renderDragMarker)
  return h('span', props, content as any)
}

/**
 * <zh/> 渲染行拖拽标记占位单元格
 * <en/> Render row drag marker placeholder cell
 */
export function renderRowDragMarker<T>(rowKeyFn: (row: T) => string, row: T, content: unknown): VNode {
  return renderDragMarker(
    'adv-table__cell adv-table__drag-row-marker',
    ADV_TABLE_ROW_KEY_ATTR,
    (rowKeyFn as (row: T) => string)(row),
    content,
  )
}

/**
 * <zh/> 渲染器国际化 composable，优先使用 props 传入的翻译函数，回退到全局注入的 locale
 * <en/> Renderer i18n composable, prefers the translator passed via props, falls back to the globally injected locale
 */
export function useRendererLocale(propsT?: Translator) {
  const locale = inject(advLocaleKey, undefined)

  const t = (): Translator | undefined => {
    if (propsT)
      return propsT
    if (locale?.value) {
      return (path: string) => resolvePath(locale.value!, path)
    }
    return undefined
  }

  return { t }
}

/**
 * <zh/> 渲染表头单元格，优先使用 headerCellRenderer，回退到 label/prop
 * <en/> Render header cell, prefers headerCellRenderer, falls back to label/prop
 */
export function renderHeaderCell(col: ProcessedColumn, columns?: ProcessedColumn[], columnIndex?: number, headerIndex?: number): VNode | string {
  if (col.headerCellRenderer) {
    const ctx: HeaderCellContext = {
      columns: columns ?? [col],
      column: col,
      columnIndex: columnIndex ?? 0,
      headerIndex: headerIndex ?? 0,
    }
    try {
      return col.headerCellRenderer(ctx)
    }
    catch (e) {
      return renderErrorFallback(e, 'header')
    }
  }
  return col.label ?? col.prop ?? ''
}

/**
 * <zh/> 渲染排序指示器（升序/降序图标 + 多列排序序号）
 * <en/> Render sort indicator (ascending/descending icon + multi-column sort index)
 */
export function renderSortIndicator(
  col: ProcessedColumn,
  sortOrder?: SortOrder,
  onToggleSort?: (e?: MouseEvent) => void,
  sortIndex?: number,
  t?: (path: string) => string,
): VNode | null {
  if (!col.sortable)
    return null

  const children: any[] = [
    h(ElIcon, { class: ['adv-table__sort-icon', 'adv-table__sort-icon--asc', sortOrder === 'ascending' ? 'adv-table__sort-icon--active' : ''] }, () => h(CaretTop)),
    h(ElIcon, { class: ['adv-table__sort-icon', 'adv-table__sort-icon--desc', sortOrder === 'descending' ? 'adv-table__sort-icon--active' : ''] }, () => h(CaretBottom)),
  ]
  if (sortIndex != null && sortIndex >= 0) {
    children.unshift(h('span', { class: 'adv-table__sort-index' }, String(sortIndex + 1)))
  }

  /**
   * <zh/> aria-label 走 i18n：t 未传入时回退到英文，历史中文硬编码在国际化场景下失真
   * <en/> aria-label via i18n: falls back to English when t is not provided
   */
  const defaultAscLabel = 'Click to sort ascending'
  const defaultAscActiveLabel = 'Sorted ascending, click to sort descending'
  const defaultDescActiveLabel = 'Sorted descending, click to clear sort'
  // <zh/> secondary English fallback in case t returns the key itself
  // <en/> secondary English fallback in case t returns the key itself
  const resolve = (key: string, fallback: string): string => {
    if (!t)
      return fallback
    const v = t(key)
    return v === key ? fallback : v
  }
  const ascLabel = resolve('table.sortAsc', defaultAscLabel)
  const ascActiveLabel = resolve('table.sortAscActive', defaultAscActiveLabel)
  const descActiveLabel = resolve('table.sortDescActive', defaultDescActiveLabel)

  return h('span', {
    'class': 'adv-table__sort-indicator',
    'role': 'button',
    'tabindex': '0',
    'aria-label': sortOrder === 'ascending'
      ? ascActiveLabel
      : sortOrder === 'descending'
        ? descActiveLabel
        : ascLabel,
    'style': { userSelect: 'none', cursor: 'pointer' },
    'onMousedown': (e: Event) => e.preventDefault(),
    'onClick': (e: Event) => {
      e.stopPropagation()
      onToggleSort?.(e as MouseEvent)
    },
    'onKeydown': (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault()
        e.stopPropagation()
        onToggleSort?.()
      }
    },
  }, children)
}

/**
 * <zh/> 列级插槽作用域参数 | <en/> Column-level slot scope params
 *
 * @remarks
 * <zh/> 对齐 ElTable 原生插槽语义：单元格插槽接收 { row, column, $index }，表头插槽接收 { column, $index }。
 * <zh/> 调用方通过 renderColumnSlot 的重载传入 row/index；表头插槽仅需 column/index。
 * <en/> Aligns with ElTable native slot semantics: cell slots receive { row, column, $index }, header slots receive { column, $index }.
 * <en/> Callers pass row/index via renderColumnSlot overload; header slots only need column/index.
 */
export interface ColumnSlotScope {
  /** <zh/> 行数据（单元格插槽） | <en/> row data (cell slot) */
  row?: any
  /** <zh/> 列配置 | <en/> column config */
  column: ProcessedColumn
  /** <zh/> 行索引（单元格插槽）或列索引（表头插槽） | <en/> row index (cell slot) or column index (header slot) */
  $index?: number
}

/**
 * <zh/> 渲染列级插槽内容——统一表头插槽和单元格插槽的渲染逻辑
 * <en/> Render column-level slot content — unifies header slot and cell slot rendering logic
 *
 * @remarks
 * <zh/> 表头插槽名为 `${key}-header`，单元格插槽名为 `${key}`，仅后缀不同。
 * <zh/> 合并后消除重复代码，新增插槽类型时只需修改此函数。
 * <en/> Header slot name is `${key}-header`, cell slot name is `${key}`, differing only by suffix.
 * <en/> Merging eliminates duplication; adding new slot types only requires modifying this function.
 *
 * @param col - <zh/> 列配置 | <en/> column config
 * @param slots - <zh/> 插槽集合 | <en/> slots collection
 * @param headerSuffix - <zh/> 表头插槽后缀，默认 '-header'；传空字符串表示单元格插槽 | <en/> header slot suffix, default '-header'; empty string for cell slot
 * @returns <zh/> 插槽渲染结果 | <en/> slot render result
 */
export function renderColumnSlot(col: ProcessedColumn, slots: Slots, headerSuffix = '', scope?: ColumnSlotScope): VNode | null {
  const key = getColumnKey(col)
  const slotFn = headerSuffix ? slots[`${key}${headerSuffix}`] : slots[key]
  if (!slotFn)
    return null
  let vnodes: VNode[] | VNode
  try {
    vnodes = slotFn(scope ?? { column: col })
  }
  catch (e) {
    return renderErrorFallback(e, headerSuffix ? 'header' : 'cell')
  }
  if (!Array.isArray(vnodes))
    return vnodes as VNode
  if (vnodes.length === 1)
    return vnodes[0]
  if (vnodes.length > 1)
    return h(Fragment, {}, vnodes)
  return null
}

/**
 * <zh/> 渲染列级表头插槽（renderColumnSlot 的便捷封装）
 * <en/> Render column-level header slot (convenience wrapper of renderColumnSlot)
 */
/**
 * <zh/> 渲染列级表头插槽（renderColumnSlot 的便捷封装）
 * <en/> Render column-level header slot (convenience wrapper of renderColumnSlot)
 *
 * @param col - <zh/> 列配置 | <en/> column config
 * @param slots - <zh/> 插槽集合 | <en/> slots collection
 * @param columnIndex - <zh/> 列索引 | <en/> column index
 */
export function renderHeaderSlot(col: ProcessedColumn, slots: Slots, columnIndex?: number): VNode | null {
  return renderColumnSlot(col, slots, '-header', { column: col, $index: columnIndex })
}

/** <zh/> 不需要溢出 tooltip 的 valueType 集合 | <en/> valueType set that does not need overflow tooltip */
export const NO_TOOLTIP_VALUE_TYPES = new Set(['progress', 'switch', 'avatar', 'image', 'rate', 'option'])

/** <zh/> 判断列是否有自定义渲染（cellRenderer / cellComponent / 插槽） | <en/> determine whether a column has custom rendering (cellRenderer / cellComponent / slot) */
export function hasCustomRender(col: ProcessedColumn, slots: Record<string, any>, slotKey: string): boolean {
  return !!(col.cellRenderer || col.cellComponent || slots[slotKey])
}

/** <zh/> 从列配置中提取渲染相关属性，返回剩余的可透传属性 | <en/> extract render-related props from column config, return remaining pass-through props */
export function extractColumnRenderProps(col: ProcessedColumn) {
  const {
    cellRenderer,
    cellComponent,
    headerCellRenderer,
    hidden,
    format,
    valueType,
    valueEnum,
    copyable,
    ellipsis,
    showOverflowTooltip,
    tooltipFormatter,
    filter,
    sortable,
    spanRows,
    colSpan,
    merge,
    colMerge,
    children,
    cellClassRules,
    stretch,
    ...rest
  } = col
  return rest
}

/** <zh/> 折叠状态箭头 SVG path | <en/> collapsed state arrow SVG path */
export const COLLAPSED_ARROW_PATH = 'M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z'
/** <zh/> 展开状态箭头 SVG path | <en/> expanded state arrow SVG path */
export const EXPANDED_ARROW_PATH = 'M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z'

/** <zh/> Element Plus 风格右箭头 SVG path（viewBox 0 0 1024 1024），用于行展开/树形展开图标 | <en/> Element Plus style right-arrow SVG path (viewBox 0 0 1024 1024), used for row/tree expand icons */
export const EP_ARROW_PATH = 'M340.864 149.312a30.59 30.59 0 0 0 0 42.752L652.736 512 340.864 831.872a30.59 30.59 0 0 0 0 42.752 29.12 29.12 0 0 0 41.728 0L714.24 534.336a32 32 0 0 0 0-44.672L382.592 149.376a29.12 29.12 0 0 0-41.728 0z'

/** <zh/> Element Plus 风格加载中 SVG path（viewBox 0 0 1024 1024），用于树形懒加载 loading 图标 | <en/> Element Plus style loading SVG path (viewBox 0 0 1024 1024), used for tree lazy-loading icon */
export const EP_LOADING_PATH = 'M512 64a32 32 0 0 1 32 32v192a32 32 0 0 1-64 0V96a32 32 0 0 1 32-32zm0 640a32 32 0 0 1 32 32v192a32 32 0 0 1-64 0V736a32 32 0 0 1 32-32zM195.2 195.2a32 32 0 0 1 45.248 0L376.32 331.008a32 32 0 0 1-45.248 45.248L195.2 240.448a32 32 0 0 1 0-45.248zm407.424 407.424a32 32 0 0 1 45.248 0l135.808 135.872a32 32 0 0 1-45.248 45.248l-135.808-135.872a32 32 0 0 1 0-45.248zM64 512a32 32 0 0 1 32-32h192a32 32 0 0 1 0 64H96a32 32 0 0 1-32-32zm640 0a32 32 0 0 1 32-32h192a32 32 0 0 1 0 64H736a32 32 0 0 1-32-32zM195.2 828.8a32 32 0 0 1 0-45.248l135.872-135.808a32 32 0 0 1 45.248 45.248L240.448 828.8a32 32 0 0 1-45.248 0zm407.424-407.424a32 32 0 0 1 0-45.248l135.872-135.808a32 32 0 0 1 45.248 45.248L647.872 421.376a32 32 0 0 1-45.248 0z'

/**
 * <zh/> 渲染器共享上下文——通过统一 Context 获取 table.vue 提供的全部功能域 API
 * <en/> Renderer shared context — obtains all feature-domain APIs provided by table.vue via unified Context
 *
 * @remarks
 * <zh/> 注意：advTableHoverLayerKey 由渲染器自身 provide，本函数【不】注入该 key——
 * <zh/> 渲染器自身 setup 无法注入自己 provide 的值（inject 只读取父级），
 * <zh/> 若在此注入，V2 渲染器（useNormalV2Columns 在自身 setup 调用）会触发
 * <zh/> useSafeInject 告警并拿到恒为 undefined 的 hoverApi。
 * <zh/> V1 子组件（NormalColumn）需 hoverApi 时自行 useSafeInject 该 key（合法子级注入）。
 * <en/> NOTE: advTableHoverLayerKey is provided by the renderer itself, and this function
 * <en/> intentionally does NOT inject it — a renderer cannot inject its own provide
 * <en/> (inject reads parent provides only); injecting it here makes the V2 renderer
 * <en/> (useNormalV2Columns called in its own setup) warn and always get undefined.
 * <en/> V1 children (NormalColumn) inject the key themselves (legitimate child inject).
 */
export function injectRendererContext() {
  return {
    tableContext: inject(advTableKey, undefined),
    editApi: inject(advTableEditKey, undefined),
    filterSortApi: inject(advTableFilterSortKey, undefined),
    treeApi: inject(advTableTreeKey, undefined),
    rowGroupApi: inject(advTableRowGroupKey, undefined),
    rowExpandApi: inject(advTableRowExpandKey, undefined),
    sharedHeaderTooltip: inject(advTableSharedHeaderTooltipKey, undefined),
    rowViewModelContext: inject(advTableRowViewModelKey, undefined),
  }
}
