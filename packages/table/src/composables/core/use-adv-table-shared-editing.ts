/**
 * <zh/> AdvTable 共享单例+编辑域子编排器 — tooltip/popover 共享实例、编辑编排、editor blur
 * <en/> AdvTable shared+editing domain sub-orchestrator — tooltip/popover shared instances, editing orchestration, editor blur
 *
 * @remarks
 * <zh/> 合并 SharedSingletons 和 EditingOrchestrator，因为 Editing 依赖 SharedSingletons 的 overflowTooltipApi。
 * <zh/> 依赖 editConfig/interceptor/tooltip 窄切片（入口由 props 组装，不持有全量 props）与
 * <zh/> Core 的 globalTableConfig/tableId/rowKeyFn/notify，
 * <zh/> DataColumns 的 effectiveColumns/renderData/tableData/invalidateQuickFilterRowCache/dataUpdateBridge/filterState 等，
 * <zh/> Interaction 的 isContainerVisible/isCellInRangeSelection/tableRootRef。
 *
 * <zh/> **编辑链适配器**：使用 `createEditingAdapter` 通过 `effectScope` 实现真正的懒加载。
 * <zh/> 当 `editConfig` 为 `undefined` 时，不创建编辑链（零 watch/computed/ref 开销），唯一渲染源 `renderRows` 透传 `renderData`，rowViewModels 使用存根（无编辑态）；
 * <zh/> 当 `editConfig` 有值时，在 `effectScope` 中创建完整编辑链的渲染数据和行视图模型。
 * <zh/> 消费侧通过包装器委托自动获取最新值，无需修改。
 *
 * <en/> Merges SharedSingletons and EditingOrchestrator because Editing depends on SharedSingletons' overflowTooltipApi.
 * <en/> Depends on narrow editConfig/interceptor/tooltip slices (assembled from props at the entry, never the full props) and
 * <en/> Core's globalTableConfig/tableId/rowKeyFn/notify,
 * <en/> DataColumns' effectiveColumns/renderData/tableData/invalidateQuickFilterRowCache/dataUpdateBridge/filterState etc.,
 * <en/> Interaction's isContainerVisible/isCellInRangeSelection/tableRootRef.
 *
 * <en/> **Editing adapter**: uses `createEditingAdapter` with `effectScope` for true lazy initialization.
 * <en/> When `editConfig` is `undefined`, the editing chain is NOT created (zero watch/computed/ref overhead); the single render source `renderRows` passes through `renderData` and rowViewModels use a stub (no editing state);
 * <en/> when `editConfig` is present, the full editing chain's render data and row view models are created inside an `effectScope`.
 * <en/> Consumers use wrapper delegates and automatically get the latest values without modification.
 */
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { AdvTableEmitFn } from '../../types'
import type { EnumFilterOption } from '../../types/column'
import type { CellEditStopReason, EditConfig } from '../../types/edit'
import type { ColumnFilterValue } from '../../types/filter'
import type { InterceptorConfig } from '../../types/interceptor'
import type { AdvTableProps } from '../../types/table-props'
import type { UseBatchCommitReturn } from '../editing/use-batch-commit'
import type { UseCellEditReturn } from '../editing/use-cell-edit'
import type { UseCellNavigationReturn } from '../editing/use-cell-navigation'
import type { UseCellValidateReturn } from '../editing/use-cell-validate'
import type { UseEditorResolverReturn } from '../editing/use-editor-resolver'
import type { UseInterceptorReturn } from '../editing/use-interceptor'
import type { UseInteractionOrchestratorReturn } from '../interaction/use-interaction-orchestrator'
import type { OverflowTooltipApi, useOverflowTooltip } from '../shared/use-overflow-tooltip'
import type { SharedFilterPopoverApi } from '../shared/use-shared-filter-popover'
import type { UseSharedHeaderTooltipReturn } from '../shared/use-shared-header-tooltip'
import type { UseAdvTableCoreReturn } from './use-adv-table-core'
import type { UseAdvTableDataColumnsReturn } from './use-adv-table-data-columns'
import { toValue, watch } from 'vue'
import { createEditingAdapter } from '../editing/create-editing-stub'
import { useSharedSingletons } from '../shared/use-shared-singletons'

export interface UseAdvTableSharedEditingOptions<T> {
  /**
   * <zh/> 编辑配置切片（透传编辑适配器，等价既往 `props.editConfig`） | <en/> Edit config slice (forwarded to the editing adapter, equivalent to the former `props.editConfig`)
   */
  editConfig: MaybeRefOrGetter<EditConfig | undefined>
  /**
   * <zh/> 拦截器配置切片（透传编辑适配器，等价既往 `props.interceptor`） | <en/> Interceptor config slice (forwarded to the editing adapter, equivalent to the former `props.interceptor`)
   */
  interceptor?: MaybeRefOrGetter<InterceptorConfig | undefined>
  /** <zh/> 提示效果（等价既往 `props.tooltipEffect`） | <en/> Tooltip effect (equivalent to the former `props.tooltipEffect`) */
  tooltipEffect: () => AdvTableProps<T>['tooltipEffect']
  /** <zh/> 提示选项（等价既往 `props.tooltipOptions`） | <en/> Tooltip options (equivalent to the former `props.tooltipOptions`) */
  tooltipOptions: () => AdvTableProps<T>['tooltipOptions']
  /** <zh/> 提示格式化器（等价既往 `props.tooltipFormatter`） | <en/> Tooltip formatter (equivalent to the former `props.tooltipFormatter`) */
  tooltipFormatter: () => AdvTableProps<T>['tooltipFormatter']
  emit: AdvTableEmitFn
  core: UseAdvTableCoreReturn<T>
  dataColumns: UseAdvTableDataColumnsReturn<T>
  interaction: UseInteractionOrchestratorReturn
}

/**
 * <zh/> 域契约：下游禁读内部字段——仅暴露编排入口与渲染集成实际消费的最小集合；
 * <zh/> 适配器内部的 copyApi / popoverApi / resolver / navigation / 行视图模型不在此列， downstream 不得依赖。
 * <en/> Domain contract: downstream must not read internal fields — only the minimal set consumed
 * <en/> by the orchestration entry and renderer integration is exposed; adapter internals
 * <en/> (copyApi / popover APIs / resolver / navigation / row view models) are intentionally absent.
 */
export interface UseAdvTableSharedEditingReturn<T = any> {
  /**
   * <zh/> 表级唯一溢出提示实例——仅暴露模板绑定与强制隐藏所需的成员
   * <zh/> （`api`（onCellEnter/onCellLeave）已由下方 `overflowTooltipApi` 单独承载）
   * <en/> The table-level single overflow-tooltip instance — only the members needed for template
   * <en/> binding and forced hiding are exposed (`api`, i.e. onCellEnter/onCellLeave, is carried
   * <en/> separately by `overflowTooltipApi` below)
   */
  sharedTooltip: Pick<ReturnType<typeof useOverflowTooltip>, 'tooltipProps' | 'formatterVNode' | 'forceHide'>
  sharedFilterPopover: SharedFilterPopoverApi
  sharedHeaderTooltip: UseSharedHeaderTooltipReturn
  sharedFilterFormKey: ComputedRef<string | null>
  sharedFilterFormType: ComputedRef<string>
  sharedFilterFormValue: ComputedRef<ColumnFilterValue>
  sharedFilterFormEnumOptions: ComputedRef<(() => EnumFilterOption[]) | undefined>
  sharedFilterFormActive: ComputedRef<boolean>
  handleSharedFilterUpdate: (val: ColumnFilterValue) => void
  overflowTooltipApi: OverflowTooltipApi
  validateApi: UseCellValidateReturn<T>
  interceptor: UseInterceptorReturn
  editApi: Pick<
    UseCellEditReturn<T>,
    'editingCell' | 'editingValue' | 'editingRowIndex'
    | 'startEditing' | 'stopEditing'
    | 'isColumnEditable' | 'isCellEditing'
    | 'getCellEditingValue' | 'updateCellEditingValue'
    | 'isCellDirty' | 'validateCurrentValue'
  > & Pick<
    UseEditorResolverReturn,
    'getEditorComponent' | 'getEditorSelectorParams'
  > & Pick<
    UseCellNavigationReturn,
    'findNextEditableCell' | 'findFirstEditableCell' | 'findLastEditableCell'
  > & {
    updateEditingValue: (val: unknown) => void
  }
  commitEditing: UseCellEditReturn<T>['commitEditing']
  cancelEditing: (reason: CellEditStopReason) => unknown
  submitEdit: () => Promise<void>
  discardEdit: () => void
  hasUnsavedChanges: () => boolean
  hasPendingChanges: ComputedRef<boolean>
  batchHasPending: ComputedRef<boolean>
  batchPendingChanges: ComputedRef<Map<string | number, Record<string, any>>>
  batchCommitCells: UseBatchCommitReturn['batchCommitCells']
  commitBatchEdit: () => Promise<void>
  cancelBatchEdit: () => void
  renderRows: ComputedRef<T[]>
  editUndo: () => boolean
  editRedo: () => boolean
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
}

/** <zh/> 内部展开形状（仅实现侧使用，不对外暴露） | <en/> Internal expanded shape (implementation side only, never exposed) */
interface UseAdvTableSharedEditingInternal<T = any> extends UseAdvTableSharedEditingReturn<T> {
  copyApi: unknown
  sharedFilterPopoverApi: unknown
  sharedHeaderTooltipApi: unknown
  editorResolverApi: unknown
  cellNavigationApi: unknown
  tableRowViewModels: unknown
  rowViewModelMap: unknown
}

/**
 * <zh/> AdvTable 共享单例 + 编辑域子编排器——组合共享 tooltip/popover 单例与编辑编排（懒加载适配器）。
 * <en/> AdvTable shared-singleton + editing domain sub-orchestrator — composes shared tooltip/popover
 * <en/> singletons with editing orchestration (lazy adapter).
 *
 * @param options - <zh/> 编辑/提示配置切片与各上游编排器返回值 | <en/> Edit/tooltip config slices and upstream orchestrator returns
 * @returns <zh/> 共享单例 API 与编辑域状态、方法集合 | <en/> Shared singleton APIs plus editing-domain state and methods
 */
export function useAdvTableSharedEditing<T>(options: UseAdvTableSharedEditingOptions<T>): UseAdvTableSharedEditingReturn<T> {
  const { editConfig, interceptor: interceptorInput, tooltipEffect, tooltipOptions, tooltipFormatter, emit: emitFn, core, dataColumns, interaction } = options

  //  1. 共享单例 | Shared singletons
  const {
    sharedTooltip,
    sharedFilterPopover,
    sharedHeaderTooltip,
    sharedFilterFormKey,
    sharedFilterFormType,
    sharedFilterFormValue,
    sharedFilterFormEnumOptions,
    sharedFilterFormActive,
    handleSharedFilterUpdate,
    overflowTooltipApi,
    copyApi,
    sharedFilterPopoverApi,
    sharedHeaderTooltipApi,
  } = useSharedSingletons({
    isContainerVisible: interaction.isContainerVisible,
    tooltipEffect,
    tooltipOptions: () => toValue(tooltipOptions) as Record<string, any> | undefined,
    tooltipFormatter,
    getFilterValue: dataColumns.getFilterValue,
    getEnumOptions: dataColumns.getEnumOptions,
    isColumnFiltered: dataColumns.isColumnFiltered,
    setFilter: dataColumns.setFilter,
    notify: core.notify,
  })

  //  2. 编辑编排 | Editing orchestration
  //  <zh/> 适配器通过 effectScope 实现懒加载，editConfig 缺失时零创建开销。
  //  <en/> Adapter uses effectScope for lazy initialization, zero creation overhead when editConfig is absent.
  const editingResult = createEditingAdapter<T>(
    {
      editConfig,
      interceptor: interceptorInput,
      globalTableConfig: core.globalTableConfig,
      effectiveColumns: dataColumns.effectiveColumns,
      // <zh/> 编辑域数据源 = 管线 renderData（pin 启用时已剔除 pinned 行）——
      // <zh/> 保证编辑/校验/批量暂存的行索引域与渲染器主体一致，且 pinned 行不
      // <zh/> 在固定区与主体重复出现（数据源约束：使用 renderData 而非 visibleData）。
      // <en/> Editing-domain data source = pipeline renderData (pinned rows extracted when pin
      // <en/> enabled) — keeps the row-index domain of editing/validation/batch staging aligned
      // <en/> with the renderer body and prevents pinned rows from appearing both in the fixed
      // <en/> region and the main body (source constraint: renderData, not visibleData).
      renderData: dataColumns.renderData,
      tableData: dataColumns.tableData,
      rowKeyFn: core.rowKeyFn,
      tableId: core.tableId,
      invalidateQuickFilterRowCache: dataColumns.invalidateQuickFilterRowCache,
      invalidateColumnFilterRowCache: dataColumns.invalidateColumnFilterRowCache,
      sharedTooltipApi: overflowTooltipApi,
      isCellInRangeSelection: interaction.isCellInRangeSelection,
      rangeSelectionRange: interaction.rangeSelectionRange,
      dataUpdateBridge: dataColumns.dataUpdateBridge,
      containerRef: interaction.tableRootRef,
      notify: core.notify,
      emit: emitFn,
    },
    dataColumns.renderData,
    dataColumns.effectiveColumns,
    core.rowKeyFn,
    interaction.isCellInRangeSelection,
  )

  const {
    validateApi,
    interceptor,
    editorResolverApi,
    cellNavigationApi,
    editApi,
    commitEditing,
    cancelEditing,
    submitEdit,
    discardEdit,
    hasUnsavedChanges,
    hasPendingChanges,
    batchHasPending,
    batchPendingChanges,
    batchCommitCells,
    commitBatchEdit,
    cancelBatchEdit,
    renderRows,
    undo: editUndo,
    redo: editRedo,
    canUndo,
    canRedo,
    tableRowViewModels,
    rowViewModelMap,
  } = editingResult

  // <zh/> 运行时保持全量返回，类型层面仅暴露域契约最小集合
  // <en/> Runtime keeps the full return; only the minimal domain contract is exposed at the type level
  const internal: UseAdvTableSharedEditingInternal<T> = {
    sharedTooltip,
    sharedFilterPopover,
    sharedHeaderTooltip,
    sharedFilterFormKey,
    sharedFilterFormType,
    sharedFilterFormValue,
    sharedFilterFormEnumOptions,
    sharedFilterFormActive,
    handleSharedFilterUpdate,
    overflowTooltipApi,
    copyApi,
    sharedFilterPopoverApi,
    sharedHeaderTooltipApi,
    validateApi,
    interceptor,
    editorResolverApi,
    cellNavigationApi,
    editApi,
    // <zh/> 非 editApi 字段独立暴露 | <en/> Non-editApi fields exposed independently
    commitEditing,
    cancelEditing,
    submitEdit,
    discardEdit,
    hasUnsavedChanges,
    hasPendingChanges,
    batchHasPending,
    batchPendingChanges,
    batchCommitCells,
    commitBatchEdit,
    cancelBatchEdit,
    renderRows,
    editUndo,
    editRedo,
    canUndo,
    canRedo,
    tableRowViewModels,
    rowViewModelMap,
  }
  // <zh/> 域契约收敛：对外仅暴露 UseAdvTableSharedEditingReturn（见上），内部字段不得外泄
  // <en/> Contract narrowing: only UseAdvTableSharedEditingReturn (above) is exposed; internals never leak
  return internal as unknown as UseAdvTableSharedEditingReturn<T>
}

/** <zh/> 显式域契约已在上定义（替代 ReturnType 推断） | <en/> Explicit domain contract defined above (replaces ReturnType inference) */

/**
 * <zh/> 数据刷新取消编辑守卫依赖——数据域引用 + 编辑域暂存状态（跨域守卫，所有权归编辑域）
 * <zh/> 守卫归属编辑域，“谁拥有取消语义”显式化
 * <en/> Data-refresh editing-guard deps — data-domain ref + editing-domain pending state (cross-domain guard, owned by the editing domain)
 * <en/> The guard belongs to the editing domain, making the cancel-ownership explicit
 */
export interface DataRefreshEditingGuardDeps<T> {
  /** <zh/> 全量数据引用（刷新/分页/reload 时变更） | <en/> Full-data ref (changes on refresh/pagination/reload) */
  tableData: Ref<T[]>
  /** <zh/> 是否存在未提交变更 | <en/> Whether uncommitted changes exist */
  hasPendingChanges: Ref<boolean>
  /** <zh/> 批量暂存是否有 pending | <en/> Whether batch staging has pending */
  batchHasPending: Ref<boolean>
  /** <zh/> 取消编辑 | <en/> Cancel editing */
  cancelEditing: (reason: CellEditStopReason) => unknown
}

/**
 * <zh/> 数据刷新时取消进行中的编辑——防止 Phase B 校验后写幽灵行；纯函数式装配，同输入同行为
 * <en/> Cancel ongoing editing when data refreshes — prevents ghost-row writes after Phase B validation; purely wiring, same input same behavior
 */
export function watchCancelEditingOnDataRefresh<T>(deps: DataRefreshEditingGuardDeps<T>): void {
  // <zh/> 点燃链：tableData 变化 → 本守卫取消编辑；use-edit-dirty 同源 watcher 同步剪除脏格（两条同源并行，无先后依赖）
  // <en/> Ignition chain: tableData change → this guard cancels editing; use-edit-dirty's same-source watcher prunes dirty cells in parallel
  watch(() => deps.tableData.value, () => {
    if (deps.hasPendingChanges?.value || deps.batchHasPending?.value) {
      deps.cancelEditing('api')
    }
  }, { flush: 'post' })
}
