<!--
  @component AdvTable
  @displayName 高级表格
  @displayName Advanced Table
  @description <zh/> 基于 ElTable / ElTableV2 双引擎的企业级表格，支持虚拟滚动、树形、分组、行固定、编辑、合并、筛选排序、范围选择等
  @description <en/> Enterprise table with dual engines ElTable / ElTableV2, supports virtual scroll, tree, grouping, row pinning, editing, span, filter/sort, range selection, etc.
  @category 数据展示 | Data Display
  @extends ElTable, ElTableV2
  @since 1.0.0
-->
<script setup lang="ts" generic="T">
import type { FunctionalComponent } from 'vue'
import type { TableExpose } from './composables/api/use-table-api'
import type { AdvColumn, AdvTableEmitFn, ProcessedColumn } from './types'
import type { TableError } from './types/error'
import type { ColumnFilterValue } from './types/filter'
import type { AdvTableColumnSlotName, AdvTableColumnSlotProps, AdvTableErrorSlotProps, AdvTableHeaderSlotProps } from './types/slots'
import type { AdvTableEmitsMap } from './types/table-emits'
import type { AdvTableProps } from './types/table-props'
import type { RendererPropsDomains } from './utils/renderer-props-factory'
import { Filter, Operation, Setting } from '@element-plus/icons-vue'
import { ElIcon, ElPopover, ElTooltip } from 'element-plus'
import { computed, defineAsyncComponent, h, isReactive, reactive, useSlots } from 'vue'
import TableFooter from './components/footer/footer.vue'
import TableHeader from './components/header/header.vue'
import { useInfiniteScroll } from './composables/data/use-infinite-scroll'
import { useAdvTable } from './composables/use-adv-table'
import { ASYNC_PANEL_DELAY_MS, DEFAULT_SEARCH_DEBOUNCE } from './constants'
import { ADV_TABLE_VERSION } from './types/version'
import { AsyncChunkLoadError, createChunkLoadOnError } from './utils/async-chunk'
import { devWarn } from './utils/dev-warn'
import { isDev } from './utils/env'
import { buildRendererProps } from './utils/renderer-props-factory'
import { createTableEmitter } from './utils/table-emitter'

defineOptions({
  name: 'AdvTable',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<AdvTableProps<T>>(), {
  mode: 'virtual',
  toolbar: () => ({}),
  search: () => ({}),
  pagination: () => ({}),
  request: () => ({}),
  urlState: () => ({}),
  columns: () => [],
  border: undefined,
  resizable: undefined,
  loading: undefined,
  containerLayout: undefined,
  height: undefined,
  stripe: false,
  highlightCurrentRow: true,
  showHeader: true,
  debug: false,
})

const emit = defineEmits<AdvTableEmitsMap<T>>()

defineSlots<{
  'default'?: (props: Record<string, unknown>) => unknown
  'header-left'?: () => unknown
  'header-right'?: () => unknown
  'footer'?: (props: { currentPage: number, pageSize: number, total: number }) => unknown
  'footer-extra'?: () => unknown
  'empty'?: (props: { error: TableError | null }) => unknown
  'append'?: () => unknown
  'expandRow'?: (props: { row: T, rowKey: string | number }) => unknown
  'expand-row'?: (props: { row: T, rowKey: string | number }) => unknown
  'groupHeader'?: (scope: { field: string, value: unknown, count: number, expanded: boolean, aggregates?: Record<string, number | null>, toggle: () => void }) => unknown
  'group-header'?: (scope: { field: string, value: unknown, count: number, expanded: boolean, aggregates?: Record<string, number | null>, toggle: () => void }) => unknown
  'error'?: (props: AdvTableErrorSlotProps) => unknown
} & {
  [K in AdvTableColumnSlotName<T>]?: (props: AdvTableColumnSlotProps<T>) => unknown
} & {
  [K in `${AdvTableColumnSlotName<T>}-header`]?: (props: AdvTableHeaderSlotProps) => unknown
}>()

const quickFilterModel = defineModel<string>('quickFilter')
/**
 * <zh/> 手工双向（model 优先、未绑定回退 prop，见 use-adv-table 注释）——`columns/data/loading`
 * <zh/> 在上方 withDefaults(defineProps) 亦有同名声明（默认值来源），父经 `:columns/:data` 单向
 * <zh/> 传入 + `@update:` 手工回写。改动其中一边时必须同步另一边，勿只改单边；
 * <zh/> 父后续推送 `:data/:columns` 会覆盖内部模型（预期内，消费者需用 v-model 保持同步）。
 * <en/> Manual two-way binding (model-first, prop fallback when unbound, see use-adv-table) —
 * <en/> `columns/data/loading` are also declared in withDefaults(defineProps) above (as default
 * <en/> sources); the parent passes `:columns/:data` one-way + writes back via `@update:`.
 * <en/> Keep both sides in sync, never change only one; later parent `:data/:columns` pushes
 * <en/> overwrite the internal model (by design — consumers must use v-model to stay in sync).
 */
const columnsModel = defineModel<AdvColumn<T>[] | ProcessedColumn<T>[]>('columns')
const dataModel = defineModel<T[]>('data')
const loadingModel = defineModel<boolean>('loading')
const searchValuesModel = defineModel<Record<string, unknown>>('searchValues')
// 受控选中键——选择提交后回写，父组件可经 v-model 同步，也可拒绝更新保持真正受控
const selectedRowKeysModel = defineModel<(string | number)[]>('selectedRowKeys')

/**
 * <zh/> 异步面板加载占位——`defineAsyncComponent` 的 `loadingComponent`，弱网下首开面板时避免白屏无反馈。
 * <zh/> 刻意不用 `<Suspense>` 包裹面板：面板位于 `<Transition><KeepAlive>` 内（嵌套顺序不可变，
 * <zh/> KeepAlive 只缓存直接子节点），`loadingComponent + delay: 200` 零模板结构变更、无缓存语义干扰。
 * <en/> Async panel loading placeholder — `loadingComponent` for `defineAsyncComponent`, avoiding a
 * <en/> blank panel on first open over slow networks. Deliberately not `<Suspense>`: panels live inside
 * <en/> `<Transition><KeepAlive>` (nesting is immutable, KeepAlive caches direct children only),
 * <en/> so `loadingComponent + delay: 200` changes no template structure and disturbs no caching semantics.
 */
const PanelLoading: FunctionalComponent = () =>
  h('div', { 'class': 'adv-table__panel-loading', 'role': 'status', 'aria-live': 'polite' })

/**
 * <zh/> 低频面板异步加载——列设置/列分组/筛选/右键菜单仅在用户打开时挂载，
 * <zh/> 拆分为独立 chunk，不占用首屏初始包。
 * <en/> Lazily loaded low-frequency panels — column setting/group, filter and context menu
 * <en/> mount only when opened, split into separate chunks outside the initial bundle.
 */
const ColumnGroupSidePanel = defineAsyncComponent({
  loader: () => import('./components/column-group/column-group-side-panel.vue'),
  loadingComponent: PanelLoading,
  errorComponent: AsyncChunkLoadError,
  onError: createChunkLoadOnError('column-group-side-panel'),
  delay: ASYNC_PANEL_DELAY_MS,
})
const ColumnSettingSidePanel = defineAsyncComponent({
  loader: () => import('./components/column-setting/column-setting-side-panel.vue'),
  loadingComponent: PanelLoading,
  errorComponent: AsyncChunkLoadError,
  onError: createChunkLoadOnError('column-setting-side-panel'),
  delay: ASYNC_PANEL_DELAY_MS,
})
const ContextMenu = defineAsyncComponent({
  loader: () => import('./components/context-menu/context-menu.vue'),
  loadingComponent: PanelLoading,
  errorComponent: AsyncChunkLoadError,
  onError: createChunkLoadOnError('context-menu'),
  delay: ASYNC_PANEL_DELAY_MS,
})
const ColumnFilterForm = defineAsyncComponent({
  loader: () => import('./components/filter-panel/column-filter-form.vue'),
  loadingComponent: PanelLoading,
  errorComponent: AsyncChunkLoadError,
  onError: createChunkLoadOnError('column-filter-form'),
  delay: ASYNC_PANEL_DELAY_MS,
})
const FilterPanel = defineAsyncComponent({
  loader: () => import('./components/filter-panel/filter-panel.vue'),
  loadingComponent: PanelLoading,
  errorComponent: AsyncChunkLoadError,
  onError: createChunkLoadOnError('filter-panel'),
  delay: ASYNC_PANEL_DELAY_MS,
})
/**
 * <zh/> 搜索栏异步加载——`v-if="search.hasSearch"` 守卫下仅启用搜索时挂载，不占用首屏初始包
 * <en/> Lazily loaded search bar — mounts only when search is enabled under `v-if="search.hasSearch"`, outside the initial bundle
 */
const TableSearch = defineAsyncComponent({
  loader: () => import('./components/search/search.vue'),
  loadingComponent: PanelLoading,
  errorComponent: AsyncChunkLoadError,
  onError: createChunkLoadOnError('table-search'),
  delay: ASYNC_PANEL_DELAY_MS,
})

const slots = useSlots()

/**
 * <zh/> 编排器原始返回值——域对象内部属性为 ref/computed | <en/> Orchestrator raw return — domain properties are ref/computed
 *
 * <zh/> `tableRootRef` / `tableSearchRef` 为模板 `ref=` 绑定所需的 Ref 对象，
 * <zh/> 必须在 `reactive` 包裹前提取（reactive 会将 ref 解包为普通值，无法再用于 ref= 绑定）。
 * <en/> `tableRootRef` / `tableSearchRef` are Ref objects needed for template `ref=` binding;
 * <en/> they MUST be extracted before `reactive` wrapping (reactive unwraps refs to plain values).
 */
const tableOrchestrator = useAdvTable<T>({
  props,
  emit: emit as unknown as AdvTableEmitFn,
  models: {
    quickFilter: quickFilterModel,
    columns: columnsModel,
    data: dataModel,
    loading: loadingModel,
    searchValues: searchValuesModel,
    selectedRowKeys: selectedRowKeysModel,
  },
  slots,
})
const tableRootRef = tableOrchestrator.interaction.tableRootRef
const tableSearchRef = tableOrchestrator.search.tableSearchRef
// vue-tsc 已知限制：模板 `ref="tableSearchRef"` 为字符串字面量，不计入脚本侧引用，
// 故用 void 消除 TS6133（上游 issue: vuejs/language-tools#4384）。若该限制修复可删除本行。
// vue-tsc limitation: the template `ref="tableSearchRef"` is a string literal and is not counted
// as a script-side reference, so `void` silences TS6133 (upstream: vuejs/language-tools#4384).
void tableSearchRef

/**
 * <zh/> 传给 `<KeepAlive :include>` 的「不缓存任何面板」哨兵值。
 * <zh/> 空数组在 Vue 的 `matches()` 里恒为 false（`pattern.some(...)`），于是 KeepAlive 清掉
 * <zh/> `COMPONENT_SHOULD_KEEP_ALIVE` 标志并直接透传——等价于「不缓存」，从而让
 * <zh/> `sidePanelDestroyOnClose=true`（默认）时面板真正卸载，同时避免复制一整份面板模板。
 * <en/> the `include` sentinel meaning "cache nothing". An empty array is always falsy under
 * <en/> Vue's `matches()`, so KeepAlive drops `COMPONENT_SHOULD_KEEP_ALIVE` and passes the child
 * <en/> through — giving true unmount semantics for `sidePanelDestroyOnClose=true` (the default)
 * <en/> without duplicating the whole panel template.
 */
const NON_CACHING_INCLUDE: string[] = []

/**
 * <zh/> 模板 ref 直绑——与 tableRootRef 一致走框架管理，卸载自动置 null，无需函数式中转。
 * <zh/> 该 ref 保留在 api 内供域内联动，但属内部成员，不进公开 expose，本地不再列入 defineExpose。
 * <en/> Direct template ref binding — framework-managed like tableRootRef, auto-nulls on unmount without a function wrapper.
 * <en/> The ref stays in api for domain wiring but is internal-only, so it is not listed in defineExpose.
 */

/**
 * <zh/> 响应式域对象——`reactive` 包裹后解构，模板中 ref/computed 自动解包 | <en/> Reactive domains — `reactive` wrap + destructure, refs/computeds auto-unwrap in template
 *
 * <zh/> `reactive` 是必需的：域对象内部属性为 ref/computed，模板依赖 reactive 的 ref auto-unwrap 机制。
 * <zh/> `shallowReactive` 不会 auto-unwrap refs，故不适用。
 * <zh/> 性能：仅创建一个外层 Proxy，内层代理按需懒创建；解构时触发 get trap 获取已缓存的代理，
 * <zh/> 无 per-render 开销。`api` 被 `markRaw` 标记，reactive 跳过代理创建，直接透传。
 * <en/> `reactive` is required: domain properties are ref/computed; templates rely on reactive's ref auto-unwrap.
 * <en/> `shallowReactive` does not auto-unwrap refs, so it is not applicable.
 * <en/> Performance: one outer Proxy; inner proxies are lazily created on first access.
 * <en/> Destructuring triggers get trap to retrieve cached proxies; no per-render overhead.
 * <en/> `api` is `markRaw`'d, so reactive skips proxy creation and passes it through.
 */
const {
  config,
  search,
  columns,
  data,
  selection,
  filterSort,
  span,
  io,
  renderer,
  interaction,
  menu,
  shared,
  sidePanel,
  i18n,
} = reactive(tableOrchestrator)

/**
 * <zh/> 实例 API——直接取编排器原始返回（不经 `reactive` 解构），保持 `UseTableApiReturn<T>`
 * <zh/> 原始形状（Ref 属性不解包），供 `defineExpose({...api} satisfies TableExpose<T>)` 契约锚定。
 * <zh/> 注意：这是编写侧形状；运行时 Vue 经模板 ref 拿到的实例顶层 Ref 已被 proxyRefs
 * <zh/> 解包，消费方请标注 `ref<TableInstanceExpose<Row>>()`，读取 `table.value.loading`（boolean）
 * <zh/> 而非 `table.value.loading.value`。
 * <en/> Instance API — taken from the orchestrator's raw return (not through `reactive` destructuring)
 * <en/> to preserve the original `UseTableApiReturn<T>` shape (Ref props unwrapped by reactive's type).
 * <en/> Used by `defineExpose({...api} satisfies TableExpose<T>)` for contract anchoring.
 * <en/> Note: this is the authoring shape; the runtime instance via template ref is
 * <en/> proxyRefs-unwrapped — consumers annotate `ref<TableInstanceExpose<Row>>()` and read
 * <en/> `table.value.loading` (boolean), not `table.value.loading.value`.
 */
const api = tableOrchestrator.api

if (isDev && isReactive(api)) {
  // <zh/> 防护：api 必须经 markRaw 跳过 reactive 代理；未跳过时立即告警，避免静默引入代理开销
  // <en/> Guard: api must skip the reactive proxy via markRaw; warn loudly when it does not, instead of silently paying proxy overhead
  devWarn('AdvTable api should stay raw (markRaw) and never become reactive.', { tableId: tableOrchestrator.config.tableId.value })
}

/**
 * <zh/> SFC 事件发射器——与子编排器同经 `createTableEmitter` 自动拼接 tableId，消除手写 `emit(xxx, p, config.tableId)`。
 * <zh/> 传 computed 本体而非 `.value` 快照，`uiConfig.tableId` 运行时变更后即时跟随。
 * <en/> SFC event emitter — same `createTableEmitter` channel as sub-orchestrators, auto-appending tableId.
 * <en/> Passes the computed itself rather than a `.value` snapshot so runtime `uiConfig.tableId` changes follow immediately.
 */
const tableEmit = createTableEmitter(emit as unknown as AdvTableEmitFn, tableOrchestrator.config.tableId)

//  事件处理函数 | Event handlers
// 提取模板内联箭头函数为命名函数，消除每次渲染的函数实例创建开销，
// 同时统一重复的事件转发逻辑（columnVisible / columnMoved 在两处使用）。

/** <zh/> 列可见性变化事件转发 | <en/> Column visibility change event forwarder */
function handleColumnVisible(p: { columnKey: string, visible: boolean }): void {
  tableEmit('columnVisible', p)
}

/** <zh/> 搜索表单变化事件转发 | <en/> Search form change event forwarder */
function handleSearchChange(key: string, val: unknown, formModel: Record<string, unknown>): void {
  tableEmit('searchChange', { key, val, formModel })
}

/** <zh/> 滚动到底部事件转发 | <en/> End reached event forwarder */
const infiniteScroll = useInfiniteScroll({
  enabled: () => config.mergedPagination.infiniteScroll ?? false,
  isManual: () => config.isManual,
  hasMore: () => data.pagination.hasMore,
  loading: () => !!config.mergedLoading,
  loadMore: data.handleLoadMore,
})

function handleEndReached(distance: number): void {
  tableEmit('endReached', distance)
  // <zh/> infiniteScroll 开启时自动联动加载——消费者仍可通过 endReached 事件感知进度
  // <en/> auto-load when infiniteScroll is on — consumers still observe progress via the endReached event
  infiniteScroll.maybeLoadMore(distance)
}

/** <zh/> 行渲染事件转发 | <en/> Rows rendered event forwarder */
function handleRowsRendered(params: { rowCacheStart: number, rowCacheEnd: number, rowVisibleStart: number, rowVisibleEnd: number }): void {
  tableEmit('rowsRendered', params)
}

/** <zh/> 轮询状态更新——仅非 undefined 时生效 | <en/> Polling state update — only effective when not undefined */
function handlePollingUpdate(val: boolean | undefined): void {
  if (val !== undefined)
    data.setIsPolling(val)
}

/** <zh/> 列更新——仅非 undefined 时生效 | <en/> Columns update — only effective when not undefined */
function handleColumnsUpdate(val: ProcessedColumn[] | undefined): void {
  if (val !== undefined)
    columns.setColumns(val)
}

/** <zh/> 导出 Excel | <en/> Export to Excel */
function handleExportExcel(): void {
  io.exportExcel()
}

/** <zh/> 导出 CSV | <en/> Export to CSV */
function handleExportCsv(): void {
  io.exportCsv()
}

/** <zh/> 触发数据导入 | <en/> Trigger data import */
function handleImportData(): void {
  io.triggerImport()
}

/** <zh/> 打印表格 | <en/> Print table */
function handlePrint(): void {
  io.doPrint()
}

/** <zh/> 关闭侧边面板 | <en/> Close side panel */
function handleCloseSidePanel(): void {
  sidePanel.activePanel = null
}

/** <zh/> 更新列配置（来自列设置侧面板） | <en/> Update column config (from column setting side panel) */
function handleUpdateHeaders(val: ProcessedColumn[]): void {
  columns.setColumns(val)
}

/** <zh/> 关闭筛选弹出层 | <en/> Close filter popover */
function handleCloseFilterPopover(): void {
  shared.sharedFilterPopover.close()
}

/**
 * <zh/> 菜单元素引用转发——ContextMenu 根元素经局部 ref 供二次校正 O(1) 度量，避免 document 全局扫
 * <en/> Forward the menu root element for O(1) re-measure in repositioning
 */
function setContextMenuRef(inst: unknown): void {
  try {
    const el = (inst as { $el?: unknown } | null)?.$el ?? inst ?? null
    ;(menu as { setMenuElRef?: (el: unknown) => void }).setMenuElRef?.(el)
  }
  catch {
    // <zh/> ref 转发异常不影响菜单主体 | <en/> Ref-forward errors must not break the menu
  }
}

//  渲染器 Props 构建 | Renderer props builder

/**
 * <zh/> 渲染器 props 域组装——在 computed 内读取解包后的域值，响应式追踪不断；
 * <zh/> 组装逻辑本身是纯函数（见 renderer-props-factory），SFC 只接线。加第三种模式时只需在工厂登记。
 * <en/> Renderer props domain assembly — reads unwrapped domain values inside a computed so tracking
 * <en/> holds; assembly itself is pure (see renderer-props-factory), the SFC only wires. A third mode
 * <en/> only registers in the factory.
 */
function rendererPropsDomains(): RendererPropsDomains<T> {
  return {
    visibleTree: columns.columnClassification.visibleTree,
    selectionColumns: columns.columnClassification.selection,
    normalColumns: columns.columnClassification.normal,
    leafColumns: columns.columnClassification.leafColumns,
    localColumns: columns.localColumns,
    canCollapse: columns.canCollapse,
    isCollapsed: columns.isCollapsed,
    collapsedState: columns.collapsedState,
    collapsedVersion: columns.collapsedVersion,
    columnKeepAlive: columns.columnKeepAlive,
    displayNormalColumns: renderer.displayNormalColumns,
    hoverOptionColumns: renderer.hoverOptionColumns,
    hasHoverOptionColumns: renderer.hasHoverOptionColumns,
    hoverOptionTeleport: renderer.hoverOptionTeleport,
    selectionColumnSyncKey: renderer.selectionColumnSyncKey,
    dom: renderer.dom,
    renderRows: data.renderRows,
    rowKeyFn: data.rowKeyFn,
    rowKeyField: (data as unknown as { rowKeyField?: string | number | symbol }).rowKeyField,
    selectableData: data.selectableData,
    selectableFn: data.selectableFn,
    prePaginationExpandedData: data.prePaginationExpandedData,
    t: i18n.t,
    showSummary: config.mergedUiConfig.showSummary,
    summaryMethod: config.mergedUiConfig.summaryMethod,
    sumText: config.mergedUiConfig.sumText,
    grandTotalRow: config.mergedUiConfig.grandTotalRow,
    totalValueGetter: config.mergedUiConfig.totalValueGetter,
    suppressStickyTotalRow: config.mergedUiConfig.suppressStickyTotalRow,
    summaryData: data.prePaginationExpandedData,
    mergedLoading: config.mergedLoading,
    autoSizeColumns: config.mergedColumnConfig.autoSizeColumns ?? false,
    floatingFilter: config.mergedFilterConfig.floatingFilter,
    mergedBorder: config.mergedBorder ?? true,
    mergedResizable: config.mergedResizable ?? true,
    mergedEmptyText: config.mergedEmptyText,
    rowSelection: config.mergedRowConfig.rowSelection ?? 'multiple',
    sizeConfig: config.mergedSizeConfig,
    filterState: filterSort.filterState,
    sortState: filterSort.sortState,
    getSpanInfo: span.getSpanInfo,
    spanEnabled: span.spanEnabled,
    spanDynamicMode: props.spanDynamicMode,
    mergedSpanMethod: span.mergedSpanMethod,
    editConfig: props.editConfig,
    rowClassName: props.rowClassName,
    tooltipEffect: props.tooltipEffect,
    tooltipOptions: props.tooltipOptions,
    stripe: props.stripe ?? false,
    highlightCurrentRow: props.highlightCurrentRow ?? true,
    showHeader: props.showHeader ?? true,
    size: props.size,
    tableLayout: props.tableLayout,
    height: props.height,
    estimatedRowHeight: props.estimatedRowHeight,
    checkStatus: selection.checkStatus,
    slots,
  }
}

/**
 * <zh/> 渲染器属性——经工厂按能力分发；加第三种模式时只需在工厂登记，不改 SFC（模板禁 `isVirtual` 字面量，一律查 caps）
 * <en/> Renderer props — dispatched by capability via the factory; a third mode only registers in the factory (no `isVirtual` literals in template, query caps instead)
 */
const rendererProps = computed(() =>
  buildRendererProps(config.mode, rendererPropsDomains()),
)

//  侧边栏按钮配置 | Sidebar buttons config

/**
 * <zh/> 侧边面板是否启用任意一个 | <en/> Whether any side panel is enabled
 *
 * <zh/> 替代模板中三个 `||` 条件，语义更清晰。
 * <en/> Replaces three `||` conditions in template with a single semantic flag.
 */
const hasAnySidePanel = computed(() =>
  sidePanel.isSidePanelEnabled
  || sidePanel.isColumnSidePanelEnabled
  || sidePanel.isColumnGroupEnabled,
)

/**
 * <zh/> 1y 网格行列数——与模板原三重 ?? 口径一致，提取为 computed 避免模板复杂表达式 | <en/> a11y grid row/column counts — same caliber as the former template expression
 */
const ariaRowCount = computed(() =>
  data.pagination?.paginationTotal ?? data.renderRows?.length ?? data.visibleData?.length ?? 0,
)
const ariaColCount = computed(() =>
  (columns.columnClassification?.leafColumns?.length ?? 0) + (columns.columnClassification?.selection?.length ?? 0),
)

/**
 * <zh/> 侧边栏按钮列表——仅构建已启用的按钮，消除先构建后 filter 的中间数组；徽标预计算为布尔/字符串，模板零方法调用 | <en/> Sidebar button list — only builds enabled buttons; badges precomputed as plain values, zero method calls in template
 */
const sidebarButtons = computed(() => {
  const buttons: Array<{
    panel: 'filter' | 'column' | 'columnGroup'
    icon: typeof Filter
    label: string
    showBadge?: boolean
    badgeClass?: string
  }> = []

  if (sidePanel.isSidePanelEnabled) {
    buttons.push({
      panel: 'filter',
      icon: Filter,
      label: i18n.t('table.filter.panelTitle'),
      showBadge: sidePanel.hasActiveFilters,
      badgeClass: sidePanel.hasActiveFilters ? 'has-filter' : '',
    })
  }

  if (sidePanel.isColumnSidePanelEnabled) {
    buttons.push({
      panel: 'column',
      icon: Setting,
      label: i18n.t('table.columnSetting'),
    })
  }

  if (sidePanel.isColumnGroupEnabled) {
    buttons.push({
      panel: 'columnGroup',
      icon: Operation,
      label: i18n.t('table.columnGroup.title'),
    })
  }

  return buttons
})

//  共享筛选表单更新处理 | Shared filter form update handler

/**
 * <zh/> 安全处理共享筛选表单值更新——非 null 时才提交 | <en/> Safely handle shared filter form value update — only commits when non-null
 *
 * <zh/> ColumnFilterForm 使用 defineModel<ColumnFilterValue>，其 update:modelValue 事件类型为 ColumnFilterValue。
 * <zh/> 此处直接声明参数类型，无需类型断言 | <en/> ColumnFilterForm uses defineModel<ColumnFilterValue>, so the update:modelValue event type is ColumnFilterValue.
 * <en/> Declaring the parameter type directly, no type assertion needed.
 */
function handleSharedFilterUpdate(val: ColumnFilterValue | undefined): void {
  if (val != null) {
    shared.handleSharedFilterUpdate(val)
  }
}

//  暴露 API（白名单）| Expose API (allow-list)

// <zh/> 内部字段不进公开 expose：批量暂存（绕校验直写风险）/ 导入态 / 搜索表单实例仅域内使用。
// <zh/> 公开契约闸门见 `__type-guards__/api-contract.keys.ts`（internalExposeKeys + 双向比对）。
// <en/> Internal fields stay out of the public expose; see the contract gate in `api-contract.keys.ts`.
const {
  batchPendingChanges: _internalBatch,
  importing: _internalImporting,
  tableSearchRef: _internalSearchRef,
  ...publicApi
} = api
void _internalBatch
void _internalImporting
void _internalSearchRef

defineExpose({
  ...publicApi,
  version: ADV_TABLE_VERSION,
  tableRootRef,
} satisfies TableExpose<T>)
</script>

<template>
  <!--
    @remarks <zh/> 根节点承载 `renderer.rootAttrs`——即使用者的全部 `$attrs`（除保留键 `id`），
    <zh/> 与 Vue 单根组件的默认回落语义一致：`class`/`style`/`data-*`/`aria-*`/原生事件均在此生效。
    <zh/> 分页开关不在此处，而是由 `:pagination` 配置注入 `renderer.paginationAttrs`。
    <zh/> `id` 由 `config.tableId` 独占：本元素是 `#tableId` 选择器作用域根，被覆盖会导致适配器查询错域。
    <en/> The root carries `renderer.rootAttrs` — every user `$attrs` except the reserved `id`, matching Vue's
    <en/> single-root fallthrough semantics: `class`/`style`/`data-*`/`aria-*`/native listeners apply here.
    <en/> Pagination switches are not here; they are injected from `:pagination` as `renderer.paginationAttrs`.
    <en/> `id` belongs to `config.tableId` alone: this element is the `#tableId` selector scope root, and
    <en/> overriding it would misdirect adapter queries.
  -->
  <div
    :id="config.tableId"
    ref="tableRootRef"
    v-bind="renderer.rootAttrs"
    class="adv-table"
    :class="{
      'adv-table--range-selecting': interaction.isRangeSelecting,
      'adv-table--layout-bare': config.mergedContainerLayout === 'bare',
      [interaction.noSelectClass]: interaction.shiftKeyPressed,
    }"
    :style="config.sizeCssVars"
  >
    <TableSearch
      v-if="search.hasSearch"
      ref="tableSearchRef"
      v-model="search.searchParams"
      class="adv-table__form"
      :fields="search.mergedSearchFields"
      :components="config.mergedSearch.components"
      :buttons="config.mergedSearch.buttons ?? ['query', 'reset']"
      :label-width="config.mergedSearch.labelWidth"
      :collapsed="config.mergedSearch.collapsed ?? false"
      :debounce-time="config.mergedSearch.debounceTime ?? DEFAULT_SEARCH_DEBOUNCE"
      :search-text="config.mergedSearch.searchText ?? i18n.t('table.query')"
      :reset-text="config.mergedSearch.resetText ?? i18n.t('table.reset')"
      :span="config.mergedSearch.span ?? 6"
      @query="search.handleSearch"
      @change="handleSearchChange"
      @reset="search.handleReset"
    />

    <div class="adv-table__container">
      <!--
        @slot header-left - 表头左侧插槽
        @slot Header-left slot - left side of toolbar
        @slot header-right - 表头右侧插槽
        @slot Header-right slot - right side of toolbar
      -->
      <TableHeader
        :toolbar="config.toolbar"
        :has-columns="columns.hasColumns"
        :has-source="data.hasSource"
        :is-manual="config.isManual"
        :columns="columns.localColumns"
        :origin-columns="columns.originColumns"
        :origin-columns-format-map="columns.headerFormatMap"
        :reset-columns="columns.resetColumns"
        :is-polling="data.isPolling"
        :exporting="io.exporting"
        :exporting-csv="io.exportingCsv"
        :importing="io.importing"
        :printing="io.printing"
        :t="i18n.t"
        :has-header-left-slot="!!slots['header-left']"
        :has-header-right-slot="!!slots['header-right']"
        @refresh="data.refresh"
        @update:is-polling="handlePollingUpdate"
        @update:columns="handleColumnsUpdate"
        @export-excel="handleExportExcel"
        @export-csv="handleExportCsv"
        @import-data="handleImportData"
        @print="handlePrint"
        @column-visible="handleColumnVisible"
      >
        <template #header-left>
          <slot name="header-left" />
        </template>
        <template #header-right>
          <slot name="header-right" />
        </template>
      </TableHeader>

      <div
        v-if="!config.caps.declarativeColumns && !!slots.default"
        class="adv-table__virtual-slot-warning"
        role="alert"
      >
        <span>{{ i18n.t('table.virtualSlotIgnored') }}</span>
      </div>

      <div
        class="adv-table__body-row"
        :class="sidePanel.sideBarPositionClass"
      >
        <!--
          @remarks <zh/> a11y 网格语义：双模式统一 role/aria-rowcount/aria-colcount；rowcount 口径 paginationTotal ?? renderRows ?? visibleData，避免虚拟/默认跳变 | <en/> a11y grid semantics: unified role/aria-rowcount/aria-colcount; rowcount caliber paginationTotal ?? renderRows ?? visibleData to avoid virtual/default jumps
        -->
        <component
          :is="renderer.rendererComponent"
          v-if="!interaction.rendererHasError"
          :ref="renderer.setRendererRef"
          v-bind="rendererProps"
          class="adv-table__main"
          role="grid"
          :aria-rowcount="ariaRowCount"
          :aria-colcount="ariaColCount"
          :aria-label="i18n.t('table.ariaLabel')"
          v-on="renderer.rendererEvents"
          @end-reached="handleEndReached"
          @rows-rendered="handleRowsRendered"
        >
          <!--
            @slot default - 默认表格列插槽（仅 default 模式）
            @slot Default table column slot (default mode only)
            @remarks <zh/> 仅在 mode='default' 时渲染 ElTable 列 | <en/> Only rendered when mode='default'
          -->
          <slot v-if="config.caps.declarativeColumns" />
          <!--
            @slot empty - 空数据插槽
            @slot Empty slot - displayed when data is empty
            @binding {TableError|null} error - <zh/> 当前错误信息 | <en/> current error info
          -->
          <template
            v-if="slots.empty"
            #empty
          >
            <slot
              name="empty"
              :error="interaction.rendererErrorInfo"
            />
          </template>
          <!--
            @slot append - 尾部追加插槽
            @slot Append slot - appended after table body
          -->
          <template
            v-if="slots.append"
            #append
          >
            <slot name="append" />
          </template>
        </component>

        <!--
          @slot error - 渲染错误边界插槽
          @slot Error slot - rendered when renderer throws
          @binding {TableError|null} error - <zh/> 渲染错误信息 | <en/> render error info
          @binding {() => void} reset - <zh/> 重置错误边界并恢复渲染 | <en/> reset the error boundary and resume rendering
        -->
        <div
          v-else
          class="adv-table__error-boundary"
          role="alert"
          aria-live="assertive"
        >
          <slot
            name="error"
            :error="interaction.rendererErrorInfo"
            :reset="interaction.resetRendererError"
          >
            <span class="adv-table__error-text">{{ i18n.t('table.renderError') }}：{{ interaction.rendererErrorText }}</span>
          </slot>
        </div>

        <!--
          `activePanel` 是唯一可见性真源。**嵌套顺序是 `<Transition><KeepAlive>`，不可颠倒**——
          KeepAlive 只缓存它的**直接子节点**；若把 `<Transition>` 放在 KeepAlive 里面，KeepAlive 看到的是
          一个恒定的 Transition 包装，真正的 v-if 翻转发生在 Transition 内部，于是永远命中「普通卸载」分支
          （保留语义静默失效）。`sidePanelDestroyOnClose=false` 时传 `include=undefined`（全部缓存），
          关闭只走 deactivate，面板首次挂载实例与内部状态得以保留；默认 destroyOnClose=true 时传
          `include=[]`——空数组在 Vue 的 `matches()` 里恒为 false，KeepAlive 于是清掉
          `COMPONENT_SHOULD_KEEP_ALIVE` 直接透传，面板随 `activePanel` 归 null 真正卸载
          （同一表达式还顺手清理了旧缓存条目），无需复制一份面板模板。
          `activePanel` is the single source of truth. **The nesting must be
          `<Transition><KeepAlive>` and cannot be flipped** — KeepAlive only caches its *direct* child;
          with `<Transition>` on the inside, KeepAlive sees a constant wrapper and the real v-if flip
          happens inside Transition, so it always takes the plain-unmount branch and retention silently
          stops working. With `sidePanelDestroyOnClose=false` we pass `include=undefined` (cache
          everything) so closing only deactivates and the panel's first-mounted instance plus its internal
          state survive. With the default destroyOnClose=true we pass `include=[]` — always falsy under
          Vue's `matches()`, so KeepAlive drops SHOULD_KEEP_ALIVE and passes the child through, truly
          unmounting panels when `activePanel` returns to null (which also purges stale cache entries).
        -->
        <Transition
          name="adv-side-panel"
          mode="out-in"
        >
          <KeepAlive :include="sidePanel.keepPanelAlive ? undefined : NON_CACHING_INCLUDE">
            <FilterPanel
              v-if="sidePanel.activePanel === 'filter' && sidePanel.isSidePanelEnabled"
              key="filter"
              :columns="columns.effectiveColumns"
              :t="i18n.t"
              :position="sidePanel.activePanelPosition"
              @close="handleCloseSidePanel"
            />
            <ColumnSettingSidePanel
              v-else-if="sidePanel.activePanel === 'column' && sidePanel.isColumnSidePanelEnabled"
              key="column"
              :headers="columns.localColumns"
              :origin-columns="columns.originColumns"
              :origin-columns-format-map="columns.headerFormatMap"
              :reset-columns="columns.resetColumns"
              :position="sidePanel.activePanelPosition"
              @update:headers="handleUpdateHeaders"
              @column-visible="handleColumnVisible"
              @close="handleCloseSidePanel"
            />
            <ColumnGroupSidePanel
              v-else-if="sidePanel.activePanel === 'columnGroup' && sidePanel.isColumnGroupEnabled"
              key="columnGroup"
              :position="sidePanel.activePanelPosition"
              @close="handleCloseSidePanel"
            />
          </KeepAlive>
        </Transition>

        <div
          v-if="hasAnySidePanel"
          class="adv-table__side-buttons"
        >
          <button
            v-for="btn in sidebarButtons"
            :key="btn.panel"
            class="adv-table-side-button"
            :class="[
              sidePanel.activePanel === btn.panel ? 'adv-table-side-button--active' : '',
              sidePanel.activePanel === btn.panel ? sidePanel.sideButtonPositionModifier : '',
              btn.badgeClass ?? '',
            ]"
            :aria-label="btn.label"
            :aria-expanded="sidePanel.activePanel === btn.panel"
            aria-haspopup="dialog"
            :aria-controls="`adv-table-panel-${config.tableId}`"
            @click="sidePanel.togglePanel(btn.panel)"
          >
            <ElIcon class="adv-table-side-button__icon">
              <component :is="btn.icon" />
            </ElIcon>
            <span
              v-if="btn.showBadge"
              class="adv-table-side-button__badge"
            />
          </button>
        </div>
      </div>

      <!--
        @slot footer - 分页区域插槽
        @slot Footer slot - pagination area
        @binding {number} currentPage - <zh/> 当前页码 | <en/> current page
        @binding {number} pageSize - <zh/> 每页条数 | <en/> page size
        @binding {number} total - <zh/> 总条数 | <en/> total count
        @slot footer-extra - 分页额外插槽
        @slot Footer-extra slot - extra content beside pagination
      -->
      <TableFooter
        :pagination-enabled="config.mergedPagination.enabled ?? true"
        :pagination-class="data.pagination.paginationClass"
        :is-manual="config.isManual"
        :has-more="data.pagination.hasMore"
        :loading="config.mergedLoading"
        :t="i18n.t"
        :table-attrs="renderer.paginationAttrs"
        :element-size="config.elementSize"
        :pagination-ref="config.paginationRef"
        :current-page="data.pagination.currentPage"
        :page-size="data.pagination.pageSize"
        :page-sizes="data.pagination.pageSizes"
        :layout="data.pagination.localPageLayout"
        :total="data.pagination.paginationTotal"
        :has-footer-slot="!!slots.footer"
        :has-footer-extra-slot="!!slots['footer-extra']"
        @load-more="data.handleLoadMore"
        @update:current-page="data.handleCurrentPageChange"
        @update:page-size="data.handlePageSizeChange"
      >
        <template #footer="{ currentPage, pageSize, total: slotTotal }">
          <slot
            name="footer"
            :current-page="currentPage"
            :page-size="pageSize"
            :total="slotTotal"
          />
        </template>
        <template #footer-extra>
          <slot name="footer-extra" />
        </template>
      </TableFooter>
    </div>

    <ElTooltip v-bind="shared.sharedTooltip.tooltipProps">
      <template
        v-if="shared.sharedTooltip.formatterVNode"
        #content
      >
        <component :is="shared.sharedTooltip.formatterVNode" />
      </template>
    </ElTooltip>
    <ElTooltip v-bind="shared.sharedHeaderTooltip.tooltipProps" />
    <ElPopover v-bind="shared.sharedFilterPopover.popoverProps">
      <ColumnFilterForm
        v-if="shared.sharedFilterFormKey"
        :key="shared.sharedFilterFormKey"
        :column-key="shared.sharedFilterFormKey"
        :filter-type="shared.sharedFilterFormType"
        :model-value="shared.sharedFilterFormValue"
        :enum-options="shared.sharedFilterFormEnumOptions"
        :active="shared.sharedFilterFormActive"
        :t="i18n.t"
        @update:model-value="handleSharedFilterUpdate"
        @confirm="handleCloseFilterPopover"
        @reset="handleCloseFilterPopover"
      />
    </ElPopover>
    <ContextMenu
      :ref="setContextMenuRef"
      :visible="menu.menuVisible && interaction.isContainerVisible"
      :style="menu.menuStyle"
      :items="menu.currentItems"
      :params="menu.currentParams"
      :menu-token="menu.menuToken"
      @close="menu.closeMenu"
      @item-click="menu.onMenuItemClick"
    />
  </div>
</template>
