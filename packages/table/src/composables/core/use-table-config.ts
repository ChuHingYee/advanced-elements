import type { ComputedRef } from 'vue'
import type {
  AdvPaginationConfig,
  ColumnConfig,
  FilterConfig,
  PollingOptions,
  RequiredToolbarConfig,
  RowConfig,
  SearchConfig,
  SizeConfig,
  UiConfig,
} from '../../types/config'
import type { RendererModeName } from '../../types/renderer-caps'
import type { AdvTableProps } from '../../types/table-props'
import type { RequestMode } from '../data/use-request'
import { useAdvConfig } from '@advanced-elements/config-provider'
import { useGlobalConfig } from 'element-plus'
import { computed, watch } from 'vue'
import { traverseLeafColumns } from '../../utils/column-tree'
import { useStableComputed } from '../../utils/composable-helpers'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { shallowEqual } from '../../utils/equality'

/**
 * <zh/> 泛型配置合并——逐字段取 local ?? global ?? defaults，消除各 mergedXxx computed 中的重复合并模式
 * <en/> Generic config merge — per-field takes local ?? global ?? defaults, eliminates repeated merge patterns in mergedXxx computeds
 * @param local - <zh/> 组件 props 级配置（最高优先级） | <en/> component props level config (highest priority)
 * @param global - <zh/> 全局配置（次优先级） | <en/> global config (medium priority)
 * @param defaults - <zh/> 硬编码默认值（最低优先级） | <en/> hardcoded defaults (lowest priority)
 * @remarks
 * <zh/> 约束为 `T extends object` 而非 `Record<string, any>`，避免调用方对 interface（无 index signature）做 `as any` 断言。
 * <zh/> 内部使用 `as Record<string, unknown>` 局部断言以保持类型安全，单点 cast 替代 N 个调用点的 `as any`。
 * <zh/> 嵌套对象为整替语义（shallow）：如本地 `columnGroup: { enabled: true }` 会整体覆盖全局的
 * <zh/> `columnGroup` 子字段，而非逐子字段合并——需要全局子字段时请在本地完整声明（仅 `pollingOptions`
 * <zh/> 等显式嵌套合并的特判除外）。
 * <en/> Constrained to `T extends object` rather than `Record<string, any>`, avoiding `as any` assertions at call sites for interfaces (no index signature).
 * <en/> Internal `as Record<string, unknown>` cast keeps type safety, replacing N `as any` call-site casts with a single internal cast.
 * <en/> Nested objects are replaced wholesale (shallow): e.g. a local `columnGroup: { enabled: true }`
 * <en/> replaces the global `columnGroup` sub-fields instead of merging per sub-field — redeclare global
 * <en/> sub-fields locally when needed (except explicitly deep-merged cases like `pollingOptions`).
 */
function mergeConfig<T extends object>(
  local: T | undefined,
  global: T | undefined,
  defaults?: Partial<T>,
): T {
  const localKeys = local ? Object.keys(local) : []
  const globalKeys = global ? Object.keys(global) : []
  const defaultKeys = defaults ? Object.keys(defaults) : []
  const keys = new Set([...localKeys, ...globalKeys, ...defaultKeys])
  const result: Record<string, unknown> = {}
  const localRecord = local as Record<string, unknown> | undefined
  const globalRecord = global as Record<string, unknown> | undefined
  for (const key of keys) {
    // <zh/> 原型污染防护：配置入口虽是开发者输入，但与行数据路径（utils/security.ts 的
    // <zh/> DANGEROUS_KEYS 消毒）保持同一防御姿态——跳过危险键，避免 result 原型被改写。
    // <en/> Prototype-pollution guard: config is developer input, but keep the same defensive
    // <en/> posture as the row-data path (DANGEROUS_KEYS sanitizer in utils/security.ts) —
    // <en/> skip dangerous keys so the result prototype cannot be rewritten.
    if (key === '__proto__' || key === 'constructor' || key === 'prototype')
      continue
    result[key] = localRecord?.[key] ?? globalRecord?.[key] ?? defaults?.[key as keyof T]
  }
  return result as T
}

/** <zh/> 合并后工具栏形态——单一源见 types/config-toolbar#RequiredToolbarConfig | <en/> Merged toolbar shape — single source at types/config-toolbar#RequiredToolbarConfig */
type RequiredToolbar = RequiredToolbarConfig

/**
 * <zh/> 轮询默认配置
 * <en/> Polling default configuration
 */
const DEFAULT_POLLING_OPTIONS: PollingOptions = {
  time: 3000,
  immediate: false,
}

export interface ResolvedSizeConfig {
  headerCellHeight: number
  cellPadding: string
  headerCellPadding: string
  floatingFilterHeight: number
  cellFontSize: string
  rowHeight: number
  summaryRowHeight: number
}

/**
 * <zh/> 内置尺寸预设映射：large / default / small
 * <en/> Built-in size preset mapping: large / default / small
 */
const SIZE_PRESETS: Record<string, ResolvedSizeConfig> = {
  large: {
    headerCellHeight: 58,
    cellPadding: '12px 16px',
    headerCellPadding: '12px 16px',
    floatingFilterHeight: 36,
    cellFontSize: '14px',
    rowHeight: 56,
    summaryRowHeight: 48,
  },
  default: {
    headerCellHeight: 50,
    cellPadding: '8px 12px',
    headerCellPadding: '8px 12px',
    floatingFilterHeight: 32,
    cellFontSize: '14px',
    rowHeight: 48,
    summaryRowHeight: 40,
  },
  small: {
    headerCellHeight: 40,
    cellPadding: '4px 8px',
    headerCellPadding: '4px 8px',
    floatingFilterHeight: 28,
    cellFontSize: '12px',
    rowHeight: 36,
    summaryRowHeight: 32,
  },
}

/** 将 [垂直, 水平] 数组规范化为 CSS padding 字符串 */
function normalizePadding(v: string | [number, number] | undefined): string | undefined {
  if (Array.isArray(v))
    return `${v[0]}px ${v[1]}px`
  return v
}

export interface UseTableConfigReturn<T> {
  /** <zh/> 合并后的请求配置（优先级：props > 全局 > 默认） | <en/> Merged request config (props > global > defaults) */
  mergedRequest: ComputedRef<NonNullable<AdvTableProps<T>['request']>>
  /** <zh/> 合并后的分页配置 | <en/> Merged pagination config */
  mergedPagination: ComputedRef<AdvPaginationConfig>
  /** <zh/> 合并后的 UI 配置 | <en/> Merged UI config */
  mergedUiConfig: ComputedRef<{
    size: string | undefined
    namespace: string | undefined
    columnEmptyText: string | undefined
    showSummary: boolean | undefined
    summaryMethod: UiConfig<T>['summaryMethod']
    sumText: string | undefined
    grandTotalRow: UiConfig<T>['grandTotalRow']
    groupTotalRow: UiConfig<T>['groupTotalRow']
    groupSuppressBlankHeader: UiConfig<T>['groupSuppressBlankHeader']
    totalValueGetter: UiConfig<T>['totalValueGetter']
    suppressStickyTotalRow: UiConfig<T>['suppressStickyTotalRow']
  }>
  /**
   * <zh/> 是否处于虚拟滚动模式
   * <zh/> @deprecated 请改查 `mode` / `caps`——双真源将在下个大版本移除
   * <en/> Whether virtual scrolling mode is active
   * <en/> @deprecated Query `mode` / `caps` instead — the dual source will be removed in the next major
   */
  isVirtual: ComputedRef<boolean>
  /** <zh/> 当前渲染模式名（`isVirtual` 的模式名形态，供模式分发使用） | <en/> Current renderer mode name (the mode-name form of `isVirtual`, for mode dispatch) */
  mode: ComputedRef<RendererModeName>
  /** <zh/> 分页是否处于手动模式 | <en/> Whether pagination is in manual mode */
  isManual: ComputedRef<boolean>
  /** <zh/> 是否存在配置了 search:true 的列 | <en/> Whether any column has search:true */
  hasColumnSearch: ComputedRef<boolean>
  /** <zh/> 由分页配置推导的请求模式 | <en/> Derived request mode from pagination config */
  requestMode: ComputedRef<RequestMode>
  /** <zh/> 合并后的工具栏配置（含 prev 稳定性优化） | <en/> Merged toolbar config (with prev-stability optimization) */
  toolbar: ComputedRef<RequiredToolbar>
  /** <zh/> Element Plus 组件尺寸 | <en/> Element Plus component size */
  elementSize: ComputedRef<string>
  /** <zh/> Element Plus 命名空间 | <en/> Element Plus namespace */
  namespace: ComputedRef<string>
  /** <zh/> EP 侧原始命名空间（未回退，失配校验用） | <en/> Raw EP-side namespace (no fallback, for mismatch checks) */
  epNamespace: ComputedRef<string | undefined>
  /** <zh/> 表格唯一 ID | <en/> Unique table ID */
  tableId: ComputedRef<string>
  /** 全局表格配置（供模板和其他 composable 回退使用） */
  globalTableConfig: ComputedRef<Record<string, any>>
  /** <zh/> 合并后的尺寸配置（本地 sizeConfig > 全局 sizeConfig > size 预设 > 默认） | <en/> Merged size config (local sizeConfig > global sizeConfig > size preset > default) */
  mergedSizeConfig: ComputedRef<ResolvedSizeConfig>
  /** <zh/> 合并后的边框配置（props > 全局 > 默认 true） | <en/> Merged border (props > global > default true) */
  mergedBorder: ComputedRef<boolean | undefined>
  /** <zh/> 合并后的列宽拖拽配置（props > 全局 > 默认 true） | <en/> Merged resizable (props > global > default true) */
  mergedResizable: ComputedRef<boolean | undefined>
  /** <zh/> 合并后的空数据文案（props > 全局 > ElTable 默认） | <en/> Merged emptyText (props > global > ElTable default) */
  mergedEmptyText: ComputedRef<string | undefined>
  /** <zh/> 合并后的容器布局（props > 全局 > 默认 'bordered'） | <en/> Merged containerLayout (props > global > default 'bordered') */
  mergedContainerLayout: ComputedRef<'bordered' | 'bare'>
  /** <zh/> 合并后的搜索配置 | <en/> Merged search config */
  mergedSearch: ComputedRef<SearchConfig>
  /** <zh/> 合并后的行配置 | <en/> Merged row config */
  mergedRowConfig: ComputedRef<RowConfig<T>>
  /** <zh/> 合并后的列配置 | <en/> Merged column config */
  mergedColumnConfig: ComputedRef<ColumnConfig<T>>
  /** <zh/> 合并后的筛选配置 | <en/> Merged filter config */
  mergedFilterConfig: ComputedRef<FilterConfig>
}

/**
 * 表格配置合并 composable — 将 props 配置与全局配置逐项合并，输出最终生效的响应式配置。
 *
 * @param props - 组件 props
 * @returns 合并后的各模块配置响应式引用
 */
export function useTableConfig<T>(props: AdvTableProps<T>): UseTableConfigReturn<T> {
  const globalAdvConfig = useAdvConfig()
  const globalTableConfig = computed(() => globalAdvConfig.value.table ?? {})
  const globalConfig = useGlobalConfig()

  /**
   * <zh/> 显式传递类型参数，避免 mergeConfig 推断时将 FormatMaps（Partial<Record<keyof ResponseData, string>>）
   * <zh/> 宽化为 Record<string, string>，丢失精确键约束。
   * <zh/> config-provider 的 request 类型与 props 不完全对齐（缺 source、formatMaps 宽化），
   * <zh/> 此处将全局配置 cast 为 props 类型——单点 cast 替代调用点的 as any，运行时仍是字段级 ?? 合并。
   * <en/> Explicit type parameter prevents mergeConfig from widening FormatMaps
   * <en/> (Partial<Record<keyof ResponseData, string>>) to Record<string, string>, losing precise key constraints.
   * <en/> config-provider's request type doesn't fully align with props (missing source, widened formatMaps);
   * <en/> casting global config to props type here — single cast replacing per-call-site as any, runtime still uses field-level ?? merge.
   */
  const mergedRequest = useStableComputed<NonNullable<AdvTableProps<T>['request']>>(() =>
    mergeConfig<NonNullable<AdvTableProps<T>['request']>>(
      props.request,
      globalTableConfig.value.request as NonNullable<AdvTableProps<T>['request']> | undefined,
    ),
  )
  const mergedPagination = useStableComputed<AdvPaginationConfig>(() =>
    mergeConfig<AdvPaginationConfig>(props.pagination, globalTableConfig.value.pagination as AdvPaginationConfig | undefined),
  )

  const mergedUiConfig = computed(() => {
    const globalUi = globalTableConfig.value.uiConfig as UiConfig | undefined
    return {
      size: props.uiConfig?.size,
      namespace: props.uiConfig?.namespace,
      columnEmptyText: props.uiConfig?.columnEmptyText ?? globalTableConfig.value.uiConfig?.columnEmptyText,
      // <zh/> 合计行配置同样走 props ?? 全局合并，避免渲染层绕过全局 uiConfig
      // <en/> Summary-row config also merges props ?? global, preventing the renderer from bypassing the global uiConfig
      // <zh/> config-provider 的 UiConfig 为窄化类型（缺 showSummary 等字段），此处单点 cast 与 mergedRequest 的处理一致
      // <en/> config-provider's UiConfig is a narrowed type (missing showSummary etc.), single cast here, consistent with mergedRequest
      showSummary: props.uiConfig?.showSummary ?? globalUi?.showSummary,
      summaryMethod: props.uiConfig?.summaryMethod ?? globalUi?.summaryMethod,
      sumText: props.uiConfig?.sumText ?? globalUi?.sumText,
      // <zh/> AG Grid 对齐项：grand/group total、标签、粘性抑制同样走 props ?? 全局
      // <en/> AG Grid parity items: grand/group totals, label getter, sticky suppression also merge props ?? global
      grandTotalRow: props.uiConfig?.grandTotalRow ?? globalUi?.grandTotalRow,
      groupTotalRow: props.uiConfig?.groupTotalRow ?? globalUi?.groupTotalRow,
      groupSuppressBlankHeader: props.uiConfig?.groupSuppressBlankHeader ?? globalUi?.groupSuppressBlankHeader,
      totalValueGetter: props.uiConfig?.totalValueGetter ?? globalUi?.totalValueGetter,
      suppressStickyTotalRow: props.uiConfig?.suppressStickyTotalRow ?? globalUi?.suppressStickyTotalRow,
    }
  })

  // ── 汇总互斥校验──
  // <zh/> showSummary:false 与 grandTotalRow 共存时前者静默被忽略（显式 grandTotalRow 优先），
  // <zh/> summaryMethod 与 grandTotalRow 共存时 grand 使用内置 aggFunc 而忽略自定义 method
  // <en/> Summary mutual-exclusion guard  — showSummary:false is silently ignored when grandTotalRow exists,
  // <en/> summaryMethod is ignored when grandTotalRow uses built-in aggFunc
  watch(
    mergedUiConfig,
    (ui) => {
      if (!isDev)
        return
      if (ui.showSummary === false && ui.grandTotalRow) {
        devWarn(
          `uiConfig.showSummary is false but grandTotalRow="${String(ui.grandTotalRow)}" is set — showSummary:false will be ignored (grand total rows render regardless of showSummary). Remove showSummary or use grandTotalRow alone.`,
        )
      }
      if (ui.summaryMethod && ui.grandTotalRow) {
        devWarn(
          `uiConfig.summaryMethod is set but grandTotalRow="${String(ui.grandTotalRow)}" is configured — grandTotalRow uses built-in aggFunc aggregation, custom summaryMethod will be ignored for grand totals.`,
        )
      }
    },
    { immediate: true },
  )

  // <zh/> @deprecated 请改查 `mode === 'virtual'` / `caps`——模板内禁 `isVirtual` 字面量（查 caps），本字段仅作兼容保留
  // <en/> @deprecated Query `mode === 'virtual'` / `caps` instead — no `isVirtual` literals in templates (query caps); kept for compatibility only
  const isVirtual = computed(() => props.mode === 'virtual')
  // <zh/> 未传 mode 即 default；与 isVirtual 同源，类型收敛为 RendererModeName 供分发使用
  // <en/> Absent mode means default; same source as isVirtual, narrowed to RendererModeName for dispatch
  const mode = computed((): RendererModeName => props.mode ?? 'default')
  // 必须读合并值：仅经 ConfigProvider 下发 pagination.mode 时本地 props 为空，读本地会分裂
  const isManual = computed(() => mergedPagination.value?.mode === 'manual')

  const hasColumnSearch = computed(() => {
    if (!props.columns)
      return false
    let found = false
    traverseLeafColumns(props.columns, (col) => {
      if (col.search)
        found = true
    })
    return found
  })

  const requestMode = computed((): RequestMode => {
    if (mergedPagination.value?.mode === 'client' || mergedPagination.value?.enabled === false)
      return 'simple'
    return 'paginated'
  })

  /** 利用 Vue 3.4+ computed 稳定性优化：prev 参数仅在 3.4+ 可用，降级到 3.3 时优化失效 */
  const toolbar = computed((prev): RequiredToolbar => {
    const gToolbar = globalTableConfig.value.toolbar

    // 基础字段用 mergeConfig 合并 | Base fields merged via mergeConfig
    const base = mergeConfig<RequiredToolbar>(
      props.toolbar as RequiredToolbar | undefined,
      gToolbar as RequiredToolbar | undefined,
    )

    // pollingOptions 需要嵌套合并（字段级 ?? + 默认值）| pollingOptions needs nested merge (field-level ?? + defaults)
    const pollingOptions: PollingOptions = props.toolbar?.pollingOptions
      ?? (gToolbar?.pollingOptions
        ? {
            time: gToolbar.pollingOptions.time ?? 3000,
            immediate: gToolbar.pollingOptions.immediate ?? false,
          }
        : DEFAULT_POLLING_OPTIONS)

    const next: RequiredToolbar = {
      ...base,
      // 补齐布尔默认值 | Fill in boolean defaults
      columnSetting: base.columnSetting ?? true,
      refreshBtn: base.refreshBtn ?? false,
      pollingBtn: base.pollingBtn ?? false,
      exportBtn: base.exportBtn ?? false,
      exportCsvBtn: base.exportCsvBtn ?? false,
      importBtn: base.importBtn ?? false,
      printBtn: base.printBtn ?? false,
      // 嵌套合并的字段 | Nested-merged fields
      pollingOptions,
    }
    if (prev && shallowEqual(prev, next))
      return prev
    return next
  })

  const elementSize = computed(() => props.size ?? mergedUiConfig.value.size ?? globalConfig.value?.size ?? '')
  const namespace = computed(() => mergedUiConfig.value.namespace ?? globalConfig.value?.namespace ?? 'el')
  /**
   * <zh/> EP 侧原始命名空间（未回退）——供命名空间失配校验对比 `props.uiConfig.namespace`。
   * <zh/> 为 `undefined` 表示宿主未配置 EP ConfigProvider namespace，此时无第二真相源，不存在失配。
   * <en/> Raw EP-side namespace (no fallback) — compared against `props.uiConfig.namespace` by the namespace-mismatch guard.
   * <en/> `undefined` means the host sets no EP ConfigProvider namespace, hence no second source of truth and no possible mismatch.
   */
  const epNamespace = computed(() => globalConfig.value?.namespace as string | undefined)
  const _fallbackTableId = `t-${(() => {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-'
    const cryptoObj = (typeof globalThis !== 'undefined' ? globalThis.crypto : undefined) as Crypto | undefined
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
      const arr = new Uint8Array(8)
      cryptoObj.getRandomValues(arr)
      let s = ''
      for (let i = 0; i < 8; i++) s += chars[arr[i]! % chars.length]
      return s
    }
    return Math.random().toString(36).slice(2, 10)
  })()}`
  /**
   * <zh/> 表格实例 ID——`uiConfig.tableId` 为**空串**时回退到自动生成的 ID（`??` 会保留空串）。
   *
   * <zh/> 空 id 会让根元素失去 `#tableId` 作用域根：DOM 适配器的行/表体查询全部落空
   * <zh/>（列持久化 key 也会退化为无 tableId 的公共键），属无意义配置，静默回退比"全链路哑火"更有用。
   *
   * <en/> Table instance id — an **empty string** `uiConfig.tableId` falls back to the generated id (`??`
   * <en/> would keep the empty string).
   *
   * <en/> An empty id strips the root of its `#tableId` scope root: every DOM-adapter row/body lookup misses
   * <en/> (and the column-state persistence key degrades to the shared one). That configuration is meaningless,
   * <en/> so a silent fallback beats a dead lookup chain.
   */
  const tableId = computed(() => props.uiConfig?.tableId || _fallbackTableId)
  // <zh/> 同页重复 tableId 检测——守卫挂载在 useAdvTableCore（错误通道所在域），此处仅产出 tableId
  // <en/> Duplicate tableId detection lives in useAdvTableCore (where the error channel exists); only the tableId is produced here

  const mergedSizeConfig = computed<ResolvedSizeConfig>(() => {
    const preset = SIZE_PRESETS[elementSize.value || 'default'] ?? SIZE_PRESETS.default
    const global = (globalTableConfig.value?.uiConfig as { sizeConfig?: SizeConfig } | undefined)?.sizeConfig
    const local = props.uiConfig?.sizeConfig

    return {
      headerCellHeight: local?.headerCellHeight ?? global?.headerCellHeight ?? preset.headerCellHeight,
      cellPadding: normalizePadding(local?.cellPadding ?? global?.cellPadding) ?? preset.cellPadding,
      headerCellPadding: normalizePadding(local?.headerCellPadding ?? global?.headerCellPadding) ?? preset.headerCellPadding,
      floatingFilterHeight: local?.floatingFilterHeight ?? global?.floatingFilterHeight ?? preset.floatingFilterHeight,
      cellFontSize: local?.cellFontSize ?? global?.cellFontSize ?? preset.cellFontSize,
      rowHeight: local?.rowHeight ?? global?.rowHeight ?? preset.rowHeight,
      summaryRowHeight: local?.summaryRowHeight ?? global?.summaryRowHeight ?? preset.summaryRowHeight,
    }
  })

  const mergedBorder = computed(() => props.border ?? globalTableConfig.value.border)
  const mergedResizable = computed(() => props.resizable ?? globalTableConfig.value.resizable)
  const mergedEmptyText = computed(() => props.emptyText ?? globalTableConfig.value.emptyText)
  const mergedContainerLayout = computed<'bordered' | 'bare'>(() => props.containerLayout ?? globalTableConfig.value.containerLayout ?? 'bordered')

  const mergedSearch = useStableComputed<SearchConfig>(() =>
    mergeConfig<SearchConfig>(props.search, globalTableConfig.value.search as SearchConfig | undefined),
  )
  const mergedRowConfig = useStableComputed<RowConfig<T>>(() =>
    mergeConfig<RowConfig<T>>(props.rowConfig, globalTableConfig.value.rowConfig as RowConfig<T> | undefined),
  )
  const mergedColumnConfig = useStableComputed<ColumnConfig<T>>(() =>
    mergeConfig<ColumnConfig<T>>(props.columnConfig, globalTableConfig.value.columnConfig as ColumnConfig<T> | undefined),
  )
  const mergedFilterConfig = useStableComputed<FilterConfig>(() =>
    mergeConfig<FilterConfig>(props.filterConfig, globalTableConfig.value.filterConfig as FilterConfig | undefined),
  )

  return {
    mergedRequest,
    mergedPagination,
    mergedUiConfig,
    isVirtual,
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
  }
}
