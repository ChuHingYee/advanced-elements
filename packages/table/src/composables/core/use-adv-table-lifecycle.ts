/**
 * @file use-adv-table-lifecycle.ts
 * @description <zh/> AdvTable 生命周期 + 运行时配置校验域。
 * @description <en/> AdvTable lifecycle + runtime config validation.
 *
 * @remarks
 * <zh/> 必须在 setup 同步链内调用：含 `watch(..., { immediate: true })` 与
 * <zh/> `onMounted/onDeactivated/onActivated/onUnmounted` 注册；`getCurrentInstance()` 在同步链内捕获，
 * <zh/> 每次读取当前 vnode（父运行时增删监听跟随）。
 * <en/> Must be invoked synchronously during setup: contains immediate watchers and lifecycle
 * <en/> registrations; `getCurrentInstance()` is captured in the sync chain and the current vnode
 * <en/> is read per call.
 */
import type { Slots } from 'vue'
import type { AdvTableEmitFn } from '../../types'
import type { AdvTableProps } from '../../types/table-props'
import type { UseInteractionOrchestratorReturn } from '../interaction/use-interaction-orchestrator'
import type { UseAdvTableCoreReturn } from './use-adv-table-core'
import type { UseAdvTableDataColumnsReturn } from './use-adv-table-data-columns'
import type { UseAdvTableSharedEditingReturn } from './use-adv-table-shared-editing'
import type { UseRendererIntegrationReturn } from './use-renderer-integration'
import { getCurrentInstance, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, watch } from 'vue'
import { isBrowser } from '../../utils/env'
import { validateTableConfig } from './use-table-config-guard'

export interface SetupAdvTableLifecycleDeps<T> {
  props: AdvTableProps<T>
  slots: Slots
  tableEmit: AdvTableEmitFn
  core: UseAdvTableCoreReturn<T>
  dataColumns: UseAdvTableDataColumnsReturn<T>
  sharedEditing: UseAdvTableSharedEditingReturn
  interaction: UseInteractionOrchestratorReturn
  rendererIntegration: UseRendererIntegrationReturn<T>
}

/**
 * <zh/> 装配运行时配置校验 + 生命周期。
 * <en/> Assemble runtime config validation + lifecycle (moved from useAdvTable, order unchanged).
 */
export function setupAdvTableLifecycle<T>(deps: SetupAdvTableLifecycleDeps<T>): void {
  const { props, slots, tableEmit, core, dataColumns, sharedEditing, interaction, rendererIntegration } = deps

  // <zh/> 配置校验运行时化：响应式追踪 mode/数据规模/data/request source/default 插槽，
  // <zh/> 运行时动态变化同样触发校验；内置去重避免同一 code 重复告警。
  // <en/> Runtime config validation: reactively tracks mode / dataset size / data / request source /
  // <en/> default slot, so runtime changes re-run validation; built-in dedup avoids repeat warnings.
  const validationFiredCodes = new Set<string>()
  /**
   * <zh/> 父组件是否监听 `update:data`（即 `v-model:data` 或显式 `@update:data`）。
   *
   * <zh/> 实例在 setup 期捕获（`getCurrentInstance()` 在 setup 之后会返回 null，不能在 watcher 回调里调用），
   * <zh/> 但 props 每次调用都读**当前** vnode——父组件可在运行时增删该监听，受控性判定应随之变化。
   *
   * <en/> Whether the parent listens to `update:data` (`v-model:data` or an explicit `@update:data`).
   *
   * <en/> The instance is captured during setup (`getCurrentInstance()` returns null afterwards, so it cannot
   * <en/> be called inside a watcher callback), but props are read from the **current** vnode on every call
   * <en/> the parent may add or drop that listener at runtime and the controlled check should follow. The
   * <en/> previous setup-time snapshot kept reporting a stale answer after such a switch.
   */
  const instance = getCurrentInstance()
  const hasUpdateDataListener = (): boolean =>
    (instance?.vnode.props ?? {})['onUpdate:data'] != null
  /**
   * <zh/> 父组件是否监听 `update:columns`（即 `v-model:columns` 或显式 `@update:columns`）。
   * <zh/> 与 `hasUpdateDataListener` 同理：实例 setup 期捕获，每次读当前 vnode，运行时增删跟随。
   * <en/> Whether the parent listens to `update:columns` (`v-model:columns` or an explicit `@update:columns`).
   * <en/> Same as `hasUpdateDataListener`: instance captured during setup, current vnode read per call.
   */
  const hasUpdateColumnsListener = (): boolean =>
    (instance?.vnode.props ?? {})['onUpdate:columns'] != null
  watch(
    [
      /**
       * <zh/> 追踪能力表**对象身份**——两个 caps 为模块级常量，身份仅在模式切换时变化，
       * <zh/> 故无需展开成多个布尔源；校验逻辑内部按能力查询（见 validateTableConfig）。
       * <en/> Track the capability table's **identity** — the two caps objects are module-level constants,
       * <en/> so identity changes only on a mode switch; no need to expand into separate boolean sources
       * <en/> (validation itself queries capabilities, see validateTableConfig).
       */
      () => core.rendererAdapter.caps.value,
      () => dataColumns.tableData.value.length,
      () => props.data,
      () => props.columns,
      () => props.request?.source,
      () => props.editConfig,
      () => dataColumns.hasSource.value,
      () => slots.default,
      () => props.treeConfig,
      () => props.rowExpandConfig?.enabled,
      () => props.rowConfig?.rowKey,
      // <zh/> 单模式专属 prop——运行时变更同样需要重跑校验（dev 告警的条件随之更新）
      // <en/> Single-mode props — runtime changes must re-run validation too (the dev-warning conditions follow)
      () => props.size,
      () => props.tableLayout,
      () => props.estimatedRowHeight,
      // <zh/> columns 校验门控——拖拽/设置开关运行时变更同样重跑 | <en/> Columns-check gates — drag/setting toggles re-run validation too
      () => core.mergedColumnConfig.value.columnDraggable,
      () => core.toolbar.value.columnSetting,
      () => dataColumns.effectiveColumns.value,
      // <zh/> 服务端筛选页内语义——筛选激活态与 autoParams 开关运行时变更同样重跑 | <en/> server page-local filter semantics — filter-active state and the autoParams switch re-run validation too
      () => dataColumns.hasActiveFilter.value,
      () => props.request?.autoParams,
      // <zh/> 命名空间失配——显式 uiConfig.namespace 与 EP ConfigProvider namespace 运行时变更同样重跑 | <en/> Namespace mismatch — runtime changes of the explicit uiConfig.namespace and the EP ConfigProvider namespace re-run validation too
      () => props.uiConfig?.namespace,
      () => core.epNamespace.value,
    ],
    () => validateTableConfig({ props, core, dataColumns, slots, fired: validationFiredCodes, hasUpdateDataListener, hasUpdateColumnsListener }),
    { immediate: true },
  )

  /**
   * <zh/> 命名空间 DOM 实测——挂载后与可见行/适配器变化时，用适配器选择器在根内探测已渲染行。
   * <zh/> 数据非空却零命中，说明实际 DOM 类名与构造的选择器脱钩（自定义命名空间未配对 CSS 构建、
   * <zh/> 或 EP 改名），此时静默退化比报错更有害，故派发 TABLE_NAMESPACE_MISMATCH。
   * <zh/> 尽力而为的兜底：异步渲染器尚未解析、空数据、无根节点、选择器抛错时一律跳过
   * <zh/> （误报比漏报更有害）；与配置校验共用去重语义，同一成因持续成立时仅告警一次。
   * <en/> Namespace DOM probe — after mount and on visible-row/adapter changes, look for a rendered
   * <en/> row with the adapter selector inside the root. Non-empty data with zero hits means the live
   * <en/> DOM classes decoupled from the built selectors (unpaired custom-namespace CSS build, or an EP
   * <en/> rename); silent degradation is worse than noise here, so dispatch TABLE_NAMESPACE_MISMATCH.
   * <en/> Best-effort backstop: skip whenever the async renderer is unresolved, data is empty, the root
   * <en/> is absent, or the selector throws (a false positive is worse than a miss); shares the
   * <en/> report-once semantics — one warning per persistent cause.
   */
  const NAMESPACE_PROBE_KEY = 'NAMESPACE_DOM_PROBE'
  function probeNamespaceDom(): void {
    if (!isBrowser)
      return
    // <zh/> 渲染器异步（defineAsyncComponent）：实例引用未就位时行必然不存在，
    // <zh/> 此时探测必为误报，跳过并等待 active 就位后的 watch 再次触发。
    // <en/> Renderers are async (defineAsyncComponent): rows cannot exist before the instance ref
    // <en/> is set, so probing then is always a false positive — skip and let the post-active
    // <en/> watch re-trigger.
    if (core.rendererAdapter.active.value == null)
      return
    if (dataColumns.visibleData.value.length === 0) {
      validationFiredCodes.delete(NAMESPACE_PROBE_KEY)
      return
    }
    const root = document.getElementById(core.tableId.value)
    if (!root)
      return
    let selector = ''
    let hit = false
    try {
      selector = core.rendererAdapter.dom.value.getRowSelector()
      hit = root.querySelector(selector) != null
    }
    catch {
      return
    }
    if (hit) {
      validationFiredCodes.delete(NAMESPACE_PROBE_KEY)
      return
    }
    if (validationFiredCodes.has(NAMESPACE_PROBE_KEY))
      return
    validationFiredCodes.add(NAMESPACE_PROBE_KEY)
    core.handleError('TABLE_NAMESPACE_MISMATCH', {
      field: 'uiConfig.namespace',
      cause: {
        source: 'dom-probe',
        expectedSelector: selector,
        namespace: core.namespace.value,
        visibleRows: dataColumns.visibleData.value.length,
      },
    })
  }
  watch(
    [
      () => dataColumns.visibleData.value.length,
      () => core.rendererAdapter.dom.value,
      () => core.rendererAdapter.active.value,
    ],
    () => { void nextTick(() => probeNamespaceDom()) },
    { flush: 'post' },
  )

  onMounted(() => {
    tableEmit('gridReady')
    void nextTick(() => probeNamespaceDom())
  })

  onDeactivated(() => {
    sharedEditing.sharedTooltip.forceHide()
    rendererIntegration.menu.closeMenu()
    interaction.setDeactivated(true)
    sharedEditing.cancelEditing('api')
  })

  onActivated(() => {
    interaction.setDeactivated(false)
  })

  onUnmounted(() => {
    core.isUnmounted.value = true
    sharedEditing.cancelEditing('api')
  })
}
