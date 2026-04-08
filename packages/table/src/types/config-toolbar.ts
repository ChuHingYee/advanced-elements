import type { AdvColumn } from './column'
import type { PollingOptions } from './config-api'
import type { ColumnMode, DataMode } from './scope'

/**
 * <zh/> 导出选项配置 — 支持文件名、工作表名、导出列/数据模式及 xlsx 透传参数 | <en/> exportoptionconfig — supportsfile名、工作表名、exportcolumn/datamode及 xlsx 透传parameter
 */
export interface ExportOptions {
  filename?: string
  sheetName?: string
  /**
   * <zh/> 导出列模式 | <en/> exportcolumnmode
   * <zh/> - 'visible': 仅导出当前可视列（默认） | <en/> - 'visible': 仅exportcurrent可视column（default）
   * <zh/> - 'all': 导出所有列（含被列设置隐藏的列，仍排除 selection/option 列） | <en/> - 'all': exportallcolumn（含被columnsethide的column，仍排除 selection/option column）
   */
  columnMode?: ColumnMode
  /**
   * <zh/> 自定义导出列配置 | <en/> 自definesexportcolumnconfig
   * <zh/> 传入后优先级最高，忽略 columnMode | <en/> 传入后priority最高，ignore columnMode
   */
  columns?: AdvColumn[]
  /**
   * <zh/> 导出数据模式 | <en/> exportdatamode
   * <zh/> - 'all': 导出全量数据（默认） | <en/> - 'all': exportfulldata（default）
   * <zh/> - 'current': 仅导出当前页数据 | <en/> - 'current': 仅exportcurrent页data
   * <zh/> - 'selected': 仅导出选中行数据 | <en/> - 'selected': 仅exportselectrowdata
   */
  dataMode?: DataMode
  /**
   * <zh/> xlsx writeFile 透传配置
   * <en/> xlsx writeFile passthrough config
   * @see https://docs.sheetjs.com/docs/api/write-options
   */
  xlsxOptions?: Record<string, unknown>
}

/**
 * <zh/> 工具栏配置 — 控制列设置、刷新、轮询、导出、导入等按钮的显示与选项 | <en/> 工具栏config — 控制columnset、refresh、轮询、export、import等button的show与option
 */
export interface ToolbarConfig {
  columnSetting?: boolean
  refreshBtn?: boolean
  pollingBtn?: boolean
  pollingOptions?: PollingOptions
  exportBtn?: boolean
  exportOptions?: ExportOptions
  exportCsvBtn?: boolean
  exportCsvOptions?: ExportCsvOptions
  importBtn?: boolean
  importOptions?: ImportOptions
  printBtn?: boolean
  printOptions?: PrintConfig
}

/**
 * <zh/> 工具栏配置类型（合并后形态）——除 exportOptions / exportCsvOptions / importOptions /
 * <zh/> printOptions 外均为必填。header.vue 与 use-table-config 共用此单一源，不得各自另定义。
 * <en/> Toolbar config type (merged shape) — all fields required except exportOptions /
 * <en/> exportCsvOptions / importOptions / printOptions. Shared by header.vue and use-table-config
 * <en/> as the single source; never redefine locally.
 */
export type RequiredToolbarConfig = Omit<Required<ToolbarConfig>, 'exportOptions' | 'exportCsvOptions' | 'importOptions' | 'printOptions'> & {
  exportOptions?: ToolbarConfig['exportOptions']
  exportCsvOptions?: ToolbarConfig['exportCsvOptions']
  importOptions?: ToolbarConfig['importOptions']
  printOptions?: ToolbarConfig['printOptions']
}

/**
 * <zh/> 导入配置（纯声明式——composable 读取配置、解析文件、emit 结果， | <en/> importconfig（纯声明式——composable 读取config、parsefile、emit 结果，
 * <zh/> 不直接修改表格内部状态，数据通过 `update:data` 流注入） | <en/> 不直接修改tableinternalstate，datavia `update:data` 流inject）
 */
export interface ImportOptions {
  /** <zh/> 默认 ['.csv', '.xlsx', '.xls'] | <en/> Defaults to ['.csv', '.xlsx', '.xls'] */
  accept?: string[]
  mode?: 'append' | 'replace'
  /** <zh/> 默认 'utf-8' | <en/> Defaults to 'utf-8' */
  encoding?: string
  /** <zh/> 默认 ',' | <en/> Defaults to ',' */
  delimiter?: string
  /** <zh/> 默认 true | <en/> Defaults to true */
  headerRow?: boolean
  /** <zh/> 超过截断并提示 | <en/> Truncate with a notice when exceeded */
  maxRows?: number
  /**
   * <zh/> 文件大小上限（字节），超过时拒绝导入并提示。默认 20MB（20 * 1024 * 1024）。
   * <zh/> 防止超大文件全量读入内存造成页面卡死。
   * <en/> Max file size in bytes; larger files are rejected with a notice. Defaults to 20MB
   * <en/> (20 * 1024 * 1024). Prevents huge files from being fully read into memory and freezing the page.
   */
  maxFileSize?: number
  /**
   * <zh/> 在列映射之前执行。支持异步（`await` 兼容同步返回值）——大文件可让出主线程做清洗。
   * <zh/> 返回 null 丢弃该行。
   * <en/> Executed before column mapping. Supports async (awaiting a sync return works) — large
   * <en/> files can yield the main thread for cleanup. Return null to drop the row.
   */
  transformRow?: (row: Record<string, unknown>, rowIndex: number) => Record<string, unknown> | null | Promise<Record<string, unknown> | null>
  /** <zh/> 返回 false 取消导入 | <en/> Return false to cancel the import */
  beforeImport?: (rows: Record<string, unknown>[], columns: string[]) => boolean | Promise<boolean>
  onImported?: (rows: Record<string, unknown>[]) => void
}

/**
 * <zh/> CSV 导出选项配置 — 支持文件名、列模式、数据模式及 BOM 头
 * <en/> CSV export options config — supports filename, column mode, data mode and BOM header
 *
 * <zh/> 注意：`utils/export-csv.ts` 另有同名泛型 `ExportCsvOptions<T>`（底层导出函数入参，含 data/ctx）。
 * <zh/> 本接口为工具栏配置侧选项；按需引用底层版本请用 `ExportCsvUtilOptions`。
 * <en/> Note: `utils/export-csv.ts` also has a same-named generic `ExportCsvOptions<T>` (the underlying
 * <en/> export function params, including data/ctx). This interface is the toolbar-config-side option;
 * <en/> to reference the underlying version, use `ExportCsvUtilOptions`.
 */
export interface ExportCsvOptions {
  filename?: string
  columnMode?: ColumnMode
  columns?: AdvColumn[]
  dataMode?: DataMode
  bom?: boolean
}

/**
 * <zh/> 打印配置 — 控制打印页标题、页面方向、分页、页眉页脚等 | <en/> printconfig — 控制print页title、页面direction、paginate、页眉页脚等
 */
export interface PrintConfig {
  /** <zh/> 打印页标题 | <en/> Print page title */
  sheetName?: string
  /** <zh/> 列模式，同导出 | <en/> Column mode, same as export */
  columnMode?: ColumnMode
  /** <zh/> 自定义列 | <en/> Custom columns */
  columns?: AdvColumn[]
  /** <zh/> 数据模式，同导出 | <en/> Data mode, same as export */
  dataMode?: DataMode
  /** <zh/> 页面方向，默认 'portrait' | <en/> Page orientation, defaults to 'portrait' */
  pageOrientation?: 'portrait' | 'landscape'
  /** <zh/> 纸张大小，默认 'A4' | <en/> Paper size, defaults to 'A4' */
  paperSize?: 'A4' | 'A3' | 'letter'
  /** <zh/> 每页行数（0 = 不分页，浏览器自动分页），默认 0 | <en/> Rows per page (0 = no pagination, browser auto-paginates), defaults to 0 */
  rowsPerPage?: number
  /** <zh/> 自定义打印样式（CSS 字符串） | <en/> Custom print style (CSS string) */
  style?: string
  /** <zh/> 自定义页眉 HTML 或函数 | <en/> Custom header HTML or function */
  headerHtml?: string | ((params: { currentPage: number, totalPages: number, sheetName: string }) => string)
  /** <zh/> 自定义页脚 HTML 或函数 | <en/> Custom footer HTML or function */
  footerHtml?: string | ((params: { currentPage: number, totalPages: number, sheetName: string }) => string)
  /** <zh/> 打印前回调，返回 false 取消 | <en/> Callback before printing; return false to cancel */
  beforePrint?: (params: { data: unknown[], columns: AdvColumn[] }) => boolean | Promise<boolean>
  /** <zh/> 打印完成回调 | <en/> Callback after printing completes */
  afterPrint?: () => void
  /** <zh/> 是否显示行号列，默认 false | <en/> Whether to show the row index column, defaults to false */
  showRowIndex?: boolean
}

/**
 * <zh/> 分页配置 — 控制分页启用、模式（客户端/手动/标准）、吸底、自动页大小等
 * <en/> Pagination config — controls pagination enablement, mode (client/manual/standard), sticky bottom and auto page size
 */
export interface PaginationConfig {
  enabled?: boolean
  /**
   * <zh/> 分页模式 | <en/> paginatemode
   * <zh/> - 'client': 客户端分页，自动切换 requestMode 为 'simple' | <en/> - 'client': client-sidepaginate，自动toggle requestMode 为 'simple'
   * <zh/> - 'manual': 手动分页 | <en/> - 'manual': 手动paginate
   * <zh/> - 'page': 标准分页（默认） | <en/> - 'page': 标准paginate（default）
   */
  mode?: 'page' | 'manual' | 'client'
  /**
   * <zh/> 无限滚动自动加载——manual 模式下滚动接近底部（virtual 模式的 endReached）时
   * <zh/> 自动触发 loadMore 并管理 loading/hasMore 防重入，无需消费者监听 endReached 手写胶水。
   * <zh/> 仅 virtual 渲染器产生 endReached，故该开关在 virtual 模式下生效；default 模式仍使用页脚按钮。
   * <en/> Infinite-scroll auto-loading — in manual mode, scrolling near the bottom (the virtual
   * <en/> renderer's endReached) automatically triggers loadMore with loading/hasMore re-entry
   * <en/> guards, removing the need for consumer-side endReached glue code.
   * <en/> Only the virtual renderer emits endReached, so this flag applies to virtual mode;
   * <en/> default mode keeps using the footer button.
   */
  infiniteScroll?: boolean
  sticky?: boolean
  containerHeight?: number
  /** <zh/> 根据容器高度自动计算每页条数 | <en/> Auto-calculate page size from container height */
  autoPageSize?: boolean
  /** <zh/> 用于 autoPageSize 计算（默认 48） | <en/> Used for autoPageSize calculation (default 48) */
  rowHeight?: number
  background?: boolean
  hideOnSinglePage?: boolean
  pagerCount?: number
  disabled?: boolean
}

/** <zh/> 扩展分页配置 — 继承 PaginationConfig，补充 total/pageSizes/pageSize 并透传 ElPagination 的 layout | <en/> Extended pagination config — extends PaginationConfig, adds total/pageSizes/pageSize and passes through ElPagination's layout */
export interface AdvPaginationConfig extends PaginationConfig {
  total?: number
  pageSizes?: number[]
  pageSize?: number
  /** <zh/> 透传 ElPagination 的 layout 属性 | <en/> Passthrough of ElPagination's layout prop */
  layout?: string
  /**
   * <zh/> 合成行是否计入分页容量——`true`（默认）时 DetailRow/GroupHeader 占用页容量，`false` 时仅数据行计入分页，合成行在分页后追加
   * <en/> Whether synthetic rows (DetailRow/GroupHeader) count towards pagination capacity — `true` (default) they occupy page capacity, `false` only data rows count and synthetics are appended after pagination
   */
  includeSynthetic?: boolean
}
