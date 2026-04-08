/**
 * @file create-editing-stub.ts
 * @description
 * <zh/> 编辑链懒加载适配器——`editConfig` 缺失时以零开销存根透传（不创建任何 watch/computed/ref）；
 * <zh/> 出现时在 `effectScope` 内创建真实编辑链（其生命周期已从 `onUnmounted` 改为 `onScopeDispose`，
 * <zh/> 故随 `scope.stop()` 一并回收），再次消失时停止 scope 自动清理。
 * <zh/> 返回值经闭包委托到真实链：缺失时降级为 noop/常量，出现后自动指向真实实现。
 *
 * <en/> Lazy editing-chain adapter — a zero-cost stub passthrough (no watch/computed/ref at all) while
 * <en/> `editConfig` is absent; when it appears, the real chain is created inside an `effectScope`
 * <en/> (its lifecycles are `onScopeDispose`-based, so `scope.stop()` reclaims everything) and is
 * <en/> reclaimed when `editConfig` disappears again. Return values delegate via closures and degrade
 * <en/> to noop/constants while absent.
 */
import type { ComputedRef, EffectScope, Ref } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { ValidateError } from '../../types/edit'
import type { CellState, RowViewModel } from '../view-model/use-row-view-model'
import type { useEditingOrchestrator, UseEditingOrchestratorOptions } from './use-editing-orchestrator'
import { computed, effectScope, onScopeDispose, provide, shallowRef, toValue, watch } from 'vue'
import { advTableEditKey, advTableRowViewModelKey, advTableValidateErrorsKey } from '../../types/config'
import { markRawTyped } from '../../utils/shared'
import { buildRowViewModelMap } from '../view-model/build-row-view-model-map'
import { useRowViewModel } from '../view-model/use-row-view-model'

// <zh/> 存根常量——所有实例共享同一引用，避免重复创建
// <zh/> 只读共享：永不写入，写入必须经真实编辑链；数组已冻结，Map/Ref 必须按实例隔离（见函数内创建）
// <en/> Stub sentinels shared by all instances to avoid duplicate creation. Read-only: never mutate,
// <en/> writes must go through the real editing chain; the array is frozen while Maps/Refs stay per-instance.

/**
 * <zh/> 真实编辑链的返回形状——委托包装器的参数类型与键覆盖守卫均由它派生，
 * <zh/> 避免在 30 余处包装器里重复书写完整的 `ReturnType<typeof useEditingOrchestrator<T>>[...]` 索引类型。
 * <en/> Real editing-chain return shape — the delegation wrappers' parameter types and the
 * <en/> key-coverage guards derive from it instead of repeating the full indexed type in 30+ wrappers.
 */
type RealChain<T> = ReturnType<typeof useEditingOrchestrator<T>>

const EMPTY_ERRORS_ARR: ValidateError[] = Object.freeze([] as ValidateError[]) as ValidateError[]

/**
 * <zh/> 创建编辑链适配器
 *
 * <zh/> 使用 effectScope 实现真正的懒加载：editConfig 缺失时不创建编辑链（零 watch/computed/ref 开销），
 * <zh/> editConfig 出现时在 effectScope 中按需创建，editConfig 消失时停止 scope 自动清理。
 *
 * <zh/> 返回值通过包装器委托：函数包装为 `(...args) => realResult?.fn(...args)`，
 * <zh/> 响应式值包装为 `computed(() => realResult?.ref.value ?? fallback)`，
 * <zh/> 确保 editConfig 缺失时降级、出现时自动指向真实编辑链。
 *
 * @param options - <zh/> 完整编辑编排器选项 | <en/> Full editing orchestrator options
 * @param renderData - <zh/> 渲染域数据 computed——必须传数据管线的 renderData（pin 启用时已剔除 pinned 行），
 *                                      保证编辑链行索引域与渲染器主体一致 | <en/> Render-domain data computed —
 *                                      MUST be the pipeline's renderData (pinned rows extracted when pin enabled),
 *                                      keeping the editing chain's row-index domain aligned with the renderer body
 * @param effectiveColumns - <zh/> 有效列 ref | <en/> Effective columns ref
 * @param rowKeyFn - <zh/> 行 key 函数 computed | <en/> Row key function computed
 * @param isCellInRangeSelection - <zh/> 范围选择查询函数 | <en/> Range selection query function
 */
export function createEditingAdapter<T>(
  options: UseEditingOrchestratorOptions<T>,
  renderData: ComputedRef<T[]>,
  effectiveColumns: Ref<ProcessedColumn[]>,
  rowKeyFn: ComputedRef<(row: T) => string>,
  isCellInRangeSelection: (rowIndex: number, colIndex: number) => boolean,
) {
  /**
   * <zh/> 实例级空哨兵——禁止模块级共享可变 Map/Ref（多实例写即全页污染），每个适配器实例独立持有。
   * <en/> Per-instance empty sentinels — module-shared mutable Map/Ref would pollute all instances on write; each adapter owns its own.
   */
  const emptyPendingMap = new Map<string | number, Record<string, any>>()
  const nullEditingCellRef = shallowRef<import('../../types/edit').EditingCellState | null>(null)
  const nullEditingValueRef = shallowRef<unknown>(null)
  const nullEditingRowIndexRef = shallowRef<number | null>(null)

  const stubRendererData = computed(() => renderData.value)

  const { rowViewModels: stubRowViewModels } = useRowViewModel<T>({
    visibleData: stubRendererData,
    rowKeyFn: () => rowKeyFn.value,
    isCellEditing: () => false,
    isCellDirty: () => false,
    isCellSelected: (rowIndex, colIndex) => isCellInRangeSelection(rowIndex, colIndex),
    columns: computed(() => effectiveColumns.value.filter(c => c.selection !== true)),
  })

  const stubRowViewModelMap = computed<Map<string, readonly CellState[]>>(buildRowViewModelMap(stubRowViewModels))

  // <zh/> 前置条件：useCellEdit 的 onUnmounted 已改为 onScopeDispose（effectScope 兼容）
  // <en/> Prerequisite: useCellEdit's onUnmounted changed to onScopeDispose (effectScope compatible)

  const hasEditConfig = computed(() => toValue(options.editConfig) != null)

  /** <zh/> 编辑链 scope——懒创建，editConfig 出现时 run，消失时 stop | <en/> Editing chain scope — lazily created */
  let editScope: EffectScope | null = null
  /** <zh/> 卸载标志——在途加载完成后直接丢弃，不再创建孤儿链 | <en/> Unmounted flag — in-flight loads are discarded instead of creating orphan chains */
  let unmounted = false
  /** <zh/> 真实编辑链结果——editScope.run 后赋值，scope.stop 后置 null | <en/> Real editing chain result — assigned after editScope.run, nulled after scope.stop */
  const realResult = shallowRef<RealChain<T> | null>(null)

  /**
   * <zh/> 渲染数据桥接 ref——解决运行时 editConfig 激活时 rendererData 残留旧值的问题：
   * <zh/> realResult 是非响应式 let，computed 直接读取 realResult.rendererData 会在 post-flush 链初始化后失效，
   * <zh/> 改为写入此 shallowRef 并让 computed 读取，确保链创建/销毁/值变化时同步更新。
   * <en/> Renderer data bridge ref — fixes stale rendererData on runtime editConfig activation:
   * <en/> realResult is a non-reactive let, so a computed reading realResult.rendererData goes stale once the
   * <en/> post-flush chain initializes; writing to this shallowRef and reading it from the computed keeps it in sync.
   */
  const rendererDataRef = shallowRef<T[]>(renderData.value)

  let loadingChain: Promise<NonNullable<typeof realResult.value> | null> | null = null

  /**
   * <zh/> 按需加载编辑链——并发合并；门控在加载窗口内关闭则丢弃本次加载，失败记错后降级
   * <en/> Load the editing chain on demand — coalesces concurrency; loads finishing after the gate closed are discarded, failures degrade after logging
   */
  async function ensureEditingChain(): Promise<NonNullable<typeof realResult.value> | null> {
    if (realResult.value)
      return realResult.value
    if (!loadingChain) {
      loadingChain = (async () => {
        try {
          const mod = await import('./use-editing-orchestrator')
          if (unmounted || !hasEditConfig.value)
            return null
          editScope = effectScope()
          const result = editScope.run(() => mod.useEditingOrchestrator<T>(options))!
          realResult.value = result
          syncBridgeValues(result)
          return result
        }
        catch (err: unknown) {
          console.error('[AdvTable] editing chunk load failed:', err)
          return null
        }
        finally {
          loadingChain = null
        }
      })()
    }
    return loadingChain
  }

  /**
   * <zh/> 停止编辑链 scope，清理全部 effect + onScopeDispose 回调
   * <en/> Stop the editing chain scope, cleaning up all effects + onScopeDispose callbacks
   */
  function disposeEditingChain() {
    if (editScope) {
      editScope.stop()
      editScope = null
      realResult.value = null
    }
  }

  // <zh/> 组件卸载时确保 scope 被清理；在途加载直接丢弃，不再创建编辑链
  // <en/> Ensure scope cleanup on unmount; in-flight loads are discarded instead of creating chains
  onScopeDispose(() => {
    unmounted = true
    disposeEditingChain()
  })

  /**
   * <zh/> 唯一渲染源 renderRows——调用方禁止再做 `rendererData ?? renderData` 二选一：
   * <zh/> 有 editConfig 时为编辑叠加后数据（含 batch 挂起变更），无时透传 renderData。
   * <en/> The single render source renderRows — callers must not pick between two sources again:
   * <en/> edit-overlayed data (incl. staged batch changes) with editConfig, else passthrough renderData.
   */
  const renderRows = computed(() => {
    return hasEditConfig.value ? rendererDataRef.value : renderData.value
  })

  /** <zh/> provide 响应式桥接 | <en/> Provide reactive bridges */
  const errorsRef = shallowRef<ValidateError[]>(EMPTY_ERRORS_ARR)
  const rowViewModelsRef = shallowRef(stubRowViewModels.value)
  const rowViewModelMapRef = shallowRef(stubRowViewModelMap.value)

  /**
   * <zh/> 同步桥接值——加载完成/切换时把真实链状态写入桥接 ref
   * <en/> Sync bridge values — write real-chain state into bridge refs on load/toggle
   */
  function syncBridgeValues(result: NonNullable<typeof realResult.value>): void {
    errorsRef.value = result.validateApi.errors.value
    rowViewModelsRef.value = result.tableRowViewModels.value
    rowViewModelMapRef.value = result.rowViewModelMap.value
    rendererDataRef.value = result.rendererData.value
  }

  // <zh/> 初始创建——editConfig 在 setup 阶段已存在时即开始加载（异步，不阻塞首屏）
  // <zh/> 桥接值在加载完成后同步；此前 renderRows 透传 renderData，与既往行为一致
  // <en/> Initial creation — starts loading immediately when editConfig is already present at setup
  // <en/> (async, never blocks first paint); bridge values sync on completion, renderRows passes
  // <en/> through renderData meanwhile, same as before
  if (hasEditConfig.value) {
    void ensureEditingChain()
  }

  /**
   * <zh/> editConfig 切换时懒创建/销毁编辑链 + 同步桥接值
   * <en/> Lazily create/destroy the editing chain on editConfig toggle + sync bridge values
   */
  watch(hasEditConfig, (has, prev) => {
    if (has && !prev) {
      // <zh/> editConfig 从 undefined 变为有值——按需加载编辑链（桥接值在完成后同步） | <en/> editConfig transitioned from undefined to defined — load on demand (bridge values sync on completion)
      void ensureEditingChain()
    }
    else if (!has && prev) {
      // <zh/> editConfig 从有值变为 undefined——销毁编辑链，恢复存根 | <en/> editConfig transitioned from defined to undefined — dispose editing chain, restore stub
      disposeEditingChain()
      errorsRef.value = EMPTY_ERRORS_ARR
      rowViewModelsRef.value = stubRowViewModels.value
      rowViewModelMapRef.value = stubRowViewModelMap.value
      rendererDataRef.value = renderData.value
    }
  }, { flush: 'post' })

  /**
   * <zh/> 真实编辑链值同步——editConfig 存在时持续追踪 | <en/> Real chain value sync — continuously tracked when editConfig is present
   * <zh/> realResult 可能为 null（editConfig 缺失或 scope 已停止），通过可选链安全访问 | <en/> realResult may be null (editConfig absent or scope stopped), safely accessed via optional chaining
   */
  watch(
    [
      () => realResult.value?.validateApi.errors.value,
      () => realResult.value?.tableRowViewModels.value,
      () => realResult.value?.rowViewModelMap.value,
      () => realResult.value?.rendererData.value,
    ],
    ([errors, vms, map, renderData]) => {
      if (hasEditConfig.value && realResult.value && errors && vms && map) {
        errorsRef.value = errors
        rowViewModelsRef.value = vms
        rowViewModelMapRef.value = map
        // <zh/> renderData 可能为 undefined（渲染数据未生成），保留上一帧值 | <en/> renderData may be undefined (render data not yet produced), keep the previous value
        if (renderData)
          rendererDataRef.value = renderData
      }
    },
    { flush: 'post' },
  )

  /**
   * <zh/> 存根值同步源——editConfig 缺失时追踪存根 RowViewModel。
   * <zh/> computed 保证：真实链激活时求值为 null（不再求值重型 stub 链），
   * <zh/> 缺失时仅在 stub 依赖变化时重算（与原始 watch 触发时机一致）
   * <en/> Stub value sync source — tracks the stub RowViewModel while editConfig is absent.
   * <en/> The computed evaluates to null while the real chain is active (heavy stub chain not evaluated),
   * <en/> and only recomputes when its deps change while absent (same trigger timing as the original watch)
   */
  const stubSyncValue = computed<readonly [RowViewModel[], Map<string, readonly CellState[]>] | null>(() =>
    hasEditConfig.value
      ? null
      : [stubRowViewModels.value, stubRowViewModelMap.value] as const,
  )

  watch(
    stubSyncValue,
    (pair) => {
      if (pair && !hasEditConfig.value) {
        rowViewModelsRef.value = pair[0]
        rowViewModelMapRef.value = pair[1]
      }
    },
    { flush: 'post' },
  )

  provide(advTableValidateErrorsKey, errorsRef)
  provide(advTableRowViewModelKey, {
    rowViewModels: computed(() => rowViewModelsRef.value),
    getCellsByRowKey: (rowKey: string | number) => rowViewModelMapRef.value.get(String(rowKey)),
  })

  /**
   * <zh/> 懒 editApi——所有方法通过闭包委托到 realResult?.editApi
   * <zh/> editConfig 缺失时 realResult 为 null，方法降级为 noop
   * <zh/> editConfig 出现后 realResult 被赋值，方法自动指向真实编辑链
   *
   * <en/> Lazy editApi — all methods delegate to realResult?.editApi via closure
   * <en/> When editConfig absent, realResult is null and methods degrade to noop
   * <en/> After editConfig appears, realResult is assigned and methods auto-point to the real editing chain
   */
  const editApi = markRawTyped({
    get editingCell() { return realResult.value?.editApi.editingCell ?? nullEditingCellRef },
    get editingValue() { return realResult.value?.editApi.editingValue ?? nullEditingValueRef },
    get editingRowIndex() { return realResult.value?.editApi.editingRowIndex ?? nullEditingRowIndexRef },
    startEditing: (...args: Parameters<RealChain<T>['editApi']['startEditing']>) =>
      hasEditConfig.value
        ? ensureEditingChain().then(r => r ? r.editApi.startEditing(...args) : undefined)
        : Promise.resolve(),
    stopEditing: (...args: Parameters<RealChain<T>['editApi']['stopEditing']>) =>
      realResult.value ? realResult.value.editApi.stopEditing(...args) : undefined,
    getEditorComponent: (...args: Parameters<RealChain<T>['editApi']['getEditorComponent']>) =>
      realResult.value?.editApi.getEditorComponent(...args),
    isColumnEditable: (...args: Parameters<RealChain<T>['editApi']['isColumnEditable']>) =>
      realResult.value ? realResult.value.editApi.isColumnEditable(...args) : false,
    updateEditingValue: (...args: Parameters<RealChain<T>['editApi']['updateEditingValue']>) =>
      realResult.value?.editApi.updateEditingValue(...args),
    isCellEditing: (...args: Parameters<RealChain<T>['editApi']['isCellEditing']>) =>
      realResult.value ? realResult.value.editApi.isCellEditing(...args) : false,
    getCellEditingValue: (...args: Parameters<RealChain<T>['editApi']['getCellEditingValue']>) =>
      realResult.value?.editApi.getCellEditingValue(...args),
    updateCellEditingValue: (...args: Parameters<RealChain<T>['editApi']['updateCellEditingValue']>) =>
      realResult.value?.editApi.updateCellEditingValue(...args),
    findNextEditableCell: (...args: Parameters<RealChain<T>['editApi']['findNextEditableCell']>) =>
      realResult.value ? realResult.value.editApi.findNextEditableCell(...args) : null,
    findFirstEditableCell: (...args: Parameters<RealChain<T>['editApi']['findFirstEditableCell']>) =>
      realResult.value ? realResult.value.editApi.findFirstEditableCell(...args) : null,
    findLastEditableCell: (...args: Parameters<RealChain<T>['editApi']['findLastEditableCell']>) =>
      realResult.value ? realResult.value.editApi.findLastEditableCell(...args) : null,
    getEditorSelectorParams: (...args: Parameters<RealChain<T>['editApi']['getEditorSelectorParams']>) =>
      realResult.value?.editApi.getEditorSelectorParams(...args),
    isCellDirty: (...args: Parameters<RealChain<T>['editApi']['isCellDirty']>) =>
      realResult.value ? realResult.value.editApi.isCellDirty(...args) : false,
    validateCurrentValue: () =>
      realResult.value ? realResult.value.editApi.validateCurrentValue() : Promise.resolve(),
  })

  /**
   * <zh/> editApi 的 provide 必须晚于其定义（上方 281 行），故不能并入 266-270 的 provide 批次；
   * <zh/> 渲染层经 render-helpers.ts 的 `inject(advTableEditKey)` 解析编辑器组件，缺失该 provide 时两种模式编辑器均不渲染。
   * <en/> The editApi provide must follow its definition (line 281 above) and therefore cannot join the
   * <en/> 266-270 provide batch; the render layer resolves editor components via
   * <en/> `inject(advTableEditKey)` in render-helpers.ts — without it, editors render in neither mode.
   */
  provide(advTableEditKey, editApi)

  /**
   * <zh/> 懒 validateApi——errors 用桥接 ref，方法委托到 realResult
   * <en/> Lazy validateApi — errors uses bridge ref, methods delegate to realResult
   */
  const validateApi = {
    errors: errorsRef,
    validateCell: (...args: Parameters<RealChain<T>['validateApi']['validateCell']>) =>
      hasEditConfig.value
        ? ensureEditingChain().then(r => (r ? r.validateApi.validateCell(...args) : true))
        : Promise.resolve(true),
    validateRow: (...args: Parameters<RealChain<T>['validateApi']['validateRow']>) =>
      hasEditConfig.value
        ? ensureEditingChain().then(r => (r ? r.validateApi.validateRow(...args) : true))
        : Promise.resolve(true),
    validateAll: () =>
      hasEditConfig.value
        ? ensureEditingChain().then(r => (r ? r.validateApi.validateAll() : true))
        : Promise.resolve(true),
    clearErrors: (...args: Parameters<RealChain<T>['validateApi']['clearErrors']>) =>
      realResult.value?.validateApi.clearErrors(...args),
    getCellError: (...args: Parameters<RealChain<T>['validateApi']['getCellError']>) =>
      realResult.value?.validateApi.getCellError(...args),
    validateCrossField: (...args: Parameters<RealChain<T>['validateApi']['validateCrossField']>) =>
      hasEditConfig.value
        ? ensureEditingChain().then(r => (r ? r.validateApi.validateCrossField(...args) : true))
        : Promise.resolve(true),
    clearRowCrossFieldErrors: (...args: Parameters<RealChain<T>['validateApi']['clearRowCrossFieldErrors']>) =>
      realResult.value?.validateApi.clearRowCrossFieldErrors(...args),
    clearRowErrors: (...args: Parameters<RealChain<T>['validateApi']['clearRowErrors']>) =>
      realResult.value?.validateApi.clearRowErrors(...args),
    clearCellError: (...args: Parameters<RealChain<T>['validateApi']['clearCellError']>) =>
      realResult.value?.validateApi.clearCellError(...args),
  }

  /** <zh/> 懒 interceptor | <en/> Lazy interceptor */
  const interceptor = {
    trigger: (...args: Parameters<RealChain<T>['interceptor']['trigger']>) =>
      realResult.value ? realResult.value.interceptor.trigger(...args) : false,
  }

  /**
   * <zh/> 懒 editorResolverApi——用 computed 包装响应式字段，函数委托
   * <en/> Lazy editorResolverApi — reactive fields wrapped in computed, functions delegated
   */
  const editorResolverApi = {
    editableColumns: computed(() => realResult.value?.editorResolverApi.editableColumns.value ?? []),
    getEditorComponent: (...args: Parameters<RealChain<T>['editorResolverApi']['getEditorComponent']>) =>
      realResult.value?.editorResolverApi.getEditorComponent(...args),
    isColumnEditable: (...args: Parameters<RealChain<T>['editorResolverApi']['isColumnEditable']>) =>
      realResult.value ? realResult.value.editorResolverApi.isColumnEditable(...args) : false,
    getEditorSelectorParams: (...args: Parameters<RealChain<T>['editorResolverApi']['getEditorSelectorParams']>) =>
      realResult.value?.editorResolverApi.getEditorSelectorParams(...args),
  }

  /** <zh/> 懒 cellNavigationApi | <en/> Lazy cellNavigationApi */
  const cellNavigationApi = {
    findNextEditableCell: (...args: Parameters<RealChain<T>['cellNavigationApi']['findNextEditableCell']>) =>
      realResult.value?.cellNavigationApi.findNextEditableCell(...args),
    findFirstEditableCell: (...args: Parameters<RealChain<T>['cellNavigationApi']['findFirstEditableCell']>) =>
      realResult.value?.cellNavigationApi.findFirstEditableCell(...args),
    findLastEditableCell: (...args: Parameters<RealChain<T>['cellNavigationApi']['findLastEditableCell']>) =>
      realResult.value?.cellNavigationApi.findLastEditableCell(...args),
  }

  /**
   * <zh/> 编译期键覆盖守卫——真实链的子 API 新增成员而本适配器未再委托时，typecheck 直接失败。
   * <zh/> 值类型取 `unknown`：适配器刻意把部分方法 Promise 化（懒加载期间可异步等待），
   * <zh/> 与真实同步签名不兼容属预期，只校验键的存在性。
   * <en/> Compile-time key-coverage guard — typecheck fails when the real chain's sub-API gains a
   * <en/> member this adapter does not delegate. Values are typed `unknown` on purpose: the adapter
   * <en/> deliberately Promise-ifies some methods (awaitable while the lazy chain loads), so a
   * <en/> signature mismatch is expected and only key presence is checked.
   */
  const _keyCoverage: {
    editApi: Record<keyof RealChain<T>['editApi'], unknown>
    validateApi: Record<keyof RealChain<T>['validateApi'], unknown>
    editorResolverApi: Record<keyof RealChain<T>['editorResolverApi'], unknown>
    cellNavigationApi: Record<keyof RealChain<T>['cellNavigationApi'], unknown>
  } = { editApi, validateApi, editorResolverApi, cellNavigationApi }
  void _keyCoverage

  return {
    validateApi,
    interceptor,
    editorResolverApi,
    cellNavigationApi,
    editApi,
    // <zh/> 以下方法通过闭包委托——editConfig 缺失时降级为 noop | <en/> Methods delegate via closure — degrade to noop when editConfig absent
    commitEditing: (...args: Parameters<RealChain<T>['commitEditing']>) =>
      hasEditConfig.value
        ? ensureEditingChain().then(r => (r ? r.commitEditing(...args) : { applied: [], rejected: [] }))
        : Promise.resolve({ applied: [], rejected: [] }),
    cancelEditing: (...args: Parameters<RealChain<T>['cancelEditing']>) =>
      realResult.value?.cancelEditing(...args),
    submitEdit: () =>
      hasEditConfig.value
        ? ensureEditingChain().then(r => r ? r.submitEdit() : undefined)
        : Promise.resolve(),
    discardEdit: () =>
      realResult.value?.discardEdit(),
    hasUnsavedChanges: () =>
      realResult.value ? realResult.value.hasUnsavedChanges() : false,
    // <zh/> 响应式值用 computed 包装 | <en/> Reactive values wrapped in computed
    hasPendingChanges: computed(() => realResult.value?.hasPendingChanges.value ?? false),
    batchHasPending: computed(() => realResult.value?.batchHasPending.value ?? false),
    batchPendingChanges: computed(() => realResult.value?.batchPendingChanges.value ?? emptyPendingMap),
    batchCommitCells: (...args: Parameters<RealChain<T>['batchCommitCells']>) =>
      hasEditConfig.value
        ? ensureEditingChain().then(r => (r ? r.batchCommitCells(...args) : { applied: [], rejected: [] }))
        : Promise.resolve({ applied: [], rejected: [] }),
    saveCells: (...args: Parameters<RealChain<T>['saveCells']>) =>
      hasEditConfig.value
        ? ensureEditingChain().then(r => (r ? r.saveCells(...args) : { applied: [], rejected: [] }))
        : Promise.resolve({ applied: [], rejected: [] }),
    commitBatchEdit: () =>
      realResult.value ? realResult.value.commitBatchEdit() : Promise.resolve(),
    cancelBatchEdit: () =>
      realResult.value?.cancelBatchEdit(),
    renderRows,
    undo: () =>
      realResult.value ? realResult.value.undo() : false,
    redo: () =>
      realResult.value ? realResult.value.redo() : false,
    canUndo: computed(() => realResult.value?.canUndo.value ?? false),
    canRedo: computed(() => realResult.value?.canRedo.value ?? false),
    tableRowViewModels: computed<RowViewModel<T>[]>(() => rowViewModelsRef.value),
    rowViewModelMap: computed<Map<string, readonly CellState[]>>(() => rowViewModelMapRef.value),
  }
}

/** <zh/> 适配器返回类型 | <en/> Adapter return type */
export type EditingAdapterReturn = ReturnType<typeof createEditingAdapter<any>>
