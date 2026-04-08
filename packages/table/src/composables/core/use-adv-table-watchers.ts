/**
 * @file use-adv-table-watchers.ts
 * @description <zh/> AdvTable watcher 装配域。
 * @description <en/> AdvTable watcher assembly.
 *
 * @remarks
 * <zh/> 调用顺序与原文件完全一致（分页校正 → modelUpdated → 取消编辑 → 共享 refetch → 切页 → 排序/筛选 refetch → 快筛 → mode 切换）。
 * <zh/> 必须在 setup 同步链内调用（`useModeSwitchBehavior` 内含 `watch(..., { flush: 'sync' })`，
 * <zh/> `remoteRefetch.dispose` 经 `onScopeDispose` 注册到当前 scope）。
 * <en/> Call order matches the original exactly. Must be invoked synchronously during setup.
 */
import type { Slots } from 'vue'
import type { AdvTableEmitFn } from '../../types'
import type { AdvTableProps } from '../../types/table-props'
import type { UseInteractionOrchestratorReturn } from '../interaction/use-interaction-orchestrator'
import type { UseSelectionOrchestratorReturn } from '../selection/use-selection-orchestrator'
import type { UseAdvTableModelRefs } from '../use-adv-table'
import type { UseAdvTableCoreReturn } from './use-adv-table-core'
import type { UseAdvTableDataColumnsReturn } from './use-adv-table-data-columns'
import type { UseAdvTableFeaturesReturn } from './use-adv-table-features'
import type { UseAdvTableSharedEditingReturn } from './use-adv-table-shared-editing'
import type { UseRendererIntegrationReturn } from './use-renderer-integration'
import { onScopeDispose, watch } from 'vue'
import { shallowEqualByValue } from '../../utils/equality'
import { createRemoteRefetchTrigger, watchFilterRefetch, watchSortChangeAndRefetch } from '../data/use-remote-refetch'
import { watchClientPaginationCorrection } from '../data/use-table-pagination'
import { watchCancelEditingOnDataRefresh } from './use-adv-table-shared-editing'
import { useModeSwitchBehavior } from './use-mode-switch-behavior'

export interface SetupAdvTableWatchersDeps<T> {
  props: AdvTableProps<T>
  models: UseAdvTableModelRefs<T>
  emitFn: AdvTableEmitFn
  tableEmit: AdvTableEmitFn
  slots: Slots
  core: UseAdvTableCoreReturn<T>
  dataColumns: UseAdvTableDataColumnsReturn<T>
  selection: UseSelectionOrchestratorReturn
  interaction: UseInteractionOrchestratorReturn
  sharedEditing: UseAdvTableSharedEditingReturn
  features: UseAdvTableFeaturesReturn<T>
  rendererIntegration: UseRendererIntegrationReturn<T>
}

export interface SetupAdvTableWatchersReturn {
  quickFilter: {
    setQuickFilter: (text: string) => void
    getQuickFilter: () => string
  }
}

/**
 * <zh/> 创建快速筛选的 getter/setter 对——封装 models.quickFilter 的读写。
 * <en/> Create quick filter getter/setter pair — encapsulates models.quickFilter read/write (moved from useAdvTable).
 */
function createQuickFilterApi<T>(models: UseAdvTableModelRefs<T>) {
  return {
    setQuickFilter: (text: string): void => {
      models.quickFilter.value = text
    },
    getQuickFilter: (): string => models.quickFilter.value ?? '',
  }
}

/**
 * <zh/> 装配全部跨域 watcher。
 * <en/> Assemble all cross-domain watchers (same order as the original useAdvTable, pure motion).
 */
export function setupAdvTableWatchers<T>(deps: SetupAdvTableWatchersDeps<T>): SetupAdvTableWatchersReturn {
  const { props, models, emitFn, tableEmit, core, dataColumns, sharedEditing, rendererIntegration, interaction } = deps

  /**
   * <zh/> 客户端分页校正——所有权在 pagination 模块，此处仅按显式依赖接线（调用顺序保持不变）
   * <en/> Client-side pagination correction — owned by the pagination module; wired here with explicit deps only (call order unchanged)
   */
  watchClientPaginationCorrection({
    displayLength: () => dataColumns.finalDisplayData.value.length,
    isClient: dataColumns.pagination.isClient,
    total: dataColumns.total,
    clientTotal: (dataColumns as { paginationClientTotal?: import('vue').Ref<number> }).paginationClientTotal,
    pageSize: dataColumns.pagination.pageSize,
    currentPage: dataColumns.pagination.currentPage,
    setCurrentPage: dataColumns.pagination.setCurrentPage,
  })

  /**
   * <zh/> 模型更新事件——与分页校正分离，仅触发事件不做状态修改
   * <zh/> 与 dataChange 语义不同：modelUpdated 每次 finalDisplayData 变更即发（含前端排序/筛选），dataChange 仅事务提交时发；前者面向渲染刷新，后者面向数据持久化，按需监听
   * <zh/> 时序注意：`immediate: true` 使**首次**发射发生在 setup 阶段（早于组件挂载与 gridReady），
   * <zh/> 故该回调内不得依赖 DOM 或渲染器 ref（需要挂载后能力请改听 `mounted` 类时机）。
   * <en/> Model updated event — separated from pagination correction, only emits event without state mutation
   * <en/> Distinct from dataChange: modelUpdated fires on every finalDisplayData change (client sort/filter), dataChange only on transaction commit; the former serves render refresh, the latter data persistence — listen as needed
   * <en/> Timing note: `immediate: true` makes the **first** emission happen during setup (before mount and
   * <en/> gridReady), so the callback must not rely on the DOM or renderer refs.
   */
  watch(dataColumns.finalDisplayData, () => {
    tableEmit('modelUpdated')
  }, { immediate: true })

  // <zh/> 数据刷新时取消进行中的编辑——所有权在编辑域，此处仅按显式依赖接线（调用顺序保持不变）
  // <en/> Cancel ongoing editing when data refreshes — owned by the editing domain; wired here with explicit deps only (call order unchanged)
  watchCancelEditingOnDataRefresh({
    tableData: dataColumns.tableData,
    hasPendingChanges: sharedEditing.hasPendingChanges,
    batchHasPending: sharedEditing.batchHasPending,
    cancelEditing: sharedEditing.cancelEditing,
  })

  /**
   * <zh/> 排序与筛选**共享**一个 refetch 触发器——同一批次（300ms 窗口）内的排序 + 筛选变更
   * <zh/> 合并为一次请求。此前两条链各持定时器，会产生一次被立即 abort 的冗余请求。
   * <zh/> `reason` 由各 watcher 逐次给出（`trigger('sort')` / `trigger('filter')`），
   * <zh/> 这里的 `'refresh'` 仅是无覆盖时的中性兜底。
   * <en/> Sort and filter **share** one refetch trigger — a sort + filter change inside the same
   * <en/> 300ms batch coalesces into a single request. Previously each chain held its own timer,
   * <en/> producing one redundant request that was aborted immediately. `reason` is supplied per call
   * <en/> by each watcher (`trigger('sort')` / `trigger('filter')`); the `'refresh'` here is only a
   * <en/> neutral fallback when no override is passed.
   */
  const remoteRefetch = createRemoteRefetchTrigger(
    {
      hasSource: () => dataColumns.hasSource.value,
      fetchData: dataColumns.fetchData,
      handleError: core.handleError,
    },
    'refresh',
  )
  // 共享防抖的唯一生命周期 owner：scope 释放时取消待请求
  onScopeDispose(() => remoteRefetch.dispose())

  /**
   * <zh/> 远程分页下排序/筛选改变了结果集，触发前先回到第 1 页，避免停留在越界页码拿到空页。
   * <zh/> **必须用纯状态 setter**（`pagination.setCurrentPage`）而非 `dataColumns.setCurrentPageAndRefetch`——
   * <zh/> 后者会经 `applyPaginationEffects` 立即发一次请求，与紧随其后的防抖 refetch 叠加成两次。
   * <en/> Under remote pagination a sort/filter changes the result set; return to page 1 before
   * <en/> triggering, so the view never lands on an out-of-range empty page.
   * <en/> This **must** use the pure state setter (`pagination.setCurrentPage`) rather than
   * <en/> `dataColumns.setCurrentPageAndRefetch` — the latter fires a request immediately through
   * <en/> `applyPaginationEffects`, stacking a second request on top of the debounced refetch.
   */
  const resetPageOnQueryChange = (): void => {
    dataColumns.pagination.setCurrentPage(1)
  }

  // <zh/> 排序变化监听与远程 refetch——所有权在数据域，此处仅按显式依赖接线（调用顺序保持不变）
  // <en/> Sort watching and remote refetch — owned by the data domain; wired here with explicit deps only (call order unchanged)
  watchSortChangeAndRefetch({
    sortState: dataColumns.sortState,
    columnByKeyMap: dataColumns.columnByKeyMap,
    hasSource: () => dataColumns.hasSource.value,
    fetchData: dataColumns.fetchData,
    handleError: core.handleError,
    emit: emitFn,
    tableId: () => core.tableId.value,
    refetch: remoteRefetch,
    resetPage: resetPageOnQueryChange,
    // <zh/> 本地列排序 + autoParams 关闭 + 非 manual 时跳过冗余 refetch（服务端必然忽略）
    // <en/> skip the redundant refetch for local-column sorts with autoParams off outside manual mode (the server provably ignores them)
    autoParamsEnabled: () => !!core.mergedRequest.value.autoParams,
    isManual: () => core.isManual.value,
  })

  // <zh/> 筛选变化远程 refetch——所有权在数据域，此处仅按显式依赖接线（调用顺序保持不变）
  // <en/> Filter-change remote refetch — owned by the data domain; wired here with explicit deps only (call order unchanged)
  watchFilterRefetch({
    filterState: dataColumns.filterState,
    hasSource: () => dataColumns.hasSource.value,
    fetchData: dataColumns.fetchData,
    handleError: core.handleError,
    refetch: remoteRefetch,
    resetPage: resetPageOnQueryChange,
  })

  /**
   * <zh/> 受控筛选模型——外部 `filterModel` → 内部 filterState 单向同步。
   * <zh/> 内容等值时跳过：消费方在 `filterChange` 监听器中回写等值模型不会形成回环；
   * <zh/> `immediate: true` 使受控模型在初始化时即生效（受控语义优先于列默认筛选值）。
   * <en/> Controlled filter model — external `filterModel` → internal filterState one-way sync.
   * <en/> Skips content-equal writes: a listener writing an equal model back inside `filterChange`
   * <en/> cannot loop; `immediate: true` applies the controlled model at init (controlled semantics
   * <en/> win over column-default filter values).
   */
  watch(() => props.filterModel, (model) => {
    if (model == null)
      return
    if (shallowEqualByValue(dataColumns.filterState.value, model))
      return
    dataColumns.filterState.value = { ...model }
  }, { immediate: true })

  /**
   * <zh/> 筛选变更事件——内部筛选实质变更后发射，与 `sortChange` 通知语义对称。
   * <zh/> 跳过首次触发（prev 为 undefined）与内容等值替换（noop→真实 composable 升级的 {}→{}、等值复写），
   * <zh/> 口径与 `watchFilterRefetch` 的 refetch 守卫一致。
   * <en/> Filter change event — emitted on substantive internal filter changes, symmetric with
   * <en/> `sortChange` notification semantics. Skips the first trigger (prev undefined) and
   * <en/> content-equal swaps (noop→real upgrade {}→{}, equal rewrites), matching the
   * <en/> `watchFilterRefetch` refetch guard caliber.
   */
  watch(() => dataColumns.filterState.value, (next, prev) => {
    if (prev === undefined)
      return
    if (shallowEqualByValue(prev, next))
      return
    tableEmit('filterChange', { filterState: next })
  })

  //  模式切换行为 | Mode switch behavior

  const quickFilter = createQuickFilterApi(models)

  useModeSwitchBehavior({
    // <zh/> 归一化后的 core.mode 是唯一判别点——裸 props.mode 可能含 undefined/非法值，
    // <zh/> 会在 adapter 未换模的情况下空转触发清理 + 通知。
    // <en/> Normalized core.mode is the single discriminator — raw props.mode may carry
    // <en/> undefined/invalid values, tripping cleanup + notice while the adapter never switched.
    mode: () => core.mode.value,
    behavior: () => props.modeSwitchBehavior,
    cleanup: {
      cancelEditing: () => sharedEditing.cancelEditing('api'),
      resetShiftSelect: () => { interaction.resetInteractionState() },
      closeContextMenu: () => rendererIntegration.menu.closeMenu(),
      resetRangeSelection: () => { interaction.resetInteractionState() },
      hideSharedTooltip: () => sharedEditing.sharedTooltip.forceHide(),
      // 切 mode 只清 renderer error，不清空跨模式业务状态
      resetRendererError: () => { interaction.resetRendererError() },
    },
    notice: {
      notify: ({ from, to }) => core.handleError('TABLE_MODE_SWITCHED', { cause: { from, to } }),
      notifyError: ({ from, to }) => core.handleError('TABLE_MODE_SWITCH_FORBIDDEN', { cause: { from, to } }),
    },
  })

  return { quickFilter }
}
