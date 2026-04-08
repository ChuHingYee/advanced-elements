/**
 * @file use-adv-table.ts
 * @description <zh/> AdvTable 主编排器 — 组装所有子编排器，管理生命周期，暴露统一接口。
 * @description <en/> AdvTable main orchestrator — assembles all sub-orchestrators, manages lifecycle, exposes a unified interface.
 *
 * @architecture
 *   Core（配置/i18n/错误/引用）
 *     → DataColumns（列/数据/管线）
 *       → Selection（选择/跨页）
 *         → Interaction（键盘/错误边界/拖拽/范围选择）
 *           → SharedEditing（共享单例 + 编辑）
 *             → Features（搜索/导出/侧边栏）
 *               → RendererIntegration（渲染器集成/事件绑定/上下文 provide）
 *               → Watchers（分页校正/modelUpdated/远端 refetch/mode 切换，见 use-adv-table-watchers）
 *               → ApiAssembly（滚动/行高/实例 API，见 use-adv-table-api-assembly）
 *               → Lifecycle（配置校验/挂载卸载，见 use-adv-table-lifecycle）
 */
import type { Ref, Slots } from 'vue'
import type { AdvColumn, AdvTableEmitFn, ProcessedColumn } from '../types'
import type { AdvTableProps } from '../types/table-props'
import type { UseAdvTableFeaturesReturn } from './core/use-adv-table-features'
import type { UseAdvTableSharedEditingReturn } from './core/use-adv-table-shared-editing'
import { computed, nextTick, watch } from 'vue'
import { createTableEmitter } from '../utils/table-emitter'
import { resolveCellValue } from '../utils/value-pipeline'
import { assembleAdvTableApi, collectValidateRowValues as collectValidateRowValuesImpl } from './core/use-adv-table-api-assembly'
import { useAdvTableCore } from './core/use-adv-table-core'
import { useAdvTableDataColumns } from './core/use-adv-table-data-columns'
import { useAdvTableFeatures } from './core/use-adv-table-features'
import { setupAdvTableLifecycle } from './core/use-adv-table-lifecycle'
import { buildAdvTableProjection } from './core/use-adv-table-projection'
import { useAdvTableSharedEditing } from './core/use-adv-table-shared-editing'
import { setupAdvTableWatchers } from './core/use-adv-table-watchers'
import { createAndProvideContext, useRendererIntegration } from './core/use-renderer-integration'
import { useInteractionOrchestrator } from './interaction/use-interaction-orchestrator'
import { useSelectionOrchestrator } from './selection/use-selection-orchestrator'
import { useOverflowTooltipDelegation } from './shared/use-overflow-tooltip-delegation'

export interface UseAdvTableModelRefs<T> {
  quickFilter: Ref<string | undefined>
  /**
   * <zh/> 列双向模型——用户侧写入 `AdvColumn<T>[]`，内部列操作回写 `ProcessedColumn<T>[]`；
   * <zh/> 并集保证模板 `:columns` 绑定只要求用户形态（`AdvColumn<T>[] & (AdvColumn<T>[] | ProcessedColumn<T>[])`
   * <zh/> 化简为 `AdvColumn<T>[]`），否则显式导入组件的 TS 消费者永远无法通过 `:columns` 检查。
   * <en/> Bidirectional columns model — consumers write `AdvColumn<T>[]`, internal column ops write back
   * <en/> `ProcessedColumn<T>[]`; the union keeps the template `:columns` binding at the user-facing shape,
   * <en/> otherwise explicitly-imported TS consumers can never satisfy the `:columns` check.
   */
  columns: Ref<AdvColumn<T>[] | ProcessedColumn<T>[] | undefined>
  data: Ref<T[] | undefined>
  loading: Ref<boolean | undefined>
  searchValues: Ref<Record<string, unknown> | undefined>
  /** <zh/> 受控选中键（v-model:selectedRowKeys） | <en/> Controlled selection keys  */
  selectedRowKeys: Ref<(string | number)[] | undefined>
}

export interface UseAdvTableOptions<T> {
  props: AdvTableProps<T>
  emit: AdvTableEmitFn
  models: UseAdvTableModelRefs<T>
  slots: Slots
}

/**
 * <zh/> 收集行校验值——纯函数，可单测；仅取可编辑且有编辑器与 prop 的列
 * <en/> Collect row validation values — pure and unit-testable; only editable columns with an editor and prop
 *
 * @remarks <zh/>  canonical 实现见 use-adv-table-api-assembly，此处 re-export 保持既有导入路径零破坏。
 */
export const collectValidateRowValues = collectValidateRowValuesImpl

/**
 * <zh/> AdvTable 主编排器——组装所有子编排器，管理生命周期，暴露统一接口。
 *
 * <en/> AdvTable main orchestrator — assembles all sub-orchestrators, manages lifecycle, exposes unified interface.
 */
export function useAdvTable<T>(options: UseAdvTableOptions<T>) {
  const { props, emit: emitFn, models, slots } = options

  // ── 1. Core 域：配置合并、i18n、错误处理、渲染器引用 ──
  const core = useAdvTableCore<T>({ props, emit: emitFn, models })
  const tableEmit = createTableEmitter(emitFn, core.tableId)

  // ── 2. Data+Columns 域：列编排、数据请求、数据管线 ──
  // <zh/> props 在此入口处拆为窄切片下发，子编排器不再持有全量 props（ISP）
  // <en/> props is split into narrow slices at this entry; sub-orchestrators no longer hold full props (ISP)
  const dataColumns = useAdvTableDataColumns<T>({
    columns: () => props.columns,
    urlState: () => props.urlState,
    fallbackData: () => props.data,
    treeConfig: () => props.treeConfig,
    propsLoading: () => props.loading,
    spanConfig: () => props.spanConfig,
    spanMethod: () => props.spanMethod,
    externalFilter: () => props.externalFilter,
    rowGroupConfig: () => props.rowGroupConfig,
    rowExpandConfig: () => props.rowExpandConfig,
    rowPinConfig: () => props.rowPinConfig,
    pagination: () => props.pagination,
    filterConfig: () => props.filterConfig,
    sortConfig: () => props.sortConfig,
    dataPipeline: () => props.dataPipeline,
    columnState: () => props.columnState,
    mode: () => props.mode,
    emit: emitFn,
    models,
    core,
  })

  // ── 3. Selection 域：单选/多选/全选/跨页选择 ──
  const selection = useSelectionOrchestrator<T>({
    rowKeyFn: core.rowKeyFn,
    tableData: dataColumns.tableData,
    rowKeyMeta: dataColumns.rowKeyMeta,
    selectableFn: core.selectableFn,
    mergedRowConfig: core.mergedRowConfig,
    // model 优先（v-model 绑定时与 prop 同步），未绑定时回退 prop
    selectedRowKeys: () => models.selectedRowKeys.value ?? props.selectedRowKeys,
    visibleData: () => dataColumns.visibleData.value,
    finalDisplayData: () => dataColumns.finalDisplayData.value,
    caps: core.rendererAdapter.caps,
    dom: core.rendererAdapter.dom,
    treeApi: dataColumns.treeApi,
    tableId: core.tableId,
    activeRenderer: core.activeRenderer,
    emit: emitFn,
  })

  /**
   * <zh/> 受控回写：内部选择提交后同步 `v-model:selectedRowKeys`。
   * <zh/> - 未提供 prop（非受控）：仅镜像到 model 并 emit update，内部态自治；
   * <zh/> - 提供了 prop（受控）：父组件经 v-model/监听同步即收敛；若父组件拒绝更新
   * <zh/>   （同 tick 后 prop 内容未变），回滚内部选择到父状态，实现真正受控。
   * <en/> controlled write-back: sync internal selection commits to
   * <en/> `v-model:selectedRowKeys`; revert to the parent state when the parent rejects the update.
   */
  function sameKeySet(a: readonly (string | number)[], b: readonly (string | number)[]): boolean {
    if (a.length !== b.length)
      return false
    return a.every((k, i) => String(k) === String(b[i]))
  }
  /**
   * <zh/> 回滚判定代际号——同一 tick 内连续两次提交时，旧回滚回调若直接按
   * <zh/> "prop 内容是否变化" 判定会误伤最新提交；用代际号只让最后一次提交的回滚生效。
   * <en/> Rollback verdict generation — with two commits in the same tick, an old rollback
   * <en/> callback judging by "did the prop change" can wrongly revert the newest commit;
   * <en/> a generation counter lets only the last commit's rollback run.
   */
  let rollbackGeneration = 0
  // <zh/> 等价序列化：getSelectedKeys 经 Set<string> 归一恒为 string[]，'\0' 不可能出现在行键中，
  // <zh/> 故 '\0' 分隔 join 与 JSON.stringify 触发时机完全一致（含顺序敏感），仅省去引号/转义分配。
  // <zh/> 禁止无分隔 join('')：['ab','c'] 与 ['a','bc'] 同为 'abc' 会误判相等跳过回写/回滚。
  // <en/> Equivalent serialization: keys are normalized strings, so '\0'-joined comparison triggers
  // <en/> identically to JSON.stringify (order-sensitive), minus quote/escape allocations.
  // <en/> Bare join('') is forbidden: ['ab','c'] and ['a','bc'] both yield 'abc' and would be misjudged equal.
  watch(
    () => selection.selectionState.getSelectedKeys().join('\0'),
    () => {
      const committed = selection.selectionState.getSelectedKeys()
      const prevModel = models.selectedRowKeys.value
      if (!(prevModel !== undefined && sameKeySet(prevModel, committed)))
        models.selectedRowKeys.value = [...committed]
      if (props.selectedRowKeys === undefined)
        return
      const parentBefore = props.selectedRowKeys
      const generation = ++rollbackGeneration
      void nextTick(() => {
        // 已有更新的提交，旧回滚作废 | a newer commit supersedes this rollback
        if (generation !== rollbackGeneration)
          return
        const parentNow = props.selectedRowKeys
        // 父组件已响应（内容变化）→ prop watch 自会收敛，不干预
        if (parentNow !== undefined && !sameKeySet(parentNow, parentBefore))
          return
        // 父组件拒绝更新 → 回滚内部选择到父状态
        selection.refreshSelection()
      })
    },
  )

  // ── 4. Interaction 域：键盘导航、错误边界、容器可见性、拖拽、范围选择 ──
  // <zh/> 有编辑会话时拖拽禁用——Interaction 先于 SharedEditing 创建，故用可变 holder 后绑定，避免循环依赖
  // <zh/>（Features 侧 hasUnsavedChanges 可直传是因其在 SharedEditing 之后创建）。
  // <en/> disable drag while editing — Interaction is created before SharedEditing, so bind via a mutable holder to avoid a cycle.
  const dragEditGuard: { get: () => boolean } = { get: () => false }
  const interaction = useInteractionOrchestrator<T>({
    caps: core.rendererAdapter.caps,
    dom: core.rendererAdapter.dom,
    tableId: core.tableId,
    mergedSizeConfig: core.mergedSizeConfig,
    mergedRowConfig: core.mergedRowConfig,
    mergedColumnConfig: core.mergedColumnConfig,
    rangeSelection: () => props.rangeSelection,
    tableData: dataColumns.tableData,
    rowKeyFn: core.rowKeyFn,
    rowKeyMeta: dataColumns.rowKeyMeta,
    reorderData: dataColumns.reorderData,
    localColumns: dataColumns.localColumns,
    setColumns: dataColumns.setColumns,
    activeRenderer: core.activeRenderer,
    // <zh/> 交互域取渲染域（pin 剔除后）——DOM 行列坐标由渲染器产出，与 renderData 同域
    // <en/> The interaction domain takes the render domain (post-pin) — DOM row/column coords come from the
    // <en/> renderer and share the renderData domain
    renderData: dataColumns.renderData,
    effectiveColumns: dataColumns.effectiveColumns,
    emit: emitFn,
    // <zh/> 窄探测器透传（调用时取值）+ 用户可见提示（notify），devWarn 由行拖拽内部下发
    // <en/> narrow probe passthrough (read at call time) plus user-visible notice; devWarn is emitted inside row drag
    isEditing: () => dragEditGuard.get(),
    onEditConflict: () => {
      try {
        core.notify(
          'warning',
          '请先完成编辑（提交/取消）后再拖拽排序 | Please finish editing (submit/cancel) before row-drag sorting.',
          'row-drag',
        )
      }
      catch {
        // <zh/> 通知通道异常不影响拖拽守卫 | <en/> Notice errors must not break the drag guard
      }
    },
  })

  // ── 5. Shared+Editing 域：tooltip/popover 共享实例、编辑编排 ──
  // <zh/> ISP 窄切片：仅透传 editConfig/interceptor/tooltip 切片与上游域契约返回值，不持有全量 props；
  // <zh/> 返回值收敛为显式域契约 UseAdvTableSharedEditingReturn（下游禁读内部字段），运行时保持不变
  // <en/> ISP narrow slices: only editConfig/interceptor/tooltip slices plus upstream domain-contract
  // <en/> returns are forwarded, never the full props; the return narrows to the explicit domain
  // <en/> contract UseAdvTableSharedEditingReturn (downstream must not read internals), runtime unchanged
  const sharedEditing: UseAdvTableSharedEditingReturn<T> = useAdvTableSharedEditing<T>({
    editConfig: () => props.editConfig,
    interceptor: () => props.interceptor,
    tooltipEffect: () => props.tooltipEffect,
    tooltipOptions: () => props.tooltipOptions,
    tooltipFormatter: () => props.tooltipFormatter,
    emit: emitFn,
    core,
    dataColumns,
    interaction,
  })

  // <zh/> 后绑定：编辑链就绪后接通拖拽禁用探测（含进行中会话 + 脏格 + batch 暂存，fail-open）
  // <en/> late binding: connect the drag-disable probe once the editing chain is ready (fail-open).
  dragEditGuard.get = () => {
    try {
      return !!sharedEditing.hasUnsavedChanges?.()
    }
    catch {
      return false
    }
  }

  // <zh/> 行索引换算（toRenderIndex/toRowKey）当前无跨 pin 调用方，保持 use-renderer-adapter 的
  // <zh/> -1/null 未知兜底；调用方出现时经 UseRendererAdapterOptions.toRenderIndex/toRowKey
  // <zh/> 显式注入真实实现（以 rowKeyFn + renderRows 为源），不做事后回填。
  // <en/> Index conversion (toRenderIndex/toRowKey) has no cross-pin caller yet, so the adapter's
  // <en/> -1/null unknown fallback stands; when a caller appears it injects the real implementation
  // <en/> explicitly via UseRendererAdapterOptions (sourced from rowKeyFn + renderRows), never backfilled.
  /**
   * <zh/> 溢出 tooltip 容器级事件委托——将 N×M 每格 mouseenter 闭包降为容器 2 个监听器。
   * <zh/> 行域取唯一渲染源 renderRows（与编辑/渲染同源），列域取 effectiveColumns（叶子列）；selection 列（-1）直接跳过。
   * <zh/> 单元格显示值口径与工厂单次取值一致：valueGetter 优先，否则 dataKey ?? prop 直取。
   * <en/> Overflow tooltip container delegation — collapses N×M per-cell closures into 2 container listeners.
   * <en/> Row domain reads the single render source renderRows (same source as editing/rendering); column domain uses effectiveColumns; selection col (-1) skipped.
   * <en/> Display-value caliber matches the factory single-resolution: valueGetter first, else dataKey ?? prop.
   */
  useOverflowTooltipDelegation({
    containerRef: interaction.tableRootRef,
    api: sharedEditing.overflowTooltipApi,
    resolveCell: (rowIndex, columnIndex) => {
      if (columnIndex < 0)
        return null
      const rows = sharedEditing.renderRows.value as T[]
      const row = (rows as T[])[rowIndex]
      if (row == null)
        return null
      const cols = dataColumns.effectiveColumns.value as ProcessedColumn[]
      const column = cols[columnIndex]
      if (column == null)
        return null
      /**
       * <zh/> 显示值口径与单元格工厂的单次取值一致：`valueGetter` 优先，否则 `dataKey ?? prop` 直取。
       * <zh/> `dataKey` 是虚拟列配置的内部别名、并未声明在 `AdvColumn` 上，故仅在此处单点收窄一次；
       * <zh/> `valueGetter` / `prop` 已是 `ProcessedColumn` 的公开字段，无需重复断言。
       * <en/> Display-value caliber matches the cell factory's single resolution: `valueGetter` first,
       * <en/> otherwise `dataKey ?? prop`. `dataKey` is a virtual-column-config internal alias that is
       * <en/> not declared on `AdvColumn`, so it is narrowed exactly once here; `valueGetter` and
       * <en/> `prop` are already public `ProcessedColumn` fields and need no further assertions.
       */
      const dataKey = (column as { dataKey?: string }).dataKey
      const cellValue = column.valueGetter
        ? resolveCellValue(row, column, rowIndex)
        : (row as Record<string, unknown>)[dataKey ?? column.prop ?? '']
      return {
        row,
        column,
        cellValue,
        // <zh/> TooltipFormatter 为第三方透传类型，边界豁免
        // <en/> TooltipFormatter is a third-party passthrough type, boundary exemption
        tooltipFormatter: (column as { tooltipFormatter?: any }).tooltipFormatter,
        disabled: false,
      }
    },
  })

  // ── 6. Features 域：搜索、导出、侧边栏 ──
  // <zh/> ISP 窄切片：仅透传 columns/search/toolbar 切片与上游域契约返回值；
  // <zh/> 返回值收敛为显式域契约 UseAdvTableFeaturesReturn（下游禁读内部字段），运行时保持不变
  // <en/> ISP narrow slices: only columns/search/toolbar slices plus upstream domain-contract returns;
  // <en/> the return narrows to the explicit domain contract UseAdvTableFeaturesReturn, runtime unchanged
  const features: UseAdvTableFeaturesReturn<T> = useAdvTableFeatures<T>({
    columns: () => props.columns,
    search: () => props.search,
    toolbar: () => props.toolbar,
    emit: emitFn,
    models,
    core,
    dataColumns,
    selection,
    interaction,
    // <zh/> 导出守卫：未提交的编辑值尚未写回数据源，导出会产出与界面矛盾的旧值。
    // <zh/> 仅传入一个窄 getter（Features 不整体依赖编辑域，调用顺序不变：SharedEditing 在前）。
    // <en/> Export guard: uncommitted edit values are not yet written back, so exporting would emit
    // <en/> stale values contradicting the UI. Only one narrow getter is passed (Features does not
    // <en/> depend on the editing domain as a whole; call order unchanged — SharedEditing comes first).
    hasUnsavedChanges: sharedEditing.hasUnsavedChanges,
  })

  // ── 7. Renderer Integration 域：渲染器事件绑定、ref 设置、属性透传、上下文 provide ──
  const rendererIntegration = useRendererIntegration<T>({
    pagination: () => props.pagination,
    menuConfig: () => props.menuConfig,
    editConfig: () => props.editConfig,
    emit: emitFn,
    core,
    dataColumns,
    selection,
    interaction,
    sharedEditing,
    features,
  })

  // ── provide 统一上下文 ──
  const performanceProfile = computed<'high' | 'low'>(() =>
    props.performanceProfile
    ?? (core.globalTableConfig.value as { performanceProfile?: 'high' | 'low' }).performanceProfile
    ?? 'high',
  )
  createAndProvideContext(dataColumns, selection, interaction, features, rendererIntegration.filterSortApi, performanceProfile)

  const { quickFilter } = setupAdvTableWatchers<T>({
    props,
    models,
    emitFn,
    tableEmit,
    slots,
    core,
    dataColumns,
    selection,
    interaction,
    sharedEditing,
    features,
    rendererIntegration,
  })

  const api = assembleAdvTableApi<T>({
    props,
    core,
    dataColumns,
    selection,
    features,
    sharedEditing,
    rendererIntegration,
    quickFilter,
  })

  setupAdvTableLifecycle<T>({
    props,
    slots,
    tableEmit,
    core,
    dataColumns,
    sharedEditing,
    interaction,
    rendererIntegration,
  })

  //  返回值经投影域组装| Return assembled via the projection domain

  return buildAdvTableProjection({
    core,
    dataColumns,
    selection,
    interaction,
    sharedEditing,
    features,
    rendererIntegration,
    quickFilter,
    slots,
    api,
  })
}

export type UseAdvTableReturn<T> = ReturnType<typeof useAdvTable<T>>
