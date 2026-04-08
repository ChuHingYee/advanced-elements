/**
 * <zh/> Advanced Elements 全局配置类型
 * <en/> Global configuration types for Advanced Elements
 *
 * @remarks
 * <zh/> 设计遵循 Element Plus ConfigProvider 模式：以组件名为 key，key 与 AdvTableProps 的 prop 名保持一致。
 * <en/> Design follows Element Plus ConfigProvider pattern: component name as key,
 * keys mirror AdvTableProps prop names for consistency.
 *
 * @example
 * ```vue
 * <adv-config-provider :config="{
 *   table: {
 *     request: { transformRequest: (page, size, params) => ({ pageNum: page, pageSize: size, ...params }) },
 *     pagination: { pageSize: 20, pageSizes: [20, 50, 100] },
 *     search: { debounceTime: 500, buttons: ['query', 'reset', 'expand'] },
 *     toolbar: { columnSetting: true, refreshBtn: true, pollingOptions: { time: 5000 } },
 *   }
 * }">
 *   <app />
 * </adv-config-provider>
 * ```
 */

/**
 * <zh/> Table 组件全局配置
 * <en/> Table component global config
 *
 * @remarks
 * <zh/> key 与 `AdvTableProps` 的 prop 名一致。当 `<AdvTable>` 未指定对应 prop 时生效。组件 props 始终优先。
 * <zh/> 表格语言不在此配置：请使用 Element Plus 自身的 ConfigProvider（`locale`）切换语言，本包不设语言字段。
 * <en/> Keys mirror `AdvTableProps` prop names. These defaults are applied when
 * `<AdvTable>` does not specify the corresponding prop. Local props always take priority.
 * <en/> Table language is out of scope here: switch it via Element Plus's own ConfigProvider (`locale`).
 */
export interface AdvTableConfig {
  /**
   * <zh/> 性能档位——'low' 关闭滚动看门狗/滚动速度追踪/hover 鼠标追踪等重路径（低端设备降档）
   * <en/> Performance tier — 'low' disables heavy paths (scroll watchdog / scroll-velocity / hover mouse tracking) for low-end devices
   */
  performanceProfile?: 'high' | 'low'
  /**
   * <zh/> 默认请求配置
   * <en/> Default request configuration
   * @remarks Mirrors `props.request`
   */
  request?: {
    /**
     * <zh/> 是否在挂载时自动发送请求（默认 true）
     * <en/> Whether to auto-send request on mount (default: true)
     */
    auto?: boolean
    /**
     * <zh/> 响应解析的默认字段映射
     * <en/> Default format maps for response parsing
     *
     * @remarks
     * <zh/> 将响应字段名映射到标准字段（data, total）。例如 `{ list: 'data', totalCount: 'total' }` 对应 `{ list: [...], totalCount: 100 }`
     * <en/> Maps response field names to standard fields (data, total). E.g. `{ list: 'data', totalCount: 'total' }` for `{ list: [...], totalCount: 100 }`
     */
    formatMaps?: Record<string, string>
    /**
     * <zh/> 默认请求参数名映射
     * <en/> Default request param key mapping
     *
     * @remarks
     * <zh/> `transformRequest` 的声明式替代，仅用于字段名映射。例如 `{ page: 'currentPage', size: 'pageSize' }` 发送 `{ currentPage: 1, pageSize: 20 }` 而非 `{ page: 1, size: 20 }`
     * <en/> Declarative alternative to `transformRequest` for simple field renaming. E.g. `{ page: 'currentPage', size: 'pageSize' }` sends `{ currentPage: 1, pageSize: 20 }` instead of `{ page: 1, size: 20 }`
     */
    paramKeys?: { page?: string, size?: string }
    /**
     * <zh/> 默认请求参数转换
     * <en/> Default request params transformer
     *
     * @remarks
     * <zh/> 用于复杂转换（重构参数、添加字段等）。简单字段名映射请用 `paramKeys`
     * <en/> For complex transforms (restructure, add fields, etc.). For simple key renaming, prefer `paramKeys` instead
     */
    transformRequest?: (page: number, size: number, params: Record<string, unknown>) => Record<string, unknown>
    /**
     * <zh/> 默认响应数据转换
     * <en/> Default response data transformer
     */
    transformResponse?: (response: unknown) => unknown
  }

  /**
   * <zh/> 默认分页配置
   * <en/> Default pagination configuration
   * @remarks Mirrors `props.pagination`
   */
  pagination?: {
    /** <zh/> 是否启用分页（默认 true） | <en/> Whether pagination is enabled (default: true) */
    enabled?: boolean
    /** <zh/> 默认每页条数（默认 10） | <en/> Default page size (default: 10) */
    pageSize?: number
    /** <zh/> 默认每页条数选项（默认 [10, 20, 30]） | <en/> Default page size options (default: [10, 20, 30]) */
    pageSizes?: number[]
    /** <zh/> 默认分页布局（默认 'total, sizes, prev, pager, next, jumper'） | <en/> Default pagination layout (default: 'total, sizes, prev, pager, next, jumper') */
    layout?: string
    /** <zh/> 默认分页背景色 | <en/> Default pagination background */
    background?: boolean
    /** <zh/> 默认分页模式（默认 'page'） | <en/> Default pagination mode (default: 'page') */
    mode?: 'page' | 'manual' | 'client'
    /** <zh/> 分页是否固定底部（默认 true） | <en/> Whether pagination sticks to bottom (default: true) */
    sticky?: boolean
    /** <zh/> 虚拟滚动容器默认高度（默认 450） | <en/> Default container height for virtual scroll (default: 450) */
    containerHeight?: number
    /** <zh/> 虚拟滚动默认行高（默认 48） | <en/> Default row height for virtual scroll (default: 48) */
    rowHeight?: number
    /** <zh/> 根据容器高度自动计算每页条数（默认 false） | <en/> Auto-calculate page size based on container height (default: false) */
    autoPageSize?: boolean
    /** <zh/> 无限滚动自动加载（manual + virtual 模式，默认 false） | <en/> Infinite-scroll auto-loading (manual + virtual modes, default: false) */
    infiniteScroll?: boolean
  }

  /**
   * <zh/> 默认搜索配置
   * <en/> Default search configuration
   * @remarks Mirrors `props.search`
   */
  search?: {
    /** <zh/> 是否启用搜索栏（默认 false） | <en/> Whether search bar is enabled (default: false) */
    enabled?: boolean
    /** <zh/> 搜索栏是否默认折叠 | <en/> Whether search bar is collapsed by default (default: false) */
    collapsed?: boolean
    /** <zh/> 默认搜索按钮（默认 ['query', 'reset']） | <en/> Default search buttons (default: ['query', 'reset']) */
    buttons?: ('query' | 'reset' | 'add' | 'fullscreen')[]
    /** <zh/> 搜索防抖时间（默认 300） | <en/> Default search debounce time in ms (default: 300) */
    debounceTime?: number
    /** <zh/> 搜索字段栅格跨度（默认 6） | <en/> Default search field span (default: 6) */
    span?: number
  }

  /**
   * <zh/> 默认工具栏配置
   * <en/> Default toolbar configuration
   * @remarks Mirrors `props.toolbar`
   */
  toolbar?: {
    /** <zh/> 显示列设置按钮（默认 true） | <en/> Show column setting button (default: true) */
    columnSetting?: boolean
    /** <zh/> 显示刷新按钮（默认 false） | <en/> Show refresh button (default: false) */
    refreshBtn?: boolean
    /** <zh/> 显示轮询按钮（默认 false） | <en/> Show polling button (default: false) */
    pollingBtn?: boolean
    /** <zh/> 默认轮询选项 | <en/> Default polling options */
    pollingOptions?: {
      /** <zh/> 轮询间隔（默认 3000） | <en/> Polling interval in ms (default: 3000) */
      time?: number
      /** <zh/> 是否立即开始轮询（默认 false） | <en/> Start polling immediately (default: false) */
      immediate?: boolean
    }
    /** <zh/> 显示导出 Excel 按钮（默认 false） | <en/> Show export Excel button (default: false) */
    exportBtn?: boolean
    /** <zh/> 默认 Excel 导出选项 | <en/> Default Excel export options */
    exportOptions?: {
      /** <zh/> 默认文件名（默认 'export'） | <en/> Default filename (default: 'export') */
      filename?: string
      /** <zh/> 默认 sheet 名（默认 'Sheet1'） | <en/> Default sheet name (default: 'Sheet1') */
      sheetName?: string
      /** Default column mode (default: 'visible') / 默认列模式 */
      columnMode?: 'visible' | 'all'
    }
    /** <zh/> 显示导出 CSV 按钮（默认 false） | <en/> Show export CSV button (default: false) */
    exportCsvBtn?: boolean
    /** <zh/> 默认 CSV 导出选项 | <en/> Default CSV export options */
    exportCsvOptions?: {
      /** <zh/> 默认文件名（默认 'export'） | <en/> Default filename (default: 'export') */
      filename?: string
      /** <zh/> 默认列模式（默认 'visible'） | <en/> Default column mode (default: 'visible') */
      columnMode?: 'visible' | 'all'
    }
    /** <zh/> 显示导入按钮（默认 false） | <en/> Show import button (default: false) */
    importBtn?: boolean
    /**
     * <zh/> 默认导入选项
     * <en/> Default import options
     * @remarks
     * <zh/> 完整结构与 table 包的 `ImportOptions` 一致，此处松散声明以避免跨包类型依赖
     * <en/> Complete structure mirrors table package's `ImportOptions`; declared loosely here to avoid cross-package type dependency
     */
    importOptions?: Record<string, unknown>
    /** <zh/> 显示打印按钮（默认 false） | <en/> Show print button (default: false) */
    printBtn?: boolean
    /**
     * <zh/> 默认打印选项
     * <en/> Default print options
     * @remarks
     * <zh/> 完整结构与 table 包的 `PrintConfig` 一致，此处松散声明以避免跨包类型依赖
     * <en/> Complete structure mirrors table package's `PrintConfig`; declared loosely here to avoid cross-package type dependency
     */
    printOptions?: Record<string, unknown>
  }

  /**
   * <zh/> 是否显示表格边框（默认 true）
   * <en/> Whether to show table borders (default: true)
   */
  border?: boolean

  /**
   * <zh/> 是否允许拖拽调整列宽（默认 true）
   * <en/> Whether to allow column resize by dragging (default: true)
   */
  resizable?: boolean

  /**
   * <zh/> 默认容器布局模式（默认 'bordered'）
   * <en/> Default container layout mode (default: 'bordered')
   *
   * @remarks Mirrors `props.containerLayout`
   */
  containerLayout?: 'bordered' | 'bare'

  /**
   * <zh/> 默认行配置
   * <en/> Default row configuration
   * @remarks Mirrors `props.rowConfig`
   */
  rowConfig?: {
    /** <zh/> 行选择模式（默认 'multiple'） | <en/> Row selection mode (default: 'multiple') */
    rowSelection?: 'single' | 'multiple'
    /** <zh/> 允许单击多选（默认 true） | <en/> Allow multi-select by simply clicking rows (default: true) */
    rowMultiSelectWithClick?: boolean
    /** <zh/> 禁止点击行选中（默认 false） | <en/> Suppress row-click-to-select (default: false) */
    suppressRowClickSelection?: boolean
    /** <zh/> 点击行触发选中（默认 true） | <en/> Click row to select (default: true) */
    rowClickSelect?: boolean
    /** <zh/> 启用行拖拽（默认 false） | <en/> Enable row dragging (default: false) */
    rowDraggable?: boolean
    /** <zh/> 拖拽手柄选择器（默认 ''） | <en/> Drag handle selector (default: '') */
    rowDragHandle?: string
  }

  /**
   * <zh/> 默认列配置
   * <en/> Default column configuration
   * @remarks Mirrors `props.columnConfig`
   */
  columnConfig?: {
    /** <zh/> 启用列设置侧边面板（默认 false） | <en/> Enable column setting side panel (default: false) */
    sidePanel?: boolean
    /** <zh/> 列设置侧边面板位置（默认 'right'） | <en/> Column setting side panel position (default: 'right') */
    sidePanelPosition?: 'left' | 'right'
    /** <zh/> 列设置侧边面板默认展开（默认 false） | <en/> Column setting side panel default open state (default: false) */
    sidePanelDefaultOpen?: boolean
    /** <zh/> 关闭面板时销毁 DOM（默认 true） | <en/> Destroy panel DOM when closed (default: true) */
    sidePanelDestroyOnClose?: boolean
  }

  /**
   * <zh/> 默认筛选配置
   * <en/> Default filter configuration
   * @remarks Mirrors `props.filterConfig`
   */
  filterConfig?: {
    /** <zh/> 启用侧边筛选面板（默认 false） | <en/> Enable side filter panel (default: false) */
    sidePanel?: boolean
    /** <zh/> 侧边筛选面板位置（默认 'right'） | <en/> Side filter panel position (default: 'right') */
    sidePanelPosition?: 'left' | 'right'
    /** <zh/> 侧边筛选面板默认展开（默认 false） | <en/> Side filter panel default open state (default: false) */
    sidePanelDefaultOpen?: boolean
    /** <zh/> 关闭面板时销毁 DOM（默认 true） | <en/> Destroy panel DOM when closed (default: true) */
    sidePanelDestroyOnClose?: boolean
    /** <zh/> 启用列头浮动筛选（默认 false） | <en/> Enable floating filter in column headers (default: false) */
    floatingFilter?: boolean
  }

  /**
   * <zh/> 默认 URL 状态配置
   * <en/> Default URL state configuration
   * @remarks Mirrors `props.urlState`
   */
  urlState?: {
    /** <zh/> 是否启用 URL 状态同步（默认 false） | <en/> Enable URL state sync (default: false) */
    enabled?: boolean
    /** <zh/> 页码 URL 参数名（默认 'p'） | <en/> URL param key for page number (default: 'p') */
    pageKey?: string
    /** <zh/> 每页条数 URL 参数名（默认 's'） | <en/> URL param key for page size (default: 's') */
    sizeKey?: string
  }

  /**
   * <zh/> 默认 UI 配置
   * <en/> Default UI configuration
   *
   * @remarks
   * <zh/> 仅保留 table 专属设置，`size` 和 `namespace` 由 Element Plus 自身的 ConfigProvider 处理
   * <en/> Only table-specific settings — `size` and `namespace` are handled by Element Plus's own ConfigProvider
   */
  uiConfig?: {
    /** <zh/> 列数据为空时的默认显示文字（默认 '-'） | <en/> Default empty text for columns (default: '-') */
    columnEmptyText?: string
    /**
     * <zh/> 默认尺寸配置
     * <en/> Default size config
     * @remarks
     * <zh/> 覆盖尺寸预设（large/default/small）的个别值。完整结构与 table 包的 `SizeConfig` 一致
     * <en/> Overrides individual values of the size preset (large/default/small). Complete structure mirrors table package's `SizeConfig`
     */
    sizeConfig?: {
      /** <zh/> 影响表头高度计算与多级表头 rowspan | <en/> Affects headerHeight calc and multi-level header rowspan */
      headerCellHeight?: number
      /** <zh/> CSS 简写或 [垂直, 水平] 数组 | <en/> CSS shorthand like "8px 12px" or [vertical, horizontal] array */
      cellPadding?: string | [number, number]
      /** <zh/> 语法同 cellPadding | <en/> Same syntax as cellPadding */
      headerCellPadding?: string | [number, number]
      /** <zh/> 仅 floatingFilter 开启时生效 | <en/> Only effective when floatingFilter enabled */
      floatingFilterHeight?: number
      cellFontSize?: string
      /** <zh/> 虚拟模式行高，用于 autoPageSize 计算 | <en/> Virtual mode row height, used for autoPageSize calc */
      rowHeight?: number
      /** <zh/> 仅虚拟模式生效 | <en/> Virtual mode only */
      summaryRowHeight?: number
    }
  }

  /**
   * <zh/> 事件拦截器配置
   * <en/> Event interceptor configuration
   *
   * @remarks
   * <zh/> 拦截器在默认行为之前运行。返回 `true` 阻止默认行为（类似 VxeTable 的 `VXETable.interceptor.add`）。实例级拦截器（来自 `interceptor` prop）优先于全局拦截器执行
   * <en/> Interceptors run before the default behavior. Return `true` to prevent the default action (similar to VxeTable's `VXETable.interceptor.add`). Instance-level interceptors (from `interceptor` prop) run before global ones
   */
  interceptor?: Record<string, (params: unknown) => boolean | void>

  /**
   * <zh/> 表格数据为空时的默认提示文字（默认 Element Plus 内置）
   * <en/> Default empty text when table data is empty (default: Element Plus built-in)
   */
  emptyText?: string

  /**
   * <zh/> 自定义通知通道——覆盖默认的 ElMessage 通知行为
   *
   * <zh/> 默认使用 Element Plus 的 ElMessage 显示通知。消费方可通过此字段注入自定义通知实现，
   * <zh/> 例如使用 ant-design-vue 的 message 组件、Naive UI 的 useMessage 等。
   * <zh/> 在 SSR 场景下，默认通道会降级到 console 输出。
   *
   * <en/> Custom notification channel — overrides default ElMessage notification behavior
   * <en/> By default, Element Plus's ElMessage is used. Consumers can inject custom notification
   * <en/> implementations via this field, e.g. ant-design-vue's message, Naive UI's useMessage, etc.
   * <en/> Under SSR, the default channel degrades to console output.
   *
   * @example
   * ```typescript
   * // 使用 ant-design-vue 的 message
   * { notify: (type, message) => antdMessage[type](message) }
   * ```
   */
  notify?: (type: 'success' | 'warning' | 'error' | 'info', message: string, source: string) => void
}

/**
 * <zh/> Advanced Elements 全局配置，组件名为 key
 * <en/> Advanced Elements global config — component name as key
 *
 * @remarks
 * <zh/> 每个键对应一个组件的可配置默认值
 * <en/> Each key corresponds to a component's configurable defaults
 */
export interface AdvConfig {
  /** <zh/> Table 组件配置 | <en/> Table component config */
  table?: AdvTableConfig
  // 后续组件可在此添加：
  // Future components can be added here:
  // form?: AdvFormConfig
  // dialog?: AdvDialogConfig
}
