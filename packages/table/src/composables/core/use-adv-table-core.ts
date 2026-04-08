/**
 * <zh/> AdvTable 核心域子编排器 — 配置合并、国际化、错误处理、渲染器引用
 * <en/> AdvTable core domain sub-orchestrator — config merging, i18n, error handling, renderer refs
 *
 * @remarks
 * <zh/> 职责单一：初始化全局配置（useTableConfig），并组合 5 个聚焦子 composable：
 * <zh/>   - useTableI18n（locale/dayjs）
 * <zh/>   - useTableErrorHandler（错误处理器）
 * <zh/>   - useTableRendererRefs（异步渲染器组件引用）
 * <zh/>   - useTableSearchState（搜索参数、快速筛选防抖）
 * <zh/>   - useTableRowKey（行 key 函数、CSS 变量、可选行判断）
 * <zh/> 不依赖其他域，是整个编排链的起点。
 *
 * <en/> Single responsibility: initializes global config (useTableConfig) and composes 5 focused sub-composables
 * <en/> (see above). Does not depend on other domains — it is the starting point of the orchestration chain.
 */
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { AdvTableEmitFn } from '../../types'
import type { AdvTableProps } from '../../types/table-props'
import type { DebugLogger } from '../../utils/debug-logger'
import type { NotifyFn } from '../../utils/notification'
import type { TableRendererExpose } from '../../utils/table-drag'
import type { DataTransactionReturn } from '../data/use-data-transaction'
import type { UseTableConfigReturn } from './use-table-config'
import type { UseTableErrorHandlerReturn } from './use-table-error-handler'
import type { UseTableI18nReturn } from './use-table-i18n'
import type { UseTableRendererRefsReturn } from './use-table-renderer-refs'
import { shallowRef, useAttrs } from 'vue'
import { DEFAULT_SEARCH_DEBOUNCE } from '../../constants'
import { createDebugLogger } from '../../utils/debug-logger'
import { resolveNotify } from '../../utils/notification'
import { useTableIdGuard } from '../../utils/table-id-registry'
import { useDataTransaction } from '../data/use-data-transaction'
import { useTableConfig } from './use-table-config'
import { useTableErrorHandler } from './use-table-error-handler'
import { useTableI18n } from './use-table-i18n'
import { useTableRendererRefs } from './use-table-renderer-refs'
import { useTableRowKey } from './use-table-row-key'
import { useTableSearchState } from './use-table-search-state'

export interface UseAdvTableCoreOptions<T> {
  /**
   * <zh/> 全量 props 保留——本域为配置归属域，直接喂给 useTableConfig 合并器；
   * <zh/> 下游子编排器一律只收窄切片（ISP），不得再透传全量 props
   * <en/> Full props retained — this domain owns config merging and feeds useTableConfig directly;
   * <en/> all downstream sub-orchestrators take narrow slices only (ISP), never the full props
   */
  props: AdvTableProps<T>
  emit: AdvTableEmitFn
  models: {
    quickFilter: Ref<string | undefined>
  }
}

export interface UseAdvTableCoreReturn<T = any> {
  // ── 合并配置 | Merged config ──
  mergedRequest: UseTableConfigReturn<T>['mergedRequest']
  mergedPagination: UseTableConfigReturn<T>['mergedPagination']
  mergedUiConfig: UseTableConfigReturn<T>['mergedUiConfig']
  mode: UseTableConfigReturn<T>['mode']
  isManual: UseTableConfigReturn<T>['isManual']
  hasColumnSearch: UseTableConfigReturn<T>['hasColumnSearch']
  requestMode: UseTableConfigReturn<T>['requestMode']
  toolbar: UseTableConfigReturn<T>['toolbar']
  elementSize: UseTableConfigReturn<T>['elementSize']
  namespace: UseTableConfigReturn<T>['namespace']
  epNamespace: UseTableConfigReturn<T>['epNamespace']
  tableId: UseTableConfigReturn<T>['tableId']
  globalTableConfig: UseTableConfigReturn<T>['globalTableConfig']
  mergedSizeConfig: UseTableConfigReturn<T>['mergedSizeConfig']
  mergedBorder: UseTableConfigReturn<T>['mergedBorder']
  mergedResizable: UseTableConfigReturn<T>['mergedResizable']
  mergedEmptyText: UseTableConfigReturn<T>['mergedEmptyText']
  mergedContainerLayout: UseTableConfigReturn<T>['mergedContainerLayout']
  mergedSearch: UseTableConfigReturn<T>['mergedSearch']
  mergedRowConfig: UseTableConfigReturn<T>['mergedRowConfig']
  mergedColumnConfig: UseTableConfigReturn<T>['mergedColumnConfig']
  mergedFilterConfig: UseTableConfigReturn<T>['mergedFilterConfig']

  // ── 国际化 | I18n ──
  t: UseTableI18nReturn['t']
  locale: UseTableI18nReturn['locale']
  dayjsLocaleName: UseTableI18nReturn['dayjsLocaleName']

  // ── 错误处理 | Error handling ──
  handleError: UseTableErrorHandlerReturn['handleError']

  // ── 渲染器引用 | Renderer refs ──
  TableRenderer: UseTableRendererRefsReturn['TableRenderer']
  TableVirtualRenderer: UseTableRendererRefsReturn['TableVirtualRenderer']
  tableRendererRef: ShallowRef<TableRendererExpose | null>
  tableVirtualRendererRef: ShallowRef<TableRendererExpose | null>
  activeRenderer: ComputedRef<TableRendererExpose | null>
  rendererAdapter: UseTableRendererRefsReturn['rendererAdapter']
  paginationRef: ShallowRef<any>

  // ── 行 key 与样式 | Row key & styles ──
  rowKeyFn: ComputedRef<(row: T) => string>
  /** <zh/> 显式字段型 rowKey 的字段名（冻结行直传 EP） | <en/> Explicit field rowKey name (passed straight to EP for frozen rows) */
  rowKeyField: ComputedRef<string | number | symbol | undefined>
  sizeCssVars: ComputedRef<Record<string, string>>

  // ── 搜索参数 | Search params ──
  searchParams: ShallowRef<Record<string, unknown>>
  quickFilterText: Ref<string | undefined>

  // ── 生命周期标志 | Lifecycle flag ──
  isUnmounted: ShallowRef<boolean>

  // ── 跨切面上下文 | Cross-cutting context ──
  /** <zh/> 捆绑 tableId/t/handleError/isUnmounted，减少下游编排器的参数数量 | <en/> Bundles tableId/t/handleError/isUnmounted, reducing parameter count for downstream orchestrators */
  crossCutting: import('../../types/orchestrator-context').CrossCuttingContext

  // ── 通知通道 | Notification channel ──
  /** <zh/> 通知通道——优先使用 globalConfig.notify，降级到 ElMessage | <en/> Notification channel — prefers globalConfig.notify, falls back to ElMessage */
  notify: NotifyFn

  // ── 调试日志器 | Debug logger ──
  /** <zh/> 调试日志器——受 `debug` prop 控制，开启后输出详细诊断信息 | <en/> Debug logger — controlled by `debug` prop, outputs detailed diagnostics when enabled */
  debug: DebugLogger

  // ── 数据事务管理器 | Data transaction manager ──
  /** <zh/> 数据变更事务管理器——确保 beforeDataChange → dataChange → afterDataChange 原子性 | <en/> Data change transaction manager — ensures atomic beforeDataChange → dataChange → afterDataChange */
  dataTransaction: DataTransactionReturn<T>

  // ── 其他 | Misc ──
  attrs: ReturnType<typeof useAttrs>
  selectableFn: ComputedRef<((row: T, index: number) => boolean) | undefined>
}

/**
 * <zh/> 创建 AdvTable 核心域编排器
 * <en/> Create AdvTable core domain orchestrator
 */
export function useAdvTableCore<T>(options: UseAdvTableCoreOptions<T>): UseAdvTableCoreReturn<T> {
  const { props, emit, models } = options

  // ── 生命周期标志 | Lifecycle flag ──
  const isUnmounted = shallowRef(false)

  // ── 合并配置 | Merged config ──
  const {
    mergedRequest,
    mergedPagination,
    mergedUiConfig,
    mode,
    isManual,
    hasColumnSearch,
    requestMode,
    toolbar,
    elementSize,
    namespace,
    epNamespace,
    tableId,
    globalTableConfig,
    mergedSizeConfig,
    mergedBorder,
    mergedResizable,
    mergedEmptyText,
    mergedContainerLayout,
    mergedSearch,
    mergedRowConfig,
    mergedColumnConfig,
    mergedFilterConfig,
  } = useTableConfig<T>(props)

  // ── 国际化 | I18n ──
  const { t, locale, dayjsLocaleName } = useTableI18n()

  // ── 错误处理 | Error handling ──
  // 传入 t 函数使错误消息与建议可通过 i18n 系统解析
  // tableId 传 computed 本体而非 .value 快照——uiConfig.tableId 运行时变更后日志前缀即时跟随
  // Pass t function so error messages and suggestions are resolved via the i18n system
  // Pass the tableId computed itself, not a .value snapshot — log prefix follows runtime uiConfig.tableId changes
  const { handleError } = useTableErrorHandler(emit, tableId, t)

  // ── 同页重复 tableId 检测 | Duplicate tableId detection ──
  // <zh/> 挂载在此处而非 useTableConfig：重复属于可恢复的配置错误，需经 handleError 进入
  // <zh/> error 事件流（warn 级，生产可观测）；注册表本身浏览器恒启用、SSR 跳过。
  // <en/> Mounted here rather than in useTableConfig: a duplicate is a recoverable config
  // <en/> error that must flow through handleError into the error-event stream (warn level,
  // <en/> production-observable); the registry itself is always on in browsers, skipped under SSR.
  useTableIdGuard(tableId, id =>
    handleError('TABLE_DUPLICATE_TABLE_ID', { field: 'tableId', cause: `duplicate tableId "${id}"` }))

  // ── 渲染器引用 | Renderer refs ──
  const {
    TableRenderer,
    TableVirtualRenderer,
    tableRendererRef,
    tableVirtualRendererRef,
    activeRenderer,
    rendererAdapter,
    paginationRef,
  } = useTableRendererRefs(mode, namespace, (source, error) =>
    handleError('TABLE_RENDER_ERROR', {
      field: `rendererLoader:${source}`,
      cause: error instanceof Error ? error : new Error(String(error)),
    }))

  // ── 搜索参数 | Search params ──
  // <zh/> 防抖延迟接线 filterConfig.quickFilterDebounce（props 与全局配置已在 useTableConfig 合并），
  // <zh/> 以 getter 传入保持响应性——运行时调整防抖即时生效，无需重建实例
  // <en/> Wire debounce delay from filterConfig.quickFilterDebounce (props & global already merged in useTableConfig);
  // <en/> passed as a getter to stay reactive — runtime debounce changes take effect without recreating the instance
  const { searchParams, quickFilterText } = useTableSearchState(
    models.quickFilter,
    () => mergedFilterConfig.value.quickFilterDebounce ?? DEFAULT_SEARCH_DEBOUNCE,
  )

  // ── 行 key 与样式 | Row key & styles ──
  // <zh/> 仅传入窄切片（rowKey 配置 + 列集合），不透传全量 props（ISP）
  // <en/> Pass narrow slices only (rowKey config + columns), never the full props (ISP)
  const { rowKeyFn, rowKeyField, sizeCssVars, selectableFn } = useTableRowKey<T>({
    rowKeyInput: () => props.rowConfig?.rowKey,
    columns: () => props.columns,
    devWarn: handleError.devWarn,
    mergedSizeConfig,
  })

  // ── 通知通道 | Notification channel ──
  // <zh/> 惰性解析全局配置——setup 期 resolveNotify(globalTableConfig.value) 快照会让
  // <zh/> 运行时注入/替换 globalConfig.notify 失效，故包装一层逐次读取当前配置
  // <en/> Lazily resolve from global config — a setup-time resolveNotify(globalTableConfig.value)
  // <en/> snapshot would freeze the channel, so wrap it to re-read the current config per call
  const notify: NotifyFn = (type, message, source) => resolveNotify(globalTableConfig.value)(type, message, source)

  // ── 调试日志器 | Debug logger ──
  // <zh/> 受 props.debug 控制，开启后输出管线/编辑/选择/渲染诊断信息 | <en/> Controlled by props.debug, outputs pipeline/editing/selection/rendering diagnostics when enabled
  const debug = createDebugLogger(() => props.debug, tableId)

  // ── 数据事务管理器 | Data transaction manager ──
  // <zh/> 确保 beforeDataChange → dataChange → afterDataChange 原子性执行 | <en/> Ensures atomic beforeDataChange → dataChange → afterDataChange
  const dataTransaction = useDataTransaction<T>({ tableId, emit })

  // ── 其他 | Misc ──
  const attrs = useAttrs()

  return {
    mergedRequest,
    mergedPagination,
    mergedUiConfig,
    mode,
    isManual,
    hasColumnSearch,
    requestMode,
    toolbar,
    elementSize,
    namespace,
    epNamespace,
    tableId,
    globalTableConfig,
    mergedSizeConfig,
    mergedBorder,
    mergedResizable,
    mergedEmptyText,
    mergedContainerLayout,
    mergedSearch,
    mergedRowConfig,
    mergedColumnConfig,
    mergedFilterConfig,
    t,
    locale,
    dayjsLocaleName,
    handleError,
    TableRenderer,
    TableVirtualRenderer,
    tableRendererRef,
    tableVirtualRendererRef,
    activeRenderer,
    rendererAdapter,
    paginationRef,
    rowKeyFn,
    rowKeyField,
    sizeCssVars,
    searchParams,
    quickFilterText,
    isUnmounted,
    attrs,
    selectableFn,

    // ── 跨切面上下文 | Cross-cutting context ──
    crossCutting: {
      tableId,
      t,
      handleError,
      isUnmounted,
    },

    // ── 通知通道 | Notification channel ──
    notify,

    // ── 调试日志器 | Debug logger ──
    debug,

    // ── 数据事务管理器 | Data transaction manager ──
    dataTransaction,
  }
}
