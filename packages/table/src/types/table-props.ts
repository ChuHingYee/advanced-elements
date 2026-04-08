import type { TableProps } from 'element-plus'
import type { UseRequestOptions } from '../composables/data/use-request'
import type { AdvColumn, ProcessedColumn } from '../types'
import type { ColumnStatePersistence } from '../types/column-state'
import type {
  AdvPaginationConfig,
  ColumnConfig,
  DataPipelineConfig,
  ExternalFilterConfig,
  FilterConfig,
  RangeSelectionConfig,
  RowConfig,
  RowExpandConfig,
  RowGroupConfig,
  RowPinConfig,
  SearchConfig,
  SortConfig,
  SpanConfig,
  ToolbarConfig,
  TreeConfig,
  UiConfig,
  UrlStateConfig,
} from '../types/config'
import type { ContextMenuConfig } from '../types/context-menu'
import type { EditConfig } from '../types/edit'
import type { InterceptorConfig } from '../types/interceptor'
import type { DataSource, FormatMaps } from '../types/response'
import type { DebugConfig } from '../utils/debug-logger'
import type { ColumnFilterValue } from './filter'
import type { SpanDynamicCoexistence } from './renderer-interface'
import type { TableRowKey } from './row-rect'

/**
 * <zh/> 表格属性——泛型 T 为行类型。未显式指定行类型时 T 回退到 `Record<string, unknown>`，
 * <zh/> 此时动态列插槽名（`${prop}`）拼写检查恒失效（`Exclude<string, …>` 仍为 `string`），
 * <zh/> 属"插槽名 = 列 prop"设计的固有代价；需要拼写检查请显式声明行类型。
 * <en/> Table props — generic T is the row type. Without an explicit row type T falls back to
 * <en/> `Record<string, unknown>`, under which dynamic column slot-name typos are never caught
 * <en/> (`Exclude<string, …>` stays `string`); inherent to the "slot name = column prop" design.
 * <en/> Declare an explicit row type when typo checking matters.
 */
export interface AdvTableBaseProps<T = Record<string, unknown>> {
  /**
   * <zh/> 性能档位——'low' 关闭滚动看门狗/滚动速度追踪/hover 鼠标追踪等重路径（低端设备降档）。
   * <zh/> 未设置时回退到全局 ConfigProvider 的同名配置，再回退 'high'。
   * <en/> Performance tier — 'low' disables heavy paths. Falls back to the global ConfigProvider
   * <en/> setting of the same name, then defaults to 'high'.
   */
  performanceProfile?: 'high' | 'low'
  /**
   * <zh/> mode 运行时切换行为策略 | <en/> Runtime mode-switch behavior strategy
   *
   * <zh/> 严格遵循 Vue 最佳实践：watch 回调内永不抛错，可观测错误统一走结构化事件。
   * <zh/> - `'warn'`（默认）：执行切换并清理状态（取消编辑 + 重置 shift-select 等），dev 模式下派发 info 级通知（不进入 error 事件流）
   * <zh/> - `'error'`：先执行与 `'warn'` 一致的状态清理，再派发 error 级事件（`TABLE_MODE_SWITCH_FORBIDDEN`）+ devWarn，不抛错
   * <zh/> - `'silent'`：执行与 `'warn'` 完全一致的状态清理，但不派发任何通知
   * <zh/> - 三种策略的状态清理逻辑完全一致；`'warn'` 与 `'silent'` 的唯一差别是是否派发 info 通知
   * <zh/> - 重要：`mode` prop 在 watcher 触发前已经生效，即使 `'error'` 也**无法阻止切换**，
   * <zh/> 它只是报警信号（清理已执行，状态收敛到新 mode）；需要真正阻止切换请在写入点用 `canSwitchMode(behavior)` 预检或用 `v-if` 重建组件
   * <zh/> - 可观测性：`'error'` 通过 `@error` 事件（`TABLE_MODE_SWITCH_FORBIDDEN`）与 devWarn 可观测，不再同步抛错，
   * <zh/>   业务侧无需 try/catch，监听 `@error` 即可在组件内观测到该次禁止切换。
   *
   * <en/> Strict Vue best practice: never throw inside a watcher; observable errors go via structured events.
   * <en/> - `'warn'` (default): perform the switch and clean state (cancel editing + reset shift-select, etc.); dispatch an info-level notice in dev mode (NOT in error event stream)
   * <en/> - `'error'`: run the same cleanup as `'warn'` first, then dispatch an error-level event (`TABLE_MODE_SWITCH_FORBIDDEN`) + devWarn, no throw
   * <en/> - `'silent'`: perform identical state cleanup as `'warn'`, but suppress the notice
   * <en/> - All three strategies share identical cleanup; the ONLY difference between `'silent'` and `'warn'` is whether the notice is dispatched
   * <en/> - Important: the `mode` prop is applied before the watcher fires, so even `'error'`
   * <en/>   CANNOT prevent the switch — it is a signal only (cleanup already ran, state converged to
   * <en/>   the new mode). To truly prevent a switch, pre-check with `canSwitchMode(behavior)` at the write site or recreate with `v-if`
   * <en/> - Observability: `'error'` is observable via `@error` (`TABLE_MODE_SWITCH_FORBIDDEN`) and devWarn, no longer throws synchronously;
   * <en/>   listening to `@error` observes the forbidden switch from inside the component.
   *
   * @default 'warn'
   */
  modeSwitchBehavior?: 'warn' | 'error' | 'silent'
  /**
   * <zh/> 是否显示表格边框 | <en/> Whether to show the table border
   * <zh/> 控制 ElTable/ElTableV2 的边框显示（含外边框与纵向内边框），不影响列宽拖拽调整（由 `resizable` 控制）。 | <en/> Controls ElTable/ElTableV2 border display (outer border and vertical inner borders); does not affect column resize, which is controlled by `resizable`.
   */
  border?: boolean
  /**
   * <zh/> 是否允许拖拽调整列宽 | <en/> Whether to allow dragging to resize column width
   *
   * <zh/> 列级 `resizable` 优先级高于此属性： | <en/> Column-level `resizable` takes precedence over this prop:
   * - <zh/> 列 `resizable: true` → 始终可拖拽（覆盖表格级 false） | <en/> column `resizable: true` → always resizable (overrides table-level false)
   * - <zh/> 列 `resizable: false` → 始终不可拖拽（覆盖表格级 true） | <en/> column `resizable: false` → never resizable (overrides table-level true)
   * - <zh/> 列 `resizable: undefined` → 使用表格级 `resizable` 值 | <en/> column `resizable: undefined` → falls back to table-level `resizable`
   *
   * <zh/> default 模式下透传给 ElTable 列的 resizable 属性；virtual 模式下控制自定义列宽拖拽逻辑。 | <en/> In default mode it is passed through to ElTable column's resizable prop; in virtual mode it controls the custom column-width drag logic.
   */
  resizable?: boolean
  /**
   * <zh/> 工具栏配置，含列设置、导出等按钮 | <en/> Toolbar config, including column settings, export, etc.
   */
  toolbar?: ToolbarConfig
  /**
   * <zh/> 搜索配置 | <en/> Search config
   *
   * @example
   * ```ts
   * :search="{ enabled: true, fields: [{ prop: 'name', label: '姓名' }], collapsed: true }"
   * ```
   */
  search?: SearchConfig
  /**
   * <zh/> 分页配置 | <en/> Pagination config
   *
   * @example
   * ```ts
   * :pagination="{ enabled: true, pageSize: 20, pageSizes: [10, 20, 50], background: true }"
   * ```
   */
  pagination?: AdvPaginationConfig
  /**
   * <zh/> 数据请求配置 | <en/> Data request config
   *
   * @example
   * ```ts
   * :request="{ source: fetchData, auto: true, paramKeys: { page: 'current', size: 'size' } }"
   * ```
   */
  request?: {
    /**
     * <zh/> 数据源函数，接收分页参数返回 Promise（行类型与 `data?: T[]` 对齐） | <en/> Data source function (row type aligned with `data?: T[]`)
     */
    source?: DataSource<T>
    /**
     * <zh/> 是否初始化时自动发起请求 | <en/> Whether to fire the request automatically on init
     */
    auto?: boolean
    /**
     * <zh/> 响应数据字段映射 | <en/> Response data field mapping
     */
    formatMaps?: FormatMaps
    /**
     * <zh/> 分页参数 key 映射 | <en/> Pagination param key mapping
     */
    paramKeys?: { page?: string, size?: string }
    /**
     * <zh/> 请求参数转换函数 | <en/> Request param transform function
     */
    transformRequest?: UseRequestOptions<T>['transformRequest']
    /**
     * <zh/> 响应数据转换函数 | <en/> Response data transform function
     */
    transformResponse?: UseRequestOptions<T>['transformResponse']
    /**
     * <zh/> 自动携带排序/筛选状态进请求参数，默认 false。
     * <zh/> 开启后每次远程请求自动附加 `sort`（序列化为 [{ prop, order: 'asc' | 'desc' }])
     * <zh/> 与 `filter`（列筛选状态原样透出）两个键；键名可经对象形态自定义。
     * <zh/> 需要更复杂的序列化时请用 transformRequest 在其基础上改写。
     * <zh/> **注意**：关闭时（默认）排序/筛选只作用于当前页（页内语义），且筛选激活会派发
     * <zh/> `TABLE_SERVER_LOCAL_FILTER_PAGE_ONLY` 事件；服务端全量语义必须开启本项。
     * <en/> Auto-attach sort/filter state into request params, default false.
     * <en/> When enabled, every remote request carries `sort` (serialized to [{ prop, order: 'asc' | 'desc' }])
     * <en/> and `filter` (raw column filter state); key names customizable via the object form.
     * <en/> For richer serialization, rewrite them in transformRequest.
     * <en/> **Note**: when off (default), sort/filter apply to the current page only (page-local
     * <en/> semantics), and an active filter dispatches `TABLE_SERVER_LOCAL_FILTER_PAGE_ONLY`; full
     * <en/> server-side semantics require this flag.
     */
    autoParams?: boolean | { sortKey?: string, filterKey?: string }
    /**
     * <zh/> 请求超时（毫秒），0 表示不超时；仅自动请求（auto 模式）生效，manual 模式走宿主自取数请宿主侧自行超时 | <en/> Request timeout in ms, 0 means no timeout; auto requests only — manual mode fetches via the host, time out host-side
     */
    timeout?: number
    /**
     * <zh/> 失败重试次数或完整重试配置（指数退避）；仅自动请求生效 | <en/> Retry count or full retry config (exponential backoff); auto requests only
     */
    retries?: number | import('../composables/data/use-request').UseRequestRetryOptions
    /**
     * <zh/> 重试基础延迟（当 retries 为数字时生效） | <en/> Base retry delay when retries is a number
     */
    retryDelay?: number
    /**
     * <zh/> 指数退避因子 | <en/> Exponential backoff factor
     */
    retryBackoffFactor?: number
    /**
     * <zh/> 最大重试延迟 | <en/> Max retry delay
     */
    retryMaxDelay?: number
    /**
     * <zh/> 是否重试判定（返回 true 重试） | <en/> Retry predicate (return true to retry)
     */
    retryOn?: (error: unknown) => boolean
  }
  /**
   * <zh/> URL 状态同步配置，将分页/搜索参数同步到 URL query | <en/> URL state sync config, syncing pagination/search params into the URL query
   */
  urlState?: UrlStateConfig
  /**
   * <zh/> 外部筛选器——AG-Grid 风格的业务过滤钩子，位于数据管线的列筛选/全局搜索之后、排序之前。
   *
   * <zh/> 适用场景：权限过滤、跨表关联过滤、动态条件组合等无法用列级 `filter` 表达的业务规则。
   * <zh/> 完整契约（调用频率、纯函数要求、性能建议）见 {@link ExternalFilterConfig}。
   * <zh/> 服务端数据源下为本地（页内）语义，不触发远程 refetch。
   *
   * <zh/> 示例：
   * ```ts
   * const activeDepartment = ref('eng')
   * const externalFilter = computed(() => ({
   *   isExternalFilterPresent: () => !!activeDepartment.value,
   *   doesExternalFilterPass: (row: Employee) => row.department === activeDepartment.value,
   * }))
   * ```
   *
   * <en/> External filter — AG-Grid style business filter hook, located after column filter / quick filter, before sort in the data pipeline.
   *
   * <en/> Use cases: permission filter, cross-table join filter, dynamic condition composition — business rules that cannot be expressed via column-level `filter`.
   * <en/> Full contract (call frequency, pure function requirement, performance tips) see {@link ExternalFilterConfig}.
   * <en/> Under a server-side source it is local (current-page) semantics and never triggers a remote refetch.
   *
   * @example
   * ```ts
   * const activeDepartment = ref('eng')
   * const externalFilter = computed(() => ({
   *   isExternalFilterPresent: () => !!activeDepartment.value,
   *   doesExternalFilterPass: (row: Employee) => row.department === activeDepartment.value,
   * }))
   * ```
   */
  externalFilter?: ExternalFilterConfig<T>
  /**
   * <zh/> 列配置数组（声明式列定义）；不传时 default 模式可改用 `<el-table-column>` 子组件声明
   * <en/> Column config array (declarative column definitions); when absent, default mode may declare columns via `<el-table-column>` children
   */
  columns?: AdvColumn<T>[]
  /**
   * <zh/> 表格数据（未设置 request.source 时生效） | <en/> Table data (used when request.source is not set)
   */
  data?: T[]
  /**
   * <zh/> 加载状态（与内部 loading 通过 OR 合并） | <en/> Loading state (merged with internal loading via OR)
   */
  loading?: boolean
  /**
   * <zh/> 表格高度（px 或 CSS 字符串），透传给 ElTable / ElTableV2 的 height prop。
   * <zh/> 未设置时表格自适应父容器高度（flex 布局）。设置后虚拟滚动与固定表头滚动区域按此高度渲染。
   * <en/> Table height (px or CSS string), passed through to ElTable / ElTableV2 height prop.
   * <en/> When not set, the table adapts to its parent container height (flex layout). When set, the virtual-scroll and fixed-header scroll area renders at this height.
   */
  height?: number | string
  /**
   * <zh/> 选中的行 key 数组，配合 rowKey 使用。接受 {@link TableRowKey}（string | number），内部统一归一化为 string
   * <en/> Selected row key array, used with rowKey. Accepts {@link TableRowKey} (string | number), normalized to string internally
   */
  selectedRowKeys?: TableRowKey[]
  /**
   * <zh/> 全局搜索文本（v-model）；服务端数据源下为本地（页内）语义 | <en/> Global search text (v-model); local (current-page) semantics under a server-side source
   */
  quickFilter?: string
  /**
   * <zh/> 编辑配置，含编辑触发器、校验规则等 | <en/> Edit config, including edit trigger, validation rules, etc.
   */
  editConfig?: EditConfig
  /**
   * <zh/> 列全局配置，含默认列定义、列类型注册 | <en/> Global column config, including default column definitions and column-type registration
   */
  columnConfig?: ColumnConfig<T>
  /**
   * <zh/> 行配置，含行 key、行选择、行拖拽 | <en/> Row config, including row key, row selection, row drag
   */
  rowConfig?: RowConfig<T>
  /**
   * <zh/> 筛选面板配置 | <en/> Filter panel config
   */
  filterConfig?: FilterConfig
  /**
   * <zh/> 受控筛选模型——外部传入时成为筛选状态的唯一真相源（与内部 setFilter 命令式 API 二选一混用时，以最后一次写入为准）。
   * <zh/> 键为列规范 key（与 `filterChange` 事件载荷的键口径一致）；变更时内部经内容等值比较后同步，不会触发回环。
   * <zh/> 未传入时筛选完全由内部管理（非受控），`filterChange` 事件仍会发射。
   * <zh/> 服务端数据源 + `autoParams` 关闭时为页内语义（服务端收不到筛选参数，dev 有提示）。
   * <en/> Controlled filter model — when provided, it becomes the single source of truth for filter state
   * <en/> (when mixed with the imperative `setFilter` API, the last write wins).
   * <en/> Keys are canonical column keys (same caliber as the `filterChange` payload); updates sync inward
   * <en/> after a content-equality check, so no feedback loop occurs.
   * <en/> When omitted, filtering is fully internal (uncontrolled), and `filterChange` still fires.
   * <en/> Under a server-side source with `autoParams` off it is page-local (the server never sees filter params; dev warns).
   */
  filterModel?: Record<string, ColumnFilterValue>
  /**
   * <zh/> 排序配置，如多列排序上限 | <en/> Sort config, e.g. multi-sort column limit
   */
  sortConfig?: SortConfig
  /**
   * <zh/> 数据管线配置，如阶段顺序 | <en/> Data pipeline config, e.g. stage order
   *
   * @example
   * ```ts
   * :data-pipeline="{ order: ['externalFilter', 'columnFilter', 'quickFilter', 'sort'] }"
   * ```
   */
  dataPipeline?: DataPipelineConfig
  /**
   * <zh/> 合并配置 — 行级、列级和声明式合并规则 | <en/> Span config — row-level, column-level and declarative span rules
   * <zh/> 支持扁平化简写：`{ department: true }` ≡ `{ rows: { department: true } }` | <en/> Supports flat shorthand: `{ department: true }` ≡ `{ rows: { department: true } }`
   *
   * @example
   * ```ts
   * :span-config="{ department: true }"
   * :span-config="{ rows: { department: true }, cols: { firstName: true }, ranges: [...] }"
   * ```
   */
  spanConfig?: SpanConfig
  /**
   * <zh/> 自定义合并函数 | <en/> Custom span method
   * <zh/> 当同时配置了 spanConfig 或列级 spanRows/colSpan 时，此函数优先；若此函数返回 undefined，则回退到内部自动合并逻辑。 | <en/> When spanConfig or column-level spanRows/colSpan is also set, this function takes precedence; if it returns undefined, it falls back to the internal auto-span logic.
   */
  spanMethod?: (params: { row: T, column: ProcessedColumn, rowIndex: number, columnIndex: number }) => { rowspan: number, colspan: number } | undefined
  /**
   * <zh/> UI 配置，含空数据占位符、货币格式等 | <en/> UI config, including empty placeholder, currency format, etc.
   */
  uiConfig?: UiConfig<T>
  /**
   * <zh/> 列状态持久化配置，含存储适配器、自动保存/恢复 | <en/> Column state persistence config, including storage adapter and auto save/restore
   */
  columnState?: ColumnStatePersistence
  /**
   * <zh/> 右键菜单配置 | <en/> Context menu config
   */
  menuConfig?: ContextMenuConfig<T>
  /**
   * <zh/> 单元格范围选择配置（Excel 风格拖拽选择） | <en/> Cell range selection config (Excel-style drag selection)
   *
   * <zh/> 支持简写：`true` 等价于 `{ enabled: true }` | <en/> Supports shorthand: `true` equals `{ enabled: true }`
   *
   * @example
   * ```ts
   * :range-selection="true"
   * :range-selection="{ enabled: true, autoCopy: true }"
   * ```
   */
  rangeSelection?: boolean | RangeSelectionConfig
  /**
   * <zh/> 拦截器配置，可拦截键盘/编辑/点击等事件并阻止默认行为 | <en/> Interceptor config, can intercept keyboard/edit/click events and prevent default behavior
   */
  interceptor?: InterceptorConfig<T>
  /**
   * <zh/> 树形数据配置 — 将层级数据展平为带缩进信息的行数组 | <en/> Tree data config — flattens hierarchical data into a row array with indentation info
   *
   * @example
   * ```ts
   * :tree-config="{ children: 'children', defaultExpandAll: true }"
   * :tree-config="{ children: 'children', defaultExpandedRowKeys: ['1', '1-1'] }"
   * ```
   */
  treeConfig?: TreeConfig
  /**
   * <zh/> 行分组配置 — 将数据按指定字段值分组，生成带分组头的行数组 | <en/> Row group config — groups data by specified field values, generating rows with group headers
   *
   * @example
   * ```ts
   * :row-group-config="{ field: 'department', defaultExpandAll: true }"
   * :row-group-config="{ field: ['department', 'role'], defaultExpandAll: false }"
   * ```
   */
  rowGroupConfig?: RowGroupConfig
  /**
   * <zh/> 展开行配置 — 支持基础展开行和主/明细视图 | <en/> Row expand config — supports basic expand rows and master/detail views
   *
   * @example
   * ```ts
   * :row-expand-config="{ enabled: true, defaultExpandedRowKeys: [1, 2] }"
   * :row-expand-config="{ enabled: true, accordion: true }"
   * ```
   */
  rowExpandConfig?: RowExpandConfig
  /**
   * <zh/> 空数据时显示的文本 | <en/> Text shown when data is empty
   * - <zh/> default 模式: 传递给 ElTable 的 `empty-text` prop | <en/> default mode: passed to ElTable's `empty-text` prop
   * - <zh/> virtual 模式: 通过 `#empty` 插槽实现 | <en/> virtual mode: implemented via the `#empty` slot
   */
  emptyText?: string
  /**
   * <zh/> 行的 className，支持函数或字符串 | <en/> Row className, accepts a function or a string
   * - <zh/> 函数签名: `({ row, rowIndex }) => string` | <en/> function signature: `({ row, rowIndex }) => string`
   * - <zh/> 两种模式下行为一致 | <en/> behaves identically in both modes
   */
  rowClassName?: TableProps<T & Record<PropertyKey, unknown>>['rowClassName']
  /**
   * <zh/> 是否显示斑马纹 | <en/> Whether to display striped rows
   * <zh/> default 模式直接透传给 ElTable 的 `stripe` prop；virtual 模式通过 `row-class-name` 实现等价效果。 | <en/> In default mode, passed directly to ElTable's `stripe` prop; in virtual mode, implemented via `row-class-name`.
   *
   * @default false
   */
  stripe?: boolean
  /**
   * <zh/> 是否高亮当前行 | <en/> Whether to highlight the current row
   * <zh/> default 模式透传给 ElTable 的 `highlight-current-row` prop；virtual 模式通过行样式实现。 | <en/> In default mode, passed to ElTable's `highlight-current-row` prop; in virtual mode, implemented via row styling.
   *
   * @default true
   */
  highlightCurrentRow?: boolean
  /**
   * <zh/> 是否显示表头 | <en/> Whether to show the table header
   * <zh/> 两种模式均透传到底层渲染器。 | <en/> Passed through to the underlying renderer in both modes.
   *
   * @default true
   */
  showHeader?: boolean
  /**
   * <zh/> 合并单元格 × 动态行高共存策略（特性开关）| <en/> Span × dynamic row height coexistence strategy (feature flag)
   *
   * <zh/> - `'warn-only'`（默认）：零行为变更——span×dynamic 组合仅告警（`TABLE_SPAN_DYNAMIC_HEIGHT_UNSUPPORTED` /
   * <zh/>   virtual 渲染器 dev 警告），视觉不支持；`useSpanOverlay.getOverlayStyle` 不生效。
   * <zh/> - `'rfc-overlay'`：virtual 侧 origin 格改走绝对定位覆盖层（`useSpanOverlay.getOverlayStyle`），
   * <zh/>   替代 `rowspan × rowHeight` 估算直设高度；default 模式不受影响。
   * <zh/> 显式 opt-in，默认关闭以保证零破坏。
   *
   * <en/> - `'warn-only'` (default): zero behavior change — span×dynamic only warns
   * <en/>   (`TABLE_SPAN_DYNAMIC_HEIGHT_UNSUPPORTED` / virtual renderer dev warning), visually unsupported;
   * <en/>   `useSpanOverlay.getOverlayStyle` stays inert.
   * <en/> - `'rfc-overlay'`: virtual origin cells use the absolutely-positioned overlay
   * <en/>   (`useSpanOverlay.getOverlayStyle`) instead of the `rowspan × rowHeight` estimate;
   * <en/>   default mode unaffected.
   * <en/> Explicit opt-in, off by default for zero breakage.
   *
   * @default 'warn-only'
   */
  spanDynamicMode?: SpanDynamicCoexistence
  /**
   * <zh/> 溢出 tooltip 的 effect 主题 | <en/> Effect theme of the overflow tooltip
   * <zh/> 默认 'dark' | <en/> default 'dark'
   */
  tooltipEffect?: TableProps<Record<string, unknown>>['tooltipEffect']
  /**
   * <zh/> 溢出 tooltip 的自定义选项（placement、popperClass 等） | <en/> Custom options for the overflow tooltip (placement, popperClass, etc.)
   */
  tooltipOptions?: TableProps<Record<string, unknown>>['tooltipOptions']
  /**
   * <zh/> 溢出 tooltip 内容格式化函数（表级别默认，可被列级别 tooltipFormatter 覆盖） | <en/> Overflow tooltip content formatter (table-level default, overridable by column-level tooltipFormatter)
   * @param data - <zh/> 格式化上下文对象 | <en/> formatting context object
   * @param data.row - <zh/> 当前行数据 | <en/> current row data
   * @param data.column - <zh/> 当前列配置 | <en/> current column config
   * @param data.cellValue - <zh/> 单元格值 | <en/> cell value
   * @returns <zh/> 格式化后的 VNode 或字符串 | <en/> formatted VNode or string
   */
  tooltipFormatter?: (data: { row: T, column: ProcessedColumn, cellValue: unknown }) => import('vue').VNode | string
  /**
   * <zh/> 容器布局模式 | <en/> Container layout mode
   *
   * <zh/> - `'bordered'`（默认）：容器有边框和内边距，子元素间距为 8px | <en/> - `'bordered'` (default): container has border and padding, child gap is 8px
   * <zh/> - `'bare'`：容器无边框、无内边距，子元素间距为 `var(--adv-table-padding)`（默认 16px），适合嵌入已有边框的父容器 | <en/> - `'bare'`: container has no border and no padding, child gap is `var(--adv-table-padding)` (default 16px), suitable for embedding in a parent that already provides borders
   *
   * @default 'bordered'
   */
  containerLayout?: 'bordered' | 'bare'
  /**
   * <zh/> 调试模式开关——开启后输出详细的管线/编辑/选择/渲染诊断信息 | <en/> Debug mode toggle — when enabled, outputs detailed pipeline/editing/selection/rendering diagnostics
   *
   * <zh/> 支持简写：`true` 等价于 `{ enabled: true, perf: true }` | <en/> Supports shorthand: `true` equals `{ enabled: true, perf: true }`
   *
   * <zh/> 支持按域过滤：`{ enabled: true, domains: ['data', 'edit'] }` 仅输出指定域日志 | <en/> Supports domain filtering: `{ enabled: true, domains: ['data', 'edit'] }` only outputs specified domains
   *
   * @example
   * ```ts
   * :debug="true"
   * :debug="{ enabled: true, domains: ['data'], perf: true }"
   * ```
   *
   * @default false
   */
  debug?: boolean | DebugConfig
  /**
   * <zh/> 行 Pinning 配置——将指定行固定在顶部或底部 | <en/> Row pinning config — pin specified rows to top or bottom
   *
   * <zh/> 适用场景：汇总行、总计行、关键数据行需要在滚动时始终可见 | <en/> Use cases: summary rows, total rows, key data rows that need to remain visible during scrolling
   *
   * @example
   * ```ts
   * :row-pin-config="{ topRowKeys: ['total'], bottomRowKeys: ['summary'] }"
   * ```
   */
  rowPinConfig?: RowPinConfig
}

/**
 * <zh/> virtual 模式专属属性——`size`/`tableLayout` 在此模式下传参即编译报错（改走 `uiConfig.sizeConfig`）。
 * <en/> Virtual-mode-only props — passing `size`/`tableLayout` here is a compile error (tune density via `uiConfig.sizeConfig`).
 */
export interface AdvTableVirtualProps<T = Record<string, unknown>> extends AdvTableBaseProps<T> {
  /**
   * <zh/> 渲染模式 | <en/> Render mode
   *
   * @default 'virtual'
   */
  mode?: 'virtual'
  /**
   * <zh/> 本模式下不支持，传参即编译报错；virtual 密度改走 `uiConfig.sizeConfig`
   * <en/> Unsupported in this mode (compile error); tune virtual density via `uiConfig.sizeConfig`
   */
  size?: never
  /**
   * <zh/> 本模式下不支持，传参即编译报错；virtual 恒按显式列宽布局
   * <en/> Unsupported in this mode (compile error); virtual always lays out by explicit widths
   */
  tableLayout?: never
  /**
   * <zh/> virtual 模式下的预估行高（px），透传给 ElTableV2 的 `estimated-row-height` prop。
   * <zh/> **性能影响（重要）**：一旦本值为数值，ElTableV2 将从 `FixedSizeGrid` 切换到
   * <zh/> `DynamicSizeGrid`，对渲染中的行逐行 `getBoundingClientRect` 测量真实高度，
   * <zh/> 虚拟滚动性能显著下降。库内部在检测到 `append` 插槽或存在实际展开的详情行
   * <zh/> （`expandedRowKeys` 非空——仅配置 `rowExpandConfig` 展开能力而未展开任何行不触发）
   * <zh/> 时会自动回退到 `rowHeight`（即隐式进入该模式），以保证合成行内容不被裁切。
   * <en/> Estimated row height (px) in virtual mode, passed to ElTableV2's `estimated-row-height` prop.
   * <en/> **Performance impact (important)**: a number switches ElTableV2 from `FixedSizeGrid` to
   * <en/> `DynamicSizeGrid` with per-row measurement — virtual scroll degrades significantly.
   *
   * @default undefined
   */
  estimatedRowHeight?: number
}

/**
 * <zh/> default 模式专属属性——`estimatedRowHeight` 在此模式下传参即编译报错。
 * <en/> Default-mode-only props — passing `estimatedRowHeight` here is a compile error.
 */
export interface AdvTableDefaultProps<T = Record<string, unknown>> extends AdvTableBaseProps<T> {
  /**
   * <zh/> 渲染模式 | <en/> Render mode
   *
   * @default 'virtual'
   */
  mode?: 'default'
  /**
   * <zh/> 表格尺寸，透传给 ElTable 的 `size` prop | <en/> Table size, passed to ElTable's `size` prop
   *
   * @default 'default'
   */
  size?: TableProps<any>['size']
  /**
   * <zh/> 表格布局方式，透传给 ElTable 的 `table-layout` prop | <en/> Table layout, passed to ElTable's `table-layout` prop
   *
   * @default 'fixed'
   */
  tableLayout?: TableProps<any>['tableLayout']
  /**
   * <zh/> 本模式下不支持，传参即编译报错（dev 提示 `DEV_ESTIMATED_ROW_HEIGHT_DEFAULT_IGNORED` 保留用于 JS 侧）
   * <en/> Unsupported in this mode (compile error)
   */
  estimatedRowHeight?: never
}

/**
 * <zh/> 表格属性——按 `mode` 判别的联合类型。单模式专属 prop 传错模式即编译报错，
 * <zh/> 不再是运行期静默忽略。未指定 `mode` 时两侧均可匹配（默认为 virtual 行为）。
 * <en/> Table props — discriminated union over `mode`. Single-mode props passed under the wrong
 * <en/> mode are compile errors instead of silently ignored at runtime.
 */
export type AdvTableProps<T = Record<string, unknown>> = AdvTableVirtualProps<T> | AdvTableDefaultProps<T>
