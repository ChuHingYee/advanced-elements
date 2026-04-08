/**
 * <zh/> 渲染器集成编排器——跨域集成逻辑
 * <en/> Renderer integration orchestrator — cross-domain integration logic
 *
 * @remarks
 * <zh/> 职责：将 Core/DataColumns/Selection/Interaction/SharedEditing 各域的返回值
 * <zh/> 组装为渲染器所需的事件绑定、ref 设置、属性透传、上下文 provide；
 * <zh/> 主文件仅负责子编排器调用顺序和生命周期。
 *
 * <en/> Responsibility: assembles Core/DataColumns/Selection/Interaction/SharedEditing returns
 * <en/> into renderer event bindings, ref setters, attribute passthrough, and context provide;
 * <en/> the main file only handles sub-orchestrator call order and lifecycle.
 */
import type { Component, ComponentPublicInstance, ComputedRef, MaybeRefOrGetter } from 'vue'
import type { AdvTableEmitFn } from '../../types'
import type { EditConfig } from '../../types/edit'
import type { TableErrorCode } from '../../types/error'
import type { AdvTableProps } from '../../types/table-props'
import type { TableRendererExpose } from '../../utils/table-drag'
import type { UseClipboardHandlerReturn } from '../interaction/use-clipboard-handler'
import type { UseInteractionOrchestratorReturn } from '../interaction/use-interaction-orchestrator'
import type { RendererEventsDataPipelineApi, RendererEventsEditApi, RendererEventsSelectionApi } from '../rendering/use-table-renderer-events'
import type { UseSelectionOrchestratorReturn } from '../selection/use-selection-orchestrator'
import type { UseAdvTableCoreReturn } from './use-adv-table-core'
import type { UseAdvTableDataColumnsReturn } from './use-adv-table-data-columns'
import type { UseAdvTableFeaturesReturn } from './use-adv-table-features'
import type { UseAdvTableSharedEditingReturn } from './use-adv-table-shared-editing'
import { computed, onBeforeUnmount, onDeactivated, provide, toValue } from 'vue'
import { withHeaderDragEndHandler } from '../../components/renderer-core/event-bindings'
import {
  advTableColumnGroupKey,
  advTableCurrentRowKey,
  advTableFilterPanelKey,
  advTableFilterSortKey,
  advTableIsRowDraggingKey,
  advTableKey,
  advTablePerformanceProfileKey,
  advTableRangeSelectionKey,
  advTableRowExpandKey,
  advTableRowGroupKey,
  advTableRowPinKey,
  advTableSelectionKey,
  advTableToggleAllSelectionKey,
  advTableTreeKey,
} from '../../types/injection-keys'
import { createAsyncLoader } from '../../utils/async-feature'
import { useStableComputed } from '../../utils/composable-helpers'
import { markRawTyped } from '../../utils/shared'
import { useContextMenuOrchestrator } from '../features/use-context-menu-orchestrator'
import { useTableRendererEvents } from '../rendering/use-table-renderer-events'
import { useTableAttrs } from './use-table-attrs'

export interface UseRendererIntegrationOptions<T> {
  /** <zh/> 分页透传配置（等价既往 `props.pagination`，仅 tableAttrs 读取其 4 个透传字段） | <en/> Pagination passthrough config (equivalent to the former `props.pagination`; only 4 forwarded fields are read by tableAttrs) */
  pagination: MaybeRefOrGetter<AdvTableProps<T>['pagination']>
  /** <zh/> 右键菜单配置（等价既往 `props.menuConfig`） | <en/> Context menu config (equivalent to the former `props.menuConfig`) */
  menuConfig: () => AdvTableProps<T>['menuConfig']
  /** <zh/> 编辑配置（等价既往 `props.editConfig`，渲染器事件按列判定可编辑性） | <en/> Edit config (equivalent to the former `props.editConfig`, used by renderer events to decide cell editability) */
  editConfig: MaybeRefOrGetter<EditConfig | undefined>
  emit: AdvTableEmitFn
  core: UseAdvTableCoreReturn<T>
  dataColumns: UseAdvTableDataColumnsReturn<T>
  selection: UseSelectionOrchestratorReturn
  interaction: UseInteractionOrchestratorReturn
  sharedEditing: UseAdvTableSharedEditingReturn
  /** <zh/> 功能域（导出/导入/打印），右键菜单内置操作依赖 | <en/> Features domain (export/import/print), needed by context menu builtins */
  features: UseAdvTableFeaturesReturn
}

export interface UseRendererIntegrationReturn<T> {
  /** <zh/> 渲染器组件（根据 isVirtual 切换） | <en/> Renderer component (switched by isVirtual) */
  rendererComponent: ComputedRef<Component>
  /** <zh/> 渲染器事件绑定（已包装 headerDragEnd handler） | <en/> Renderer event bindings (wrapped with headerDragEnd handler) */
  rendererEvents: Record<string, (...args: any[]) => void>
  /** <zh/> 渲染器 ref 设置函数 | <en/> Renderer ref setter */
  setRendererRef: (el: Element | ComponentPublicInstance | null) => void
  /**
   * <zh/> 透传给分页器的属性——仅由 `props.pagination` 注入的四个分页开关，不含 `$attrs`。
   * <en/> Attributes forwarded to the pagination bar — only the four pagination switches injected from
   * <en/> `props.pagination`, never `$attrs`.
   */
  paginationAttrs: ComputedRef<Record<string, unknown>>
  /**
   * <zh/> 归属表格根节点（`#tableId` 作用域根）的属性——`$attrs` 去掉保留键（`id`）后的全部内容。
   * <en/> Attributes owned by the table root (the `#tableId` scope root) — all of `$attrs` minus the
   * <en/> reserved `id` key.
   */
  rootAttrs: ComputedRef<Record<string, unknown>>
  /** <zh/> 筛选/排序 API（已 provide） | <en/> Filter/sort API (already provided) */
  filterSortApi: ReturnType<typeof createFilterSortApi>
  /** <zh/> 右键菜单状态与方法 | <en/> Context menu state and methods */
  menu: ReturnType<typeof useContextMenuOrchestrator<T>>
  /** <zh/> 剪贴板 API | <en/> Clipboard API */
  clipboardApi: UseClipboardHandlerReturn
}

/**
 * <zh/> 创建筛选/排序 API — markRaw 包裹的只读查询与操作方法集合
 * <en/> Create filter/sort API — markRaw-wrapped read-only query and operation methods
 */
function createFilterSortApi<T>(dataColumns: UseAdvTableDataColumnsReturn<T>, core: UseAdvTableCoreReturn<T>) {
  return markRawTyped({
    getFilterValue: dataColumns.getFilterValue,
    setFilter: dataColumns.setFilter,
    resetColumnFilter: dataColumns.resetColumnFilter,
    resetAllFilters: dataColumns.resetAllFilters,
    clearSort: dataColumns.clearSort,
    isColumnFiltered: dataColumns.isColumnFiltered,
    getEnumOptions: dataColumns.getEnumOptions,
    filterT: core.t,
    getSortOrder: dataColumns.getSortOrder,
    getSortIndex: dataColumns.getSortIndex,
    onToggleSort: dataColumns.toggleSort,
  })
}

/**
 * <zh/> 选择域上下文依赖——仅含渲染器事件所需的窄切片（显式数据流，便于单测）
 * <en/> Selection context deps — narrow slice required by renderer events only (explicit data flow, testable)
 */
export interface SelectionCtxDeps<T> {
  selectionState: RendererEventsSelectionApi<T>['selectionState']
  hasSelectionColumn: () => boolean
  suppressRowClickSelection: () => boolean
  rowClickSelect: () => boolean
}

/**
 * <zh/> 构建选择域上下文——纯函数，同输入同输出
 * <en/> Build the selection context — pure function, same input same output
 */
export function buildSelectionCtx<T>(deps: SelectionCtxDeps<T>): RendererEventsSelectionApi<T> {
  return {
    selectionState: deps.selectionState,
    hasSelection: deps.hasSelectionColumn,
    suppressRowClickSelection: deps.suppressRowClickSelection,
    rowClickSelect: deps.rowClickSelect,
  }
}

/**
 * <zh/> 编辑域上下文依赖——仅含渲染器事件所需的窄切片
 * <en/> Edit context deps — narrow slice required by renderer events only
 */
export interface EditCtxDeps {
  editConfig: RendererEventsEditApi['editConfig']
  isColumnEditable: RendererEventsEditApi['isColumnEditable']
  isCellEditing: RendererEventsEditApi['isCellEditing']
  startEditing: RendererEventsEditApi['startEditing']
  updateCellEditingValue: RendererEventsEditApi['updateCellEditingValue']
  commitEditing: RendererEventsEditApi['commitEditing']
  batchCommitCells: RendererEventsEditApi['batchCommitCells']
  undo: RendererEventsEditApi['undo']
  redo: RendererEventsEditApi['redo']
  canUndo: NonNullable<RendererEventsEditApi['canUndo']>
  canRedo: NonNullable<RendererEventsEditApi['canRedo']>
}

/**
 * <zh/> 构建编辑域上下文——纯函数，同输入同输出
 * <en/> Build the edit context — pure function, same input same output
 */
export function buildEditCtx(deps: EditCtxDeps): RendererEventsEditApi {
  return {
    editConfig: deps.editConfig,
    isColumnEditable: deps.isColumnEditable,
    isCellEditing: deps.isCellEditing,
    startEditing: deps.startEditing,
    updateCellEditingValue: deps.updateCellEditingValue,
    commitEditing: deps.commitEditing,
    batchCommitCells: deps.batchCommitCells,
    undo: deps.undo,
    redo: deps.redo,
    canUndo: deps.canUndo,
    canRedo: deps.canRedo,
  }
}

/**
 * <zh/> 数据管线上下文依赖——仅含渲染器事件所需的窄切片
 * <en/> Pipeline context deps — narrow slice required by renderer events only
 */
export interface PipelineCtxDeps<T> {
  effectiveColumns: RendererEventsDataPipelineApi<T>['effectiveColumns']
  columnByKey: RendererEventsDataPipelineApi<T>['columnByKey']
  visibleData: RendererEventsDataPipelineApi<T>['visibleData']
  rowKeyFn: RendererEventsDataPipelineApi<T>['rowKeyFn']
  rowKeyMeta: RendererEventsDataPipelineApi<T>['rowKeyMeta']
  toggleSort: RendererEventsDataPipelineApi<T>['toggleSort']
  shiftKeyPressed: RendererEventsDataPipelineApi<T>['shiftKeyPressed']
  toggleCollapse: RendererEventsDataPipelineApi<T>['toggleCollapse']
}

/**
 * <zh/> 构建数据管线上下文——纯函数，同输入同输出
 * <en/> Build the pipeline context — pure function, same input same output
 */
export function buildPipelineCtx<T>(deps: PipelineCtxDeps<T>): RendererEventsDataPipelineApi<T> {
  return {
    effectiveColumns: deps.effectiveColumns,
    columnByKey: deps.columnByKey,
    visibleData: deps.visibleData,
    rowKeyFn: deps.rowKeyFn,
    rowKeyMeta: deps.rowKeyMeta,
    toggleSort: deps.toggleSort,
    shiftKeyPressed: deps.shiftKeyPressed,
    toggleCollapse: deps.toggleCollapse,
  }
}

/**
 * <zh/> 按域 provide——上帝上下文已删除，各域独立注入，新增跨层字段只加一层
 * <en/> provide per domain — the god context is removed; each domain injects independently.
 *
 * @remarks
 * <zh/> 形参只保留真正被 provide 消费的那些。此前 `core` / `sharedEditing` 在函数体里
 * <zh/> 只有 `void` 占位（死依赖，会让人误以为它们参与了装配），已随调用处一并删除。
 * <en/> parameters now only include what is actually provided. `core` / `sharedEditing` were
 * <en/> `void`-only placeholders (dead dependencies implying a role they never had) and were removed
 * <en/> together with their call-site arguments.
 */
function createAndProvideContext<T>(
  dataColumns: UseAdvTableDataColumnsReturn<T>,
  selection: UseSelectionOrchestratorReturn,
  interaction: UseInteractionOrchestratorReturn,
  features: UseAdvTableFeaturesReturn,
  filterSortApi: ReturnType<typeof createFilterSortApi>,
  performanceProfile: ComputedRef<'high' | 'low'>,
): void {
  provide(advTableKey, features.tableContext)
  provide(advTableSelectionKey, selection.selectionState)
  provide(advTableToggleAllSelectionKey, selection.toggleAllSelection)
  // <zh/> 双通道优先级：筛选排序状态经 renderer props 直供渲染器（主通道），本 inject 供深层消费（filter-panel/表头浮动筛选）；两处同源（filterSortApi），渲染器 props 为准
  // <en/> Dual-channel priority: filter/sort state goes to renderers via props (primary); this inject serves deep consumers; same source, renderer props win
  provide(advTableFilterSortKey, filterSortApi)
  provide(advTableFilterPanelKey, dataColumns.filterPanelApi)
  provide(advTableColumnGroupKey, dataColumns.columnGroupApi)
  provide(advTableTreeKey, dataColumns.treeApi)
  provide(advTableRowGroupKey, dataColumns.rowGroupApi)
  provide(advTableRowExpandKey, dataColumns.rowExpandApi)
  provide(advTableRowPinKey, dataColumns.rowPinApi)
  // <zh/> currentRow 唯一真源——选择编排器持有，渲染器经域键取同一引用
  // <en/> THE single currentRow source — owned by the selection orchestrator.
  provide(advTableCurrentRowKey, selection.currentRowRef)
  provide(advTablePerformanceProfileKey, performanceProfile)
  provide(advTableRangeSelectionKey, markRawTyped({
    isSelecting: interaction.isRangeSelecting,
    currentRange: interaction.rangeSelectionRange,
    isCellSelected: interaction.isCellInRangeSelection,
    // 范围选择 provide 形态与注入键声明不一致：上游补齐官方类型后收紧为精确类型并移除 as any
  }) as any)
  // <zh/> 行拖拽状态直传（同一 shallowRef 引用）——虚拟渲染器据此暂停失步看门狗
  // <en/> Row-drag state passed through (same shallowRef reference).
  provide(advTableIsRowDraggingKey, interaction.isRowDragging)
}

/**
 * <zh/> 根节点**保留**键——`id` 由 `uiConfig.tableId` 接管。
 *
 * <zh/> 表格根节点同时是 `#tableId` 选择器作用域根（DOM 适配器的行/表体查询全部以它为前缀），
 * <zh/> 若被使用者的 `id` 属性覆盖，适配器查询会整体落到错误作用域；其余 `$attrs` 一律归根节点。
 *
 * <en/> **Reserved** root keys — `id` is owned by `uiConfig.tableId`.
 *
 * <en/> The table root doubles as the `#tableId` selector scope root (every DOM-adapter row/body lookup is
 * <en/> prefixed by it); letting a user `id` override it would send those lookups to the wrong scope.
 * <en/> All remaining `$attrs` go to the root.
 */
const RESERVED_ROOT_ATTR_KEYS: readonly string[] = ['id']

/**
 * <zh/> 渲染器集成编排器——将各域返回值组装为渲染器事件绑定、ref 设置、属性分流与统一上下文 provide。
 * <en/> Renderer integration orchestrator — assembles domain returns into renderer event bindings,
 * <en/> ref setters, attribute routing and the unified context provide.
 *
 * @param options - <zh/> 各上游域的返回值与配置切片 | <en/> Upstream domain returns and config slices
 * @returns <zh/> 渲染器集成结果（事件绑定、属性分流、统一上下文等） | <en/> Integration result (event bindings, attribute routing, unified context, etc.)
 */
export function useRendererIntegration<T>(options: UseRendererIntegrationOptions<T>): UseRendererIntegrationReturn<T> {
  const { pagination, menuConfig, editConfig, emit: emitFn, core, dataColumns, selection, interaction, sharedEditing, features } = options

  // ── 渲染器组件与 ref 绑定（经渲染器适配器，机械分派单点化） ──
  // <en/> Renderer component & ref binding via the renderer adapter (single mechanical dispatch point)
  const rendererComponent = computed(() => core.rendererAdapter.component.value)

  // ── 渲染器 ref 设置 | Renderer ref setter ──
  function setRendererRef(el: Element | ComponentPublicInstance | null) {
    const instance = (el && '$el' in el) ? (el as unknown as TableRendererExpose) : null
    core.rendererAdapter.setRef(instance)
  }

  // ── 属性分流：$attrs → 表格根节点；分页开关 → 分页器（配置单通道） ──
  // <zh/> 此前把整包 `$attrs` 透传给分页条是接线错位：`<AdvTable class="...">` 的本意是定制表格容器
  // <zh/> （分页条另有 `paginationClass` prop），`data-*`/`aria-*` 落到分页条更是无人预期。
  // <zh/> 现按 Vue 单根组件的默认语义回落：除保留键外，`class`/`style`/`data-*`/`aria-*`/原生事件
  // <zh/> 全部归根节点；分页开关只认 `props.pagination`。
  // <en/> Attribute routing: `$attrs` → table root; pagination switches → pagination (config-only).
  // <en/> Routing the whole `$attrs` bundle to the pagination bar was a wiring mistake: `<AdvTable
  // <en/> class="...">` means "style the table container" (the pagination has its own `paginationClass`
  // <en/> prop), and `data-*`/`aria-*` landing on the pagination bar surprised everyone.
  // <en/> Behavior now follows Vue's single-root default: apart from reserved keys, `class`/`style`/
  // <en/> `data-*`/`aria-*`/native listeners all land on the root; pagination switches honor
  // <en/> `props.pagination` only (the bare-attr channel was a redundant second path).
  const rawTableAttrs = useTableAttrs(core.attrs)
  const rootAttrs = useStableComputed<Record<string, unknown>>(() => {
    const result: Record<string, unknown> = {}
    for (const key in rawTableAttrs.value) {
      if (!RESERVED_ROOT_ATTR_KEYS.includes(key))
        result[key] = rawTableAttrs.value[key]
    }
    return result
  })
  const paginationAttrs = useStableComputed<Record<string, unknown>>(() => {
    const result: Record<string, unknown> = {}
    const pagConfig = toValue(pagination)
    if (pagConfig?.background !== undefined)
      result.background = pagConfig.background
    else if (core.mergedPagination.value.background !== undefined)
      result.background = core.mergedPagination.value.background
    if (pagConfig?.hideOnSinglePage !== undefined)
      result['hide-on-single-page'] = pagConfig.hideOnSinglePage
    if (pagConfig?.pagerCount !== undefined)
      result['pager-count'] = pagConfig.pagerCount
    if (pagConfig?.disabled !== undefined)
      result.disabled = pagConfig.disabled
    return result
  })

  // ── filterSortApi ──
  const filterSortApi = createFilterSortApi(dataColumns, core)

  // ── 右键菜单 | Context menu ──
  const menu = useContextMenuOrchestrator<T>({
    menuConfig,
    effectiveColumns: dataColumns.effectiveColumns,
    selectionState: selection.selectionState,
    startEditing: sharedEditing.editApi.startEditing,
    updateCellEditingValue: sharedEditing.editApi.updateCellEditingValue,
    commitEditing: sharedEditing.commitEditing,
    applyColumnState: dataColumns.applyColumnState,
    resetColumnState: dataColumns.resetColumnState,
    clearSort: dataColumns.clearSort,
    resetColumnFilter: dataColumns.resetColumnFilter,
    resetAllFilters: dataColumns.resetAllFilters,
    exportCsv: features.exportCsv,
    exportExcel: features.exportExcel,
    triggerImport: features.triggerImport,
    doPrint: features.doPrint,
    interceptor: sharedEditing.interceptor,
    crossCutting: core.crossCutting,
    emit: emitFn,
  })

  // ── 共享域上下文对象 | Shared domain context objects ──
  // <zh/> 经纯 builder 组装——依赖显式收敛为窄切片，主流程仅负责接线
  // <en/> Assembled via pure builders — deps explicitly narrowed; the main flow only wires them
  const selectionCtx = buildSelectionCtx<T>({
    selectionState: selection.selectionState,
    hasSelectionColumn: () => dataColumns.columnClassification.value.selection.length > 0,
    suppressRowClickSelection: () => core.mergedRowConfig.value.suppressRowClickSelection ?? false,
    rowClickSelect: () => core.mergedRowConfig.value.rowClickSelect ?? true,
  })

  const editCtx = buildEditCtx({
    editConfig: () => toValue(editConfig),
    isColumnEditable: sharedEditing.editApi.isColumnEditable,
    isCellEditing: sharedEditing.editApi.isCellEditing,
    startEditing: sharedEditing.editApi.startEditing,
    updateCellEditingValue: sharedEditing.editApi.updateCellEditingValue,
    commitEditing: sharedEditing.commitEditing,
    batchCommitCells: sharedEditing.batchCommitCells,
    undo: sharedEditing.editUndo,
    redo: sharedEditing.editRedo,
    canUndo: () => sharedEditing.canUndo.value,
    canRedo: () => sharedEditing.canRedo.value,
  })

  const pipelineCtx = buildPipelineCtx<T>({
    effectiveColumns: () => dataColumns.effectiveColumns.value,
    columnByKey: () => dataColumns.columnByKeyMap.value,
    visibleData: () => dataColumns.renderData.value,
    rowKeyFn: () => core.rowKeyFn.value,
    rowKeyMeta: () => dataColumns.rowKeyMeta.value,
    toggleSort: dataColumns.toggleSort,
    shiftKeyPressed: interaction.shiftKeyPressed,
    toggleCollapse: dataColumns.toggleCollapse,
  })

  // ── 剪贴板 | Clipboard ──
  // <zh/> 同步壳 + 首次复制/剪切/粘贴时动态加载实现（setup 期无重量逻辑；卸载/失活清理经 cancelPendingCopy 转发）
  // <en/> Sync shell with implementation loading on first copy/cut/paste (no heavy logic at setup; unmount/deactivate cleanup forwards via cancelPendingCopy)
  const clipboardLoader = createAsyncLoader(() => import('../interaction/use-clipboard-handler').then(m => m.useClipboardHandler<T>({
    selection: selectionCtx,
    edit: editCtx,
    pipeline: pipelineCtx,
    emit: emitFn,
    // <zh/> 范围选区注入——Ctrl+C 在存在活动范围时优先复制矩形内容。
    // <zh/> rangeLastSelection 提供列配置，使复制出口能过敏感列咽喉（安全硬契约）。
    // <en/> Range-selection injection — Ctrl+C prefers the rectangle content when a range is active.
    // <en/> rangeLastSelection supplies column configs so the copy exit passes the sensitive-column
    // <en/> choke point (security contract).
    rangeLastSelection: () => {
      const sel = interaction.rangeLastSelection.value
      // <zh/> 透传 rows——剪切（Ctrl+X）约束"复制面 = 清水面"：按选区行×列清空，
      // <zh/> 而非清空所有选中行的全部可编辑列。
      // <en/> Forward rows — cut (Ctrl+X) keeps "cut surface = copy surface": clear the
      // <en/> range's rows × columns instead of every editable column of all selected rows.
      return sel ? { columns: sel.columns, tsv: sel.tsv, rows: sel.rows } : null
    },
  })))
  const clipboardApi: UseClipboardHandlerReturn = {
    handleClipboardCopy: (params) => {
      void clipboardLoader.load().then(api => api.handleClipboardCopy(params))
    },
    handleClipboardCut: params => clipboardLoader.load().then(api => api.handleClipboardCut(params)),
    handleClipboardPaste: params => clipboardLoader.load().then(api => api.handleClipboardPaste(params)),
    cancelPendingCopy: () => {
      clipboardLoader.current.value?.cancelPendingCopy()
    },
  }
  onBeforeUnmount(() => clipboardLoader.current.value?.cancelPendingCopy())
  onDeactivated(() => clipboardLoader.current.value?.cancelPendingCopy())

  // ── 渲染器事件 | Renderer events ──
  const { rendererEvents } = useTableRendererEvents<T>({
    selection: selectionCtx,
    edit: editCtx,
    pipeline: pipelineCtx,
    clipboard: clipboardApi,
    emit: emitFn,
    interceptor: sharedEditing.interceptor,
    onCellContextmenu: menu.handleCellContextmenu,
    onHeaderContextmenu: menu.handleHeaderContextmenu,
    tableId: () => core.crossCutting.tableId.value,
  })

  const rendererEventsBound = withHeaderDragEndHandler(rendererEvents, {
    emit: emitFn,
    // headerDragEnd 的 params 缺 EP 官方类型：上游补齐后收紧为精确类型
    onHeaderDragEnd: (params: any) => {
      /**
       * <zh/> default 模式列宽持久化：把拖拽结果写回列对象，使 getColumnState
       * <zh/> 能读取调整后的宽度（对齐 virtual 模式 use-column-resize.ts 的写回逻辑）。
       * <zh/> virtual 模式下此处为幂等写（useColumnResize 已写回同一值）。
       * <en/> Persist column width in default mode: write the drag result back to the
       * <en/> column object so getColumnState reads the adjusted width (mirrors the
       * <en/> virtual-mode write-back in use-column-resize.ts). Idempotent in virtual mode.
       */
      const col = params?.column
      const newWidth = params?.newWidth
      if (col && typeof newWidth === 'number') {
        col.width = newWidth
      }
      dataColumns.touchColumns()
    },
  })

  /**
   * <zh/> 渲染器内部能力失效 → 结构化 `error` 事件（EP 漂移的生产可观测通道）。
   *
   * <zh/> 虚拟渲染器探测 EP 原生行高重测入口（`resetAfterRowIndex`，EP 未公开）失败时，
   * <zh/> 该失效此前**只**走 dev 期 `console.warn`；且 `use-v2-row-height-reset` 的 `onUnavailable`
   * <zh/> 钩子从未被任何调用方装配——即便想上报也无处可报。生产环境因此完全静默：使用者只看到
   * <zh/> 「虚拟行高错乱」而无任何线索，EP 升级后无从归因。
   * <zh/> 现经 `rendererError` 事件汇入既有 `handleError` 通道（尊重 `errorStrategy`、走 i18n、
   * <zh/> 派发 `@error`），使「EP 内部结构漂移」成为消费方可编程感知的事件。
   * <zh/> `cause.reason` 区分三种不可用：固定行高网格/实例缺失（均为正常，非缺陷）与
   * <zh/> 无原生入口（**真正的 EP 漂移**，需按 EP-UPGRADE-CHECKLIST 排查）。
   *
   * <en/> Renderer internal-capability failure → structured `error` event (the production-observable
   * <en/> channel for EP drift).
   *
   * <en/> When the virtual renderer fails to probe EP's native row-height reset entry
   * <en/> (`resetAfterRowIndex`, unpublished by EP), that failure previously only reached a dev-mode
   * <en/> `console.warn`; worse, `use-v2-row-height-reset`'s `onUnavailable` hook was wired by no caller
   * <en/> at all, so there was nowhere to report even if it wanted to. Production was therefore
   * <en/> completely silent: users only saw "virtual row heights are wrong" with no way to attribute it
   * <en/> to an EP upgrade. It now flows through the `rendererError` event into the existing
   * <en/> `handleError` channel (honours `errorStrategy`, goes through i18n, emits `@error`), making EP
   * <en/> internal-structure drift programmatically perceivable. `cause.reason` separates the three
   * <en/> cases: fixed-height grid / missing instance (both benign) from no native entry
   * <en/> (**genuine EP drift**, investigate via EP-UPGRADE-CHECKLIST).
   */
  const rendererEventsWithError = {
    ...rendererEventsBound,
    rendererError: (code: TableErrorCode, cause?: Record<string, unknown>) => {
      if (cause)
        core.handleError(code, { cause })
      else
        core.handleError(code)
    },
  }

  return {
    rendererComponent,
    rendererEvents: rendererEventsWithError,
    setRendererRef,
    paginationAttrs,
    rootAttrs,
    filterSortApi,
    menu,
    clipboardApi,
  }
}

/**
 * <zh/> 导出上下文创建函数供 useAdvTable 调用
 * <en/> Export context creation function for useAdvTable to call
 */
export { createAndProvideContext, createFilterSortApi }
