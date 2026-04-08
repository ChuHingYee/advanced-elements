import type { ButtonProps, Column, FormItemProps, TagProps } from 'element-plus'
import type { Component, VNode } from 'vue'
import type { MenuOptionInput } from './context-menu'
import type { CellEditorParams, CellEditorSelectorResult, CellEditorType, ColumnEditorRules } from './edit'

/**
 * <zh/> 列搜索配置 — 所有搜索相关设置收拢在一起
 * <en/> Column search config — all search-related settings consolidated together
 */
export interface ColumnSearchConfig {
  /** <zh/> 搜索字段默认值，初始化时自动填入表单 | <en/> Default value for the search field, auto-filled into the form on init */
  defaultValue?: unknown
  /** <zh/> 发送请求前转换搜索值 | <en/> Transform the search value before sending the request */
  transform?: (value: unknown) => unknown
  /** <zh/> 越大越靠前 | <en/> Larger value sorts earlier */
  order?: number
  /** <zh/> 在搜索表单中隐藏 | <en/> Hide in the search form */
  hidden?: boolean
  /** <zh/> 传递给搜索表单组件（如 ElInput/ElSelect）的属性 | <en/> Props passed to the search form component (e.g. ElInput/ElSelect) */
  fieldProps?: Record<string, unknown>
  /** <zh/> 传递给 ElFormItem 的属性 | <en/> Props passed to ElFormItem */
  formItemProps?: Partial<FormItemProps>
}

/**
 * <zh/> 列值类型枚举
 * <en/> Column value type enumeration
 * <zh/>
 * - text: 纯文本
 * - textarea: 多行文本
 * - money: 货币格式
 * - digit: 数字
 * - percent: 百分比
 * - progress: 进度条
 * - date: 日期
 * - dateTime: 日期时间
 * - dateRange: 日期范围
 * - dateTimeRange: 日期时间范围
 * - monthRange: 月份范围
 * - year: 年份
 * - yearRange: 年份范围
 * - time: 时间
 * - fromNow: 相对时间（xx前/xx后）
 * - select: 下拉选择
 * - radio: 单选
 * - checkbox: 多选
 * - switch: 开关
 * - avatar: 头像
 * - image: 单张图片
 * - images: 多张图片
 * - link: 链接
 * - code: 代码块
 * - jsonCode: JSON 代码高亮
 * - rate: 评分
 * - color: 颜色选择器
 * - index: 序号
 * - indexBorder: 带边框序号
 * - option: 操作列
 * - sparkline: 迷你趋势图
 * <en/>
 * - text: plain text
 * - textarea: multiline text
 * - money: currency format
 * - digit: number
 * - percent: percentage
 * - progress: progress bar
 * - date: date
 * - dateTime: date & time
 * - dateRange: date range
 * - dateTimeRange: date-time range
 * - monthRange: month range
 * - year: year
 * - yearRange: year range
 * - time: time
 * - fromNow: relative time (xx ago/later)
 * - select: dropdown select
 * - radio: radio
 * - checkbox: multiple choice
 * - switch: switch
 * - avatar: avatar
 * - image: single image
 * - images: multiple images
 * - link: link
 * - code: code block
 * - jsonCode: JSON code highlight
 * - rate: rating
 * - color: color picker
 * - index: index number
 * - indexBorder: bordered index number
 * - option: action column
 * - sparkline: mini trend line chart (SVG)
 */
export type BuiltinValueType
  = | 'text'
    | 'textarea'
    | 'money'
    | 'digit'
    | 'percent'
    | 'progress'
    | 'date'
    | 'dateTime'
    | 'dateRange'
    | 'dateTimeRange'
    | 'monthRange'
    | 'year'
    | 'yearRange'
    | 'time'
    | 'fromNow'
    | 'select'
    | 'radio'
    | 'checkbox'
    | 'switch'
    | 'avatar'
    | 'image'
    | 'images'
    | 'link'
    | 'code'
    | 'jsonCode'
    | 'rate'
    | 'color'
    | 'index'
    | 'indexBorder'
    | 'option'
    | 'sparkline'

/**
 * <zh/> 内置 valueType 全量清单——与 `BuiltinValueType` 同源，穷举单测与注册表冲突校验的真源。
 * <zh/> 以 Record 形态声明：增减成员而不同步另一侧即编译失败，不再依赖测试断言长度。
 * <en/> Exhaustive list of built-in valueTypes — same source as `BuiltinValueType`, ground truth for exhaustive tests and registry collision checks.
 * <en/> Declared as a Record: adding/removing a member without syncing the other side fails compilation.
 */
export const BUILTIN_VALUE_TYPES: Record<BuiltinValueType, true> = {
  text: true,
  textarea: true,
  money: true,
  digit: true,
  percent: true,
  progress: true,
  date: true,
  dateTime: true,
  dateRange: true,
  dateTimeRange: true,
  monthRange: true,
  year: true,
  yearRange: true,
  time: true,
  fromNow: true,
  select: true,
  radio: true,
  checkbox: true,
  switch: true,
  avatar: true,
  image: true,
  images: true,
  link: true,
  code: true,
  jsonCode: true,
  rate: true,
  color: true,
  index: true,
  indexBorder: true,
  option: true,
  sparkline: true,
}

/**
 * <zh/> 列值类型——内置 31 种开箱即用，第三方可通过 `registerValueType` 注册任意字符串类型（与 `CellEditorType` 对齐的开放联合类型，保留自动补全）。
 * <en/> Column value type — 32 built-ins out of the box; third parties may register any string type via `registerValueType` (open union aligned with `CellEditorType`, keeping autocompletion).
 */
export type ValueType = BuiltinValueType | (string & {})

/** <zh/> Tag 状态类型，取自 Element Plus TagProps['type']，用于 EnumItem.status 着色 | <en/> Tag status type, taken from Element Plus TagProps['type'], used for EnumItem.status coloring */
export type TagStatus = TagProps['type']

/** <zh/> 枚举映射项 — text 为显示文本，status 控制 Tag 颜色，color 为自定义色值 | <en/> Enum mapping item — text is the display text, status controls Tag color, color is a custom color value */
export interface EnumItem {
  text: string
  status?: TagStatus
  color?: string
}

/** <zh/> 列值枚举字典 — 键为数据值，值为显示文本或 EnumItem（含状态 / 颜色） | <en/> Column value enum dictionary — key is the data value, value is display text or EnumItem (with status / color) */
export type ValueEnum = Record<string, EnumItem | string>

/**
 * <zh/> 传递给 `cellClassRules` 中的每个断言函数
 * <en/> Predicate function passed to each entry of `cellClassRules`
 */
export interface CellClassRuleParams<T = any> {
  /** <zh/> 当前行数据 | <en/> Current row data */
  row: T
  /** <zh/> 当前单元格的原始数据值 | <en/> Original data value of the current cell */
  cellData: unknown
  /** <zh/> 当前列的 AdvColumn 配置 | <en/> AdvColumn config of the current column */
  column: AdvColumn<T>
  /** <zh/> 当前行在数据数组中的索引 | <en/> Index of the current row in the data array */
  rowIndex: number
  /** <zh/> 当前列在所有列中的索引 | <en/> Index of the current column among all columns */
  columnIndex: number
}

/** <zh/> 与 Element Plus TableV2 ColumnCommonParams 对齐 | <en/> Aligned with Element Plus TableV2 ColumnCommonParams */
export interface ColumnCommonParams<T = any> {
  columns: Column<T>[]
  column: Column<T>
  columnIndex: number
}

/** <zh/> 与 Element Plus TableV2 RowCommonParams 对齐 | <en/> Aligned with Element Plus TableV2 RowCommonParams */
export interface RowCommonParams<T = any> {
  rowData: T
  rowIndex: number
}

/** <zh/> 与 Element Plus TableV2 CellRendererParams 对齐 | <en/> Aligned with Element Plus TableV2 CellRendererParams */
export type CellRendererParams<T = any> = {
  cellData: T
} & RowCommonParams<T> & ColumnCommonParams<T>

/** <zh/> 与 Element Plus TableV2 HeaderCellRendererParams 对齐 | <en/> Aligned with Element Plus TableV2 HeaderCellRendererParams */
export type HeaderCellRendererParams<T = any> = {
  headerIndex: number
} & ColumnCommonParams<T>

/**
 * <zh/> 基于 Element Plus CellRendererParams，将 column 覆盖为 AdvColumn
 * <en/> Based on Element Plus CellRendererParams, overrides column as AdvColumn
 */
export interface CellContext<T = any>
  extends Omit<CellRendererParams<T>, 'column' | 'columns' | 'cellData'> {
  /** <zh/> 所有列配置（覆盖为 AdvColumn 类型） | <en/> All column configs (overridden as AdvColumn type) */
  columns: AdvColumn<T>[]
  /** <zh/> 当前列配置（覆盖为 AdvColumn 类型） | <en/> Current column config (overridden as AdvColumn type) */
  column: AdvColumn<T>
  /** <zh/> 单元格数据值（相对底层类型放宽为 unknown） | <en/> Cell data value (widened to unknown from the base type) */
  cellData: unknown
}

/**
 * <zh/> 传递给 `column.format`，与 CellComponentProps 字段对齐
 * <en/> Passed to `column.format`, fields aligned with CellComponentProps
 */
export interface FormatContext<T = any> {
  /** <zh/> 当前行数据 | <en/> Current row data */
  row: T
  /** <zh/> 从 row[column.prop] 解析 | <en/> Parsed from row[column.prop] */
  cellData: unknown
  /** <zh/> 当前列配置 | <en/> Current column config */
  column: AdvColumn<T>
  /** <zh/> 所有列配置 | <en/> All column configs */
  columns: AdvColumn<T>[]
  /** <zh/> 行索引 | <en/> Row index */
  index: number
  /** <zh/> 列索引 | <en/> Column index */
  columnIndex: number
}

/**
 * <zh/> 传递给 `cellComponent` 的 props — `cellRenderer` 的模板友好替代方案
 * <en/> Props passed to `cellComponent` — a template-friendly alternative to `cellRenderer`
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import type { CellComponentProps } from 'advanced-elements/table'
 * const props = defineProps<CellComponentProps>
 * </script>
 * <template>
 *   <el-tag :type="props.cellData === 'active' ? 'success' : 'danger'">
 *     {{ props.cellData }}
 *   </el-tag>
 * </template>
 * ```
 */
export interface CellComponentProps<T = any> extends FormatContext<T> {}

/**
 * <zh/> 基于 Element Plus HeaderCellRendererParams，将 column 覆盖为 AdvColumn
 * <en/> Based on Element Plus HeaderCellRendererParams, overrides column as AdvColumn
 */
export interface HeaderCellContext<T = any>
  extends Omit<HeaderCellRendererParams<T>, 'column' | 'columns'> {
  /** <zh/> 所有列配置（覆盖为 AdvColumn 类型） | <en/> All column configs (overridden as AdvColumn type) */
  columns: AdvColumn<T>[]
  /** <zh/> 当前列配置（覆盖为 AdvColumn 类型） | <en/> Current column config (overridden as AdvColumn type) */
  column: AdvColumn<T>
}

/** <zh/> 操作按钮回调上下文 — 提供当前行数据与行索引 | <en/> Action button callback context — provides current row data and row index */
export interface ActionContext<T = any> {
  /** <zh/> 当前行数据 | <en/> Current row data */
  row: T
  /** <zh/> 行索引 | <en/> Row index */
  index: number
}

/** <zh/> 操作列按钮配置 — 渲染于 valueType 为 'option' 的列 | <en/> Action column button config — rendered in columns whose valueType is 'option' */
export interface ActionConfig<T = any> {
  /** <zh/> 按钮文本 | <en/> Button label */
  label: string
  /** <zh/> 点击回调，接收操作按钮上下文 | <en/> Click callback, receives the action context */
  onClick?: (context: ActionContext<T>) => void
  /** <zh/> 不传则默认显示 | <en/> Defaults to visible when not provided */
  visible?: boolean | ((context: ActionContext<T>) => boolean)
  /** <zh/> 是否禁用；传函数时按行动态判定 | <en/> Whether disabled; a function computes it per row */
  disabled?: boolean | ((context: ActionContext<T>) => boolean)
  /** <zh/> 按钮类型，取值同 ElButton 的 type | <en/> Button type, same values as ElButton's type */
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default'
  /** <zh/> 按钮尺寸 | <en/> Button size */
  size?: 'large' | 'default' | 'small'
  /** <zh/> 是否为文字（link）按钮 | <en/> Whether it is a link button */
  link?: boolean
  /** <zh/> 按钮图标（组件或图标名字符串） | <en/> Button icon (component or icon name string) */
  icon?: Component | string
  /** <zh/> 传递给 ElButton 的其他属性 | <en/> Other props passed to ElButton */
  buttonProps?: Partial<ButtonProps>
}

/**
 * <zh/> 内置筛选类型
 * <en/> Built-in filter types
 * <zh/>
 * - 'text': 文本模糊搜索
 * - 'number': 数字筛选（大于/小于/范围）
 * - 'date': 日期筛选（之前/之后/范围）
 * - 'enum': 枚举勾选（从当前列数据提取去重值）
 * <en/>
 * - 'text': fuzzy text search
 * - 'number': number filter (greater/less/range)
 * - 'date': date filter (before/after/range)
 * - 'enum': enum checkbox (dedup values extracted from current column data)
 */
export type BuiltinColumnFilterType = 'text' | 'number' | 'date' | 'enum'

/** <zh/> `(string & {})` 交叉类型允许任意字符串字面量，同时保留内置类型的自动补全 | <en/> The `(string & {})` intersection type allows arbitrary string literals while preserving autocomplete for built-in types */
export type ColumnFilterType = BuiltinColumnFilterType | (string & {})

/** <zh/> 枚举筛选下拉选项 — label 为展示文本，value 为实际匹配的数据值 | <en/> Enum filter dropdown option — label is the display text, value is the actual matched data value */
export interface EnumFilterOption {
  /** <zh/> 展示文本 | <en/> Display text */
  label: string
  /** <zh/> 实际匹配的数据值 | <en/> The actual data value to match */
  value: string | number
}

/**
 * <zh/> 列筛选配置——列级 `filter` 字段的完整形态
 * <en/> Column filter config — full shape of the column-level `filter` field
 */
export interface ColumnFilterConfig<T = any> {
  /** <zh/> 筛选类型：'text' | 'number' | 'date' | 'enum' 或自定义字符串 | <en/> Filter type: 'text' | 'number' | 'date' | 'enum' or a custom string */
  type: ColumnFilterType
  /** <zh/> 仅 type 为 'enum' 时生效；未提供时从当前页数据自动提取 | <en/> Only effective when type is 'enum'; when not provided, auto-extracted from current page data */
  options?: EnumFilterOption[]
  /**
   * <zh/> 当列有 format 函数时，是否使用格式化后的值进行筛选。
   * <en/> Whether to filter using the formatted value when the column has a format function.
   * <zh/> 默认 true（筛选格式化值），false 时筛选原值。
   * <en/> Defaults to true (filter formatted value); when false, filter the raw value.
   */
  filterByFormat?: boolean
  /**
   * <zh/> 自定义过滤取值 — 决定过滤时使用哪个值
   * <en/> Custom filter value — decides which value to use when filtering
   * <zh/> 适用于自定义 cellRenderer、按不同值过滤、多字段组合过滤等场景
   * <en/> Suitable for custom cellRenderer, filtering by different values, multi-field combined filtering, etc.
   */
  filterValue?: (row: T, cellData: unknown) => unknown
  /** <zh/> 自定义浮动筛选组件 | <en/> Custom floating filter component */
  floatingFilterComponent?: Component
  /** <zh/> 传递给自定义浮动筛选组件的参数 | <en/> Params passed to the custom floating filter component */
  floatingFilterParams?: Record<string, unknown>
}

/**
 * <zh/> 列排序配置
 * <en/> Column sort config
 * <zh/> 接受与 Element Plus `sortable` 相同的值：
 * <en/> Accepts the same values as Element Plus `sortable`:
 * - true: client-side sort
 * - 'custom': server-side sort
 * - false / undefined: no sort
 * <zh/> 或 ColumnSortableConfig 对象
 * <en/> or a ColumnSortableConfig object
 */
export interface ColumnSortableConfig<T = any> {
  /** <zh/> 排序模式：'client' 客户端排序 | 'server' 服务端排序 | <en/> Sort mode: 'client' for client-side sort, 'server' for server-side sort */
  type: 'client' | 'server'
  /**
   * <zh/> 自定义排序取值
   * <en/> Custom sort value
   * <zh/>
   * - string: 使用不同 prop 排序
   * - string[]: 使用第一个非空值
   * - (row) => unknown: 自定义函数
   * <en/>
   * - string: sort by a different prop
   * - string[]: use the first non-empty value
   * - (row) => unknown: custom function
   */
  sortBy?: string | string[] | ((row: T) => unknown)
  /**
   * <zh/> 列有 format 函数时，是否使用格式化后的显示值排序
   * <en/> Whether to sort by the formatted display value when the column has a format function
   * <zh/> 默认 false
   * <en/> Defaults to false
   */
  sortByFormat?: boolean
  /**
   * <zh/> 自定义排序比较函数
   * <en/> Custom sort compare function
   * <zh/> 设置后忽略 sortBy / sortByFormat
   * <en/> Once set, sortBy / sortByFormat are ignored
   */
  sortMethod?: (a: T, b: T) => number
}

/** <zh/> 列排序开关：布尔值直接启停，`'custom'` 走远程/手动排序，对象为本地排序配置 | <en/> Column sort toggle: boolean switches directly, `'custom'` delegates to remote/manual sorting, object is local sort config */
export type ColumnSortable = boolean | 'custom' | ColumnSortableConfig

/** <zh/> 传入相邻两行，返回 true 表示合并（rowspan）这两行 | <en/> Given two adjacent rows, return true to merge (rowspan) them */
export type RowSpanCompareFn = (rowA: unknown, rowB: unknown) => boolean

/**
 * <zh/> 行合并配置（rowspan）
 * <en/> Row span config (rowspan)
 * <zh/>
 * - true: 按 prop 值相等自动合并
 * - (a, b) => boolean: 自定义比较函数
 * <en/>
 * - true: auto-merge by equal prop values
 * - (a, b) => boolean: custom compare function
 */
export type ColumnRowSpanConfig = boolean | RowSpanCompareFn

/** <zh/> 列 prop 作为 key，值为合并规则。当列自身未定义 spanRows 时回退到此配置 | <en/> Column prop as key, value is the merge rule. Falls back to this config when the column itself doesn't define spanRows */
export type RowSpanCellsConfig = Record<string, ColumnRowSpanConfig>

/**
 * <zh/> 声明式合并区域
 * <en/> Declarative merge region
 * <zh/> 指定精确的矩形合并区域，类似 HTML 的 rowspan/colspan
 * <en/> Specifies an exact rectangular merge region, similar to HTML's rowspan/colspan
 */
export interface SpanRange {
  /** <zh/> 合并区域起始行索引 | <en/> Start row index of the merge region */
  row: number
  /** <zh/> 合并区域起始列索引 | <en/> Start column index of the merge region */
  col: number
  /** <zh/> 纵向合并行数 | <en/> Number of rows to merge vertically */
  rowspan: number
  /** <zh/> 横向合并列数 | <en/> Number of columns to merge horizontally */
  colspan: number
}

/**
 * <zh/> 单元格合并信息
 * <en/> Cell span info
 * <zh/>
 * - 起点单元格（isOrigin: true）：合并区域的左上角
 * - 隐藏单元格（isOrigin: false）：被合并区域覆盖的单元格
 * <en/>
 * - origin cell (isOrigin: true): top-left corner of the merged region
 * - hidden cell (isOrigin: false): cell covered by the merged region
 */
export interface SpanInfo {
  /** <zh/> 0 = 被其他单元格合并的隐藏单元格 | <en/> 0 = hidden cell merged by another cell */
  rowspan: number
  /** <zh/> 横向合并列数；0 = 被其他单元格合并的隐藏单元格 | <en/> Number of columns to merge horizontally; 0 = hidden cell merged by another cell */
  colspan: number
  /** <zh/> 是否为合并组的起点（左上角） | <en/> Whether this is the origin (top-left) of a merged group */
  isOrigin: boolean
}

/** <zh/> 传入当前行、左侧列 prop 和当前列 prop，返回 true 表示横向合并（colspan） | <en/> Given current row, left column prop and current column prop, return true to merge horizontally (colspan) */
export type ColSpanCompareFn = (row: unknown, leftColProp: string, currentColProp: string) => boolean

/**
 * <zh/> 列合并（colspan）配置
 * <en/> Column span (colspan) config
 * <zh/>
 * - true: 按同行相邻列值相等自动合并
 * - (row, leftColProp, currentColProp) => boolean: 自定义比较函数
 * - false / undefined: 不合并（默认）
 * <zh/> 列级别配置优先于表格级别的 `spanConfig.cols`
 * <en/>
 * - true: auto-merge by equal adjacent column values in the same row
 * - (row, leftColProp, currentColProp) => boolean: custom compare function
 * - false / undefined: no merge (default)
 * Column-level config takes precedence over the table-level `spanConfig.cols`
 */
export type ColumnColSpanConfig = boolean | ColSpanCompareFn

/**
 * <zh/> 列 prop 作为 key，值为列合并规则（同 ColumnColSpanConfig）。
 * <en/> Column prop as key, value is the column span rule (same as ColumnColSpanConfig).
 * <zh/> 当列自身未定义 colSpan 时回退到此配置
 * <en/> Falls back to this config when the column itself doesn't define colSpan
 */
export type ColSpanCellsConfig = Record<string, ColumnColSpanConfig>

/**
 * <zh/> 传递给 `valueGetter` 的参数
 * <en/> Params passed to `valueGetter`
 */
export interface ValueGetterParams<T = any> {
  /** <zh/> 当前行数据 | <en/> Current row data */
  row: T
  /** <zh/> 当前列配置 | <en/> Current column config */
  column: AdvColumn<T>
  /** <zh/> 当前行索引 | <en/> Current row index */
  rowIndex: number
}

/**
 * <zh/> 传递给 `valueSetter` 的参数
 * <en/> Params passed to `valueSetter`
 */
export interface ValueSetterParams<T = any> {
  /** <zh/> 当前行数据 | <en/> Current row data */
  row: T
  /** <zh/> 当前列配置 | <en/> Current column config */
  column: AdvColumn<T>
  /** <zh/> 当前行索引 | <en/> Current row index */
  rowIndex: number
  /** <zh/> 经过 valueParser 转换后的新值 | <en/> New value after valueParser transformation */
  newValue: unknown
  /** <zh/> 编辑前的原始值 | <en/> Original value before editing */
  oldValue: unknown
}

/**
 * <zh/> 传递给 `valueParser` 的参数
 * <en/> Params passed to `valueParser`
 */
export interface ValueParserParams<T = any> {
  /** <zh/> 当前行数据 | <en/> Current row data */
  row: T
  /** <zh/> 当前列配置 | <en/> Current column config */
  column: AdvColumn<T>
  /** <zh/> 当前行索引 | <en/> Current row index */
  rowIndex: number
  /** <zh/> 编辑器中的原始编辑值 | <en/> Original editing value in the editor */
  newValue: unknown
  /** <zh/> 编辑前的原始值 | <en/> Original value before editing */
  oldValue: unknown
}

/**
 * <zh/> 对外列配置主类型——`Column` 收窄 cellRenderer/headerCellRenderer/hidden/width 后的公开形态
 * <en/> Public column config — `Column` narrowed on cellRenderer/headerCellRenderer/hidden/width
 */
export type AdvColumn<T = any> = Omit<
  Column<T>,
  'cellRenderer' | 'headerCellRenderer' | 'hidden' | 'width'
> & {
  /**
   * <zh/> ElTable 可选（自动计算），虚拟模式必填（// only for virtual mode: required） | <en/> Optional for ElTable (auto-computed), required for virtual mode (// only for virtual mode: required)
   * @onlyVirtual — default 模式（ElTable）下缺省时由 EP 自动计算，无需填写
   */
  width?: number
  /**
   * <zh/> 列宽是否可拖拽调整
   * <en/> Whether the column width is resizable by dragging
   * <zh/>
   * - undefined: 回退到表格级 resizable
   * - true: 始终可拖拽（覆盖表格级）
   * - false: 不可拖拽（覆盖表格级）
   * <en/>
   * - undefined: falls back to table-level resizable
   * - true: always resizable (overrides table-level)
   * - false: not resizable (overrides table-level)
   */
  resizable?: boolean
  /** <zh/> 列最小宽度（px，仅支持 number；字符串既不被 ElTableV2 接受，也会在键盘调宽等数值路径产出 NaN，故类型直接阻断） | <en/> Column minimum width (px, number only; strings are rejected at the type level — ElTableV2 never accepted them and they produced NaN on numeric paths like keyboard resizing) */
  minWidth?: number
  /**
   * <zh/> 仅 ElTableV2（// only for virtual mode）；ElTableColumn 回退到 CSS max-width | <en/> Only ElTableV2 (// only for virtual mode); ElTableColumn falls back to CSS max-width
   * @onlyVirtual — default 模式下会被忽略（改走 CSS max-width 回退）
   */
  maxWidth?: number
  /**
   * <zh/> ElTableV2 原生 prop（// only for virtual mode）
   * <en/> ElTableV2 native prop (// only for virtual mode)
   * <zh/> default 模式（ElTable）不支持此 prop，会被忽略
   * <en/> default mode (ElTable) doesn't support this prop and it will be ignored
   * <zh/> autoSizeColumns=true 时，stretch !== false 的列默认 flexGrow=1
   * <en/> When autoSizeColumns=true, columns with stretch !== false default to flexGrow=1
   * @onlyVirtual
   */
  flexGrow?: number
  /**
   * <zh/> ElTableV2 原生 prop（// only for virtual mode）。default 模式不支持 | <en/> ElTableV2 native prop (// only for virtual mode). Not supported in default mode
   * @onlyVirtual
   */
  flexShrink?: number
  /**
   * <zh/> 是否参与 autoSizeColumns 等比拉伸分配，默认 true。
   * <en/> Whether to participate in autoSizeColumns proportional stretching, defaults to true.
   * <zh/> 设为 false 时，该列保持固定宽度，不受 autoSizeColumns 影响。
   * <en/> When set to false, the column keeps a fixed width and is not affected by autoSizeColumns.
   * <zh/> - selection 列、hidden 列、fixed 列自动跳过，无需手动设置。
   * <en/> - selection, hidden, and fixed columns are skipped automatically; no manual setup needed.
   */
  stretch?: boolean
  /** <zh/> 默认 false | <en/> Defaults to false */
  hidden?: boolean
  /** <zh/> 列值类型，决定单元格的渲染、编辑与搜索控件 | <en/> Column value type; decides cell rendering, editing and search control */
  valueType?: ValueType
  /** <zh/> 值枚举映射 — 将数据值映射为显示文本和状态标签 | <en/> Value enum mapping — maps data values to display text and status labels */
  valueEnum?: ValueEnum
  /** <zh/> 是否可复制；copyHeaders 为 true 时复制内容前附加列标题 | <en/> Whether copyable; when copyHeaders is true, prepend the column header to copied content */
  copyable?: boolean | { copyHeaders?: boolean }
  /** <zh/> 是否溢出省略；对象形式可通过 tooltip 控制溢出时是否显示 tooltip | <en/> Whether to ellipsize overflow; the object form controls overflow tooltip via tooltip */
  ellipsis?: boolean | { tooltip?: boolean }
  /** <zh/> 表头悬浮提示内容，设置后始终显示 | <en/> Header tooltip content; always shown once set */
  tooltip?: string
  /**
   * <zh/> 溢出 tooltip 内容格式化函数
   * <en/> Overflow tooltip content formatter function
   * <zh/> @param data - 格式化上下文对象
   * <en/> @param data - formatting context object
   * <zh/> @param data.row - 当前行数据
   * <en/> @param data.row - current row data
   * <zh/> @param data.column - 当前列配置
   * <en/> @param data.column - current column config
   * <zh/> @param data.cellValue - 单元格值
   * <en/> @param data.cellValue - cell value
   * <zh/> @returns 格式化后的 VNode 或字符串
   * <en/> @returns formatted VNode or string
   */
  tooltipFormatter?: (data: { row: T, column: AdvColumn<any>, cellValue: unknown }) => import('vue').VNode | string
  /** <zh/> 空值时单元格显示的文本，优先于表格级 columnEmptyText | <en/> Text shown when the cell value is empty; takes precedence over table-level columnEmptyText */
  emptyText?: string
  /**
   * <zh/> 格式化上下文 — 与 CellComponentProps 字段一致
   * <en/> Format context — fields consistent with CellComponentProps
   */
  format?: (ctx: FormatContext<T>) => string
  /**
   * <zh/> 自定义取值函数
   * <en/> Custom value getter
   * <zh/> 默认：row[prop]
   * <en/> Default: row[prop]
   * <zh/> 设置后，筛选/排序/全局搜索/导出均使用此返回值
   * <en/> Once set, filtering/sorting/global search/export all use this return value
   */
  valueGetter?: (params: ValueGetterParams<T>) => unknown
  /**
   * <zh/> 自定义设值函数
   * <en/> Custom value setter
   * <zh/> 默认：row[prop] = value
   * <en/> Default: row[prop] = value
   * <zh/> 设置后编辑提交时调用此函数而非直接赋值
   * <en/> Once set, called on edit submit instead of direct assignment
   * <zh/> 返回 true 表示设值成功
   * <en/> Return true to indicate the value was set successfully
   */
  valueSetter?: (params: ValueSetterParams<T>) => boolean
  /**
   * <zh/> 值解析函数 — 在 valueSetter 之前对编辑值进行转换/清洗
   * <en/> Value parser — transforms/cleans the edit value before valueSetter
   * <zh/> 编辑提交时：editingValue → valueParser → valueSetter → row
   * <en/> On edit submit: editingValue → valueParser → valueSetter → row
   */
  valueParser?: (params: ValueParserParams<T>) => unknown
  /** <zh/> 自定义单元格渲染器（TSX），在 Element Plus 参数基础上扩展 AdvColumn | <en/> Custom cell renderer (TSX), extends AdvColumn on top of Element Plus params */
  cellRenderer?: (ctx: CellContext<T>) => VNode | string
  /**
   * <zh/> 自定义单元格组件（模板友好）— 自动接收 CellComponentProps 作为 props
   * <en/> Custom cell component (template-friendly) — automatically receives CellComponentProps as props
   * <zh/> 与需要 TSX 的 cellRenderer 不同，支持模板写法
   * <en/> Unlike cellRenderer which requires TSX, supports template syntax
   */
  cellComponent?: Component
  /** <zh/> 自定义表头渲染器，在 Element Plus 参数基础上扩展 AdvColumn | <en/> Custom header renderer, extends AdvColumn on top of Element Plus params */
  headerCellRenderer?: (ctx: HeaderCellContext<T>) => VNode | string
  /** <zh/> 列标题文本 | <en/> Column header label */
  label?: string
  /** <zh/> 字段名，对应行数据中的 key | <en/> Field name, corresponding to the key in row data */
  prop?: Extract<keyof T, string>
  /** <zh/> 是否参与搜索表单；对象形式提供细粒度配置 | <en/> Whether this column joins the search form; the object form provides fine-grained config */
  search?: boolean | ColumnSearchConfig
  /** <zh/> 是否为选择列 | <en/> Whether this is the selection column */
  selection?: boolean
  /** <zh/> 判断行是否可选中（选择列） | <en/> Determines whether a row is selectable (selection column) */
  selectable?: (row: T, rowIndex: number) => boolean
  /** <zh/> 仅 valueType 为 'option' 时生效 | <en/> Only effective when valueType is 'option' */
  actions?: ActionConfig<T>[]
  /**
   * <zh/> 操作按钮悬停显示模式
   * <en/> Action button hover display mode
   * <zh/>
   * - undefined / false: 按钮正常显示在列中
   * - true: 悬停覆盖层（v-show，保留 DOM）
   * - { keepAlive: false }: 同 true 但使用 v-if
   * - { teleport: true }: 通过 Teleport 渲染为单个 fixed 定位实例
   * - { teleport: 'auto' }: 自动判断——有 fixed 列时使用 Teleport 渲染（避免被 fixed 列覆盖），
   *   无 fixed 列时行内渲染（更接近原生体验，事件开销更低）
   * - { teleport: false }: 强制行内渲染（绝对定位），每行独立渲染，等同于 'auto' 无 fixed 列的效果
   * <zh/> 仅 valueType 为 'option' 时生效
   * <en/>
   * - undefined / false: buttons display normally in the column
   * - true: hover overlay (v-show, keeps DOM)
   * - { keepAlive: false }: same as true but uses v-if
   * - { teleport: true }: render as a single fixed-positioned instance via Teleport
   * - { teleport: 'auto' }: auto-decide — use Teleport when there are fixed columns (avoid being covered), inline render otherwise (closer to native, lower event overhead)
   * - { teleport: false }: force inline render (absolute positioning), each row rendered independently, same as 'auto' without fixed columns
   * Only effective when valueType is 'option'
   */
  hoverActions?: boolean | { keepAlive?: boolean, teleport?: boolean | 'auto', zIndex?: number | string }
  /**
   * <zh/> 永久固定列配置
   * <en/> Permanent pinned column config
   * <zh/>
   * - undefined: 可在列设置中自由切换
   * - 'left': 只能固定在左侧
   * - 'right': 只能固定在右侧
   * <en/>
   * - undefined: freely toggled in column settings
   * - 'left': can only pin to the left
   * - 'right': can only pin to the right
   */
  pinFixed?: 'left' | 'right'
  /**
   * <zh/> 敏感列标记——设为 true 时该列在导出/复制操作中被自动排除
   * <zh/> 适用场景：密码、token、身份证号等不应通过导出文件泄露的列
   * <en/> Sensitive column flag — when true, the column is automatically excluded from export/copy operations
   * <en/> Use cases: passwords, tokens, ID numbers and other columns that should not leak via export files
   */
  sensitive?: boolean
  /**
   * <zh/> 列筛选配置，设置后列头出现筛选图标
   * <en/> Column filter config; once set, a filter icon appears in the column header
   * <zh/> 支持简写：filter: 'text'
   * <en/> Supports shorthand: filter: 'text'
   */
  filter?: ColumnFilterType | ColumnFilterConfig | boolean
  /**
   * <zh/> 列级浮动筛选覆盖
   * <en/> Column-level floating filter override
   * <zh/> 当表格级 floatingFilter 为 true 时，可在列上设为 false 以排除
   * <en/> When table-level floatingFilter is true, set this to false on the column to exclude it
   */
  floatingFilter?: boolean
  /** <zh/> 浮动筛选显示时隐藏 popup 筛选按钮 | <en/> Hide the popup filter button when the floating filter is shown */
  suppressFloatingFilterButton?: boolean
  /**
   * <zh/> 与 Element Plus sortable 一致，但在 AdvColumn 中显式声明 | <en/> Consistent with Element Plus sortable, but explicitly declared in AdvColumn
   * <zh/> 服务端数据源 + `autoParams` 关闭时，本地列排序只排当前页且不触发 refetch/回页；服务端排序请声明 `{ type: 'server' }` 或 `'custom'` | <en/> With a server-side source and `autoParams` off, local-column sorts order the current page only (no refetch/page reset); declare `{ type: 'server' }` or `'custom'` for server-side sorting
   */
  sortable?: ColumnSortable
  /**
   * <zh/> 排序取值简写——等价于 sortable: { sortBy } 中的 sortBy
   * <en/> Sort-by shorthand — equivalent to sortBy inside sortable config
   * <zh/> 优先级低于 sortable 配置对象中的 sortBy
   * <en/> Lower priority than sortBy inside the sortable config object
   */
  sortBy?: string | string[] | ((row: T) => unknown)
  /**
   * <zh/> 自定义排序比较函数简写——等价于 sortable: { sortMethod } 中的 sortMethod
   * <en/> Custom sort compare function shorthand — equivalent to sortMethod inside sortable config
   * <zh/> 优先级低于 sortable 配置对象中的 sortMethod
   * <en/> Lower priority than sortMethod inside the sortable config object
   */
  sortMethod?: (a: T, b: T) => number
  /**
   * <zh/> 行合并配置（相邻行的 rowspan）
   * <en/> Row span config (rowspan for adjacent rows)
   * <zh/>
   * - true: 按 prop 值相等自动合并
   * - (a, b) => boolean: 自定义比较函数
   * <zh/> 列级别配置优先于表格级别的 spanConfig.rows
   * <en/>
   * - true: auto-merge by equal prop values
   * - (a, b) => boolean: custom compare function
   * Column-level config takes precedence over the table-level spanConfig.rows
   */
  spanRows?: ColumnRowSpanConfig
  /**
   * <zh/> 列合并配置（同行相邻列的 colspan）
   * <en/> Column span config (colspan for adjacent columns in the same row)
   * <zh/>
   * - true: 按同行相邻列值相等自动合并
   * - (row, leftColProp, currentColProp) => boolean: 自定义比较函数
   * <zh/> 列级别配置优先于表格级别的 spanConfig.cols
   * <en/>
   * - true: auto-merge by equal adjacent column values in the same row
   * - (row, leftColProp, currentColProp) => boolean: custom compare function
   * Column-level config takes precedence over the table-level spanConfig.cols
   */
  colSpan?: ColumnColSpanConfig
  /**
   * <zh/> 子列配置，用于多级表头（分组列）
   * <en/> Child column config for multi-level headers (grouped columns)
   * <zh/> 设置后作为父表头单元格跨越子列，不渲染数据单元格
   * <en/> Once set, acts as a parent header cell spanning child columns, no data cells rendered
   */
  children?: AdvColumn<T>[]
  /** <zh/> 保留索引签名以支持 data-* 自定义属性 | <en/> Reserved index signature to support data-* custom attributes */
  [key: `data-${string}`]: unknown

  /**
   * <zh/> 动态单元格 class 规则
   * <en/> Dynamic cell class rules
   * <zh/> class 名称 → 断言函数映射，断言返回 true 时 class 被应用到该单元格
   * <en/> class name → predicate function map; the class is applied when the predicate returns true
   */
  cellClassRules?: Record<string, (params: CellClassRuleParams<T>) => boolean>

  /**
   * <zh/> 引用 columnTypes 中预设的列类型键
   * <en/> Reference a preset column type key from columnTypes
   * <zh/> 合并顺序：defaultColDef → columnTypes[type] → 列自身定义
   * <en/> Merge order: defaultColDef → columnTypes[type] → column's own definition
   * <zh/> 支持数组按顺序组合预设
   * <en/> Supports combining presets in order via an array
   */
  type?: string | string[]

  /** <zh/> 分组列子项的显示控制（仅对 children 中的子列有效） | <en/> Display control for grouped column children (only effective for child columns in children) */
  columnGroupShow?: 'open' | 'closed' | null

  /** <zh/> 分组列是否可折叠（仅对包含 children 的列有效） | <en/> Whether the grouped column is collapsible (only effective for columns containing children) */
  collapsible?: boolean

  /** <zh/> 分组列默认收起（需要 collapsible 为 true） | <en/> Grouped column collapsed by default (requires collapsible to be true) */
  collapsed?: boolean

  /**
   * <zh/> 列是否可拖拽排序
   * <en/> Whether the column can be dragged to reorder
   * <zh/>
   * - undefined: 回退到表格级 columnDraggable
   * - true: 始终可拖拽（覆盖表格级）
   * - false: 不可拖拽（覆盖表格级）
   * <en/>
   * - undefined: falls back to table-level columnDraggable
   * - true: always draggable (overrides table-level)
   * - false: not draggable (overrides table-level)
   */
  columnDraggable?: boolean

  /**
   * <zh/> 列是否可编辑
   * <en/> Whether the column is editable
   * <zh/> 设为 true 时点击（或双击，取决于 editConfig）单元格展示编辑器
   * <en/> When true, clicking (or double-clicking, depending on editConfig) the cell shows the editor
   * <zh/> 需要同时设置 cellEditor
   * <en/> Requires cellEditor to be set as well
   */
  editable?: boolean
  /** <zh/> 内置类型：text | number | select | date | datetime | switch | checkbox | <en/> Built-in types: text | number | select | date | datetime | switch | checkbox */
  cellEditor?: CellEditorType | string | Component
  /**
   * <zh/> 传递给单元格编辑器的参数
   * <en/> Params passed to the cell editor
   * <zh/> 支持静态对象或动态函数（适用于联动下拉等场景）
   * <en/> Supports a static object or a dynamic function (suitable for linked dropdowns, etc.)
   */
  cellEditorParams?: CellEditorParams | ((params: { row: T, rowIndex: number, column: AdvColumn<any> }) => CellEditorParams)
  /** <zh/> 是否在弹窗中展示编辑器 | <en/> Whether to show the editor in a popup */
  cellEditorPopup?: boolean
  /** <zh/> 弹窗相对单元格的位置，默认 'over' | <en/> Popup position relative to the cell, defaults to 'over' */
  cellEditorPopupPosition?: 'over' | 'under'
  /** <zh/> 自定义弹窗渲染组件（cellEditorPopup 模式下替代默认编辑器，接收 modelValue/row/column/editorParams 等 props） | <en/> Custom popup renderer component (replaces the default editor in cellEditorPopup mode, receives props like modelValue/row/column/editorParams) */
  popupRenderer?: Component
  /** <zh/> 在 quickFilter 全局搜索中排除此列 | <en/> Exclude this column from quickFilter global search */
  quickFilterSuppress?: boolean
  /** <zh/> 单元格编辑校验规则 | <en/> Cell edit validation rules */
  editorRules?: ColumnEditorRules

  /**
   * <zh/> Sparkline 迷你趋势图配置——仅在 `valueType: 'sparkline'` 时生效
   * <en/> Sparkline mini trend chart config — only effective when `valueType: 'sparkline'`
   */
  sparkline?: import('../utils/sparkline').SparklineOptions

  /**
   * <zh/> Backspace 键清空单元格时使用的空值
   * <zh/> 默认 ''（空字符串）。数字列可设为 null 或 undefined 避免类型不匹配
   * <en/> Empty value used when Backspace clears a cell
   * <en/> Defaults to '' (empty string). Set to null or undefined for numeric columns to avoid type mismatch
   */
  emptyValue?: unknown

  /** <zh/> 列级单元格点击回调 — 在表格级 cellClick 之前调用 | <en/> Column-level cell click callback — called before the table-level cellClick */
  onCellClick?: (params: { row: T, rowIndex: number, column: AdvColumn, event: MouseEvent }) => void
  /** <zh/> 列级单元格双击回调 — 在表格级 cellDblclick 之前调用 | <en/> Column-level cell double-click callback — called before the table-level cellDblclick */
  onCellDoubleClick?: (params: { row: T, rowIndex: number, column: AdvColumn, event: MouseEvent }) => void
  /** <zh/> 列级单元格值变更回调 — 在表格级 cellValueChanged 之前调用 | <en/> Column-level cell value change callback — called before the table-level cellValueChanged */
  onCellValueChanged?: (params: { row: T, rowIndex: number, column: AdvColumn, oldValue: unknown, newValue: unknown }) => void

  /**
   * <zh/> 动态编辑器选择器 — 根据行数据返回不同编辑器
   * <en/> Dynamic editor selector — returns a different editor based on row data
   * <zh/> 优先级高于 cellEditor
   * <en/> Takes precedence over cellEditor
   */
  cellEditorSelector?: (params: { row: T, rowIndex: number, column: AdvColumn }) => CellEditorType | string | Component | CellEditorSelectorResult | undefined

  /** <zh/> 锁定列可见性 — 防止用户通过列设置 UI 隐藏此列 | <en/> Lock column visibility — prevent users from hiding this column via the column settings UI */
  lockVisible?: boolean

  /**
   * <zh/> 锁定列位置 — 防止用户通过拖拽移动此列
   * <en/> Lock column position — prevent users from moving this column by dragging
   * <zh/>
   * - true: 锁定位置
   * - 'left': 锁定到左侧
   * - 'right': 锁定到右侧
   * <en/>
   * - true: lock position
   * - 'left': lock to the left
   * - 'right': lock to the right
   */
  lockPosition?: boolean | 'left' | 'right'

  /**
   * <zh/> 锁定列宽 — 防止用户通过拖拽调整此列宽度
   * <zh/> 设置后 collectUserState 跳过此列的 width 保留，外部服务端列宽推送不会被本地拖宽覆盖
   * <en/> Lock column resize — prevent users from adjusting this column's width by dragging
   * <en/> When set, collectUserState skips preserving this column's width, so external server-side width pushes
   * <en/> are not overridden by local drag widths
   */
  lockResize?: boolean
  /**
   * <zh/> 列级右键菜单项覆盖
   * <en/> Column-level right-click menu item override
   * <zh/> 设置后此列右键弹出独立菜单，不使全局 menuConfig.body
   * <en/> Once set, right-clicking this column shows a standalone menu, not the global menuConfig.body
   */
  contextMenuItems?: MenuOptionInput<T>[][]

  /**
   * <zh/> 列聚合函数——对齐 AG Grid colDef.aggFunc
   * <zh/> 用于 Grand Total / 分组小计行的该列归约：
   * <zh/> - 'sum'：数值求和（默认，规范口径：仅 typeof number 且非 NaN 参与）
   * <zh/> - 'avg'：有效数值均值（分母为有效个数）
   * <zh/> - 'min'/'max'：有效数值最小/最大
   * <zh/> - 'count'：组内叶子行数
   * <zh/> - 'first'/'last'：首个/末个非 undefined 单元格值
   * <zh/> - 自定义函数：(values, rows) => 聚合结果，values 为该列原始单元格值数组
   * <zh/> 未设置时回退 'sum'（数值列）/ 空串（无有效数值）。
   * <en/> Column aggregate function — aligned with AG Grid colDef.aggFunc
   * <en/> Reduces this column for grand / group total rows:
   * <en/> - 'sum': numeric sum (default, canonical caliber: only typeof number non-NaN)
   * <en/> - 'avg': mean over valid numbers
   * <en/> - 'min'/'max': smallest/largest valid number
   * <en/> - 'count': leaf row count in scope
   * <en/> - 'first'/'last': first/last non-undefined cell value
   * <en/> - custom fn: (values, rows) => aggregate result
   * <en/> Falls back to 'sum' (numeric) / '' (no valid numbers) when unset.
   */
  aggFunc?: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'first' | 'last' | ((values: unknown[], rows: T[]) => unknown)
  /**
   * <zh/> 列唯一标识键（ElTableV2 原生 key），用于虚拟模式下列的稳定标识
   * <zh/> 未设置时回退到 prop
   * <en/> Column unique key (ElTableV2 native key), used for stable column identification in virtual mode
   * <en/> Falls back to prop when not set
   * @onlyVirtual — default 模式下作为普通透传 key 使用，无虚拟稳定标识语义
   */
  key?: string
}

/**
 * <zh/> 强约束列——`field` 收紧为 `keyof T`，供需要拼写检查的业务选用；默认 `AdvColumn` 保持宽松以兼容动态/服务端列
 * <en/> Strict column — `field` narrowed to `keyof T` for typo-checked usage; default `AdvColumn` stays loose for dynamic/server columns
 */
export type AdvStrictColumn<T> = AdvColumn<T> & {
  /** <zh/> 字段名限定为行类型的合法 key | <en/> Field name restricted to valid keys of the row type */
  field?: keyof T & string
}

/**
 * <zh/> 处理后的列类型：
 * <en/> Processed column type:
 * <zh/> hidden 字段变为必填（始终 boolean），children 递归类型化为 ProcessedColumn[]
 * <en/> hidden becomes required (always boolean), children recursively typed as ProcessedColumn[]
 * <zh/> 泛型 T 表示行数据类型，会从 AdvColumn<T> 继承，确保 cellRenderer / format / valueGetter 等回调保持类型安全
 * <en/> Generic T denotes the row data type, inherited from AdvColumn<T> to keep cellRenderer / format / valueGetter callbacks type-safe
 */
export type ProcessedColumn<T = any> = Omit<AdvColumn<T>, 'children'> & {
  /** <zh/> 是否隐藏（处理后必填，默认已合并） | <en/> Whether hidden (required after processing, defaults merged) */
  hidden: boolean
  /** <zh/> 子列（多级表头），递归处理为 ProcessedColumn[] | <en/> Child columns (multi-level header), recursively processed as ProcessedColumn[] */
  children?: ProcessedColumn<T>[]
  /** <zh/> 标记由 columnGroup 动态创建的分组列（children 为空时也视为分组） | <en/> Marks a grouped column dynamically created by columnGroup (treated as a group even when children is empty) */
  __isGroup?: boolean
}
