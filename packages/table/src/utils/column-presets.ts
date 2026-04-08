/**
 * <zh/> 列预设工具函数：提供常用的内置列类型预设配置，可直接用于 AdvColumn 的实例化或合并。
 * <en/> Column preset helpers: common built-in column-type presets usable directly for AdvColumn instantiation or merging.
 */
import type { AdvColumn } from '../types'

/**
 * <zh/> 内置列类型预设映射表。
 * <en/> Built-in column-type preset map.
 *
 * <zh/> 每个预设定义了一组默认的列属性（对齐方式、编辑器、筛选、排序等），使用时可通过 Object.assign 或展开运算符合并到用户自定义列配置中。
 * <en/> Each preset defines a set of default column props (alignment, editor, filter, sort, etc.), mergeable into user column configs via Object.assign or spread.
 *
 * @example
 * const column: AdvColumn = {
 *   prop: 'amount',
 *   label: '金额',
 *   ...BUILTIN_COLUMN_TYPES.numericColumn,
 * }
 */
export const BUILTIN_COLUMN_TYPES: Record<string, Partial<AdvColumn<any>>> = Object.freeze({
  /** <zh/> 数字列：右对齐 + number 编辑器 + 数字筛选 + 排序 | <en/> Numeric column: right-aligned + number editor + numeric filter + sortable */
  numericColumn: {
    align: 'right',
    cellEditor: 'number',
    valueType: 'digit',
    filter: { type: 'number' },
    sortable: true,
  },

  /** <zh/> 文本列：text 编辑器 + 文本筛选 + 排序 | <en/> Text column: text editor + text filter + sortable */
  textColumn: {
    cellEditor: 'text',
    filter: { type: 'text' },
    sortable: true,
  },

  /** <zh/> 日期列：date 编辑器 + 日期筛选 + 排序 + 居中 | <en/> Date column: date editor + date filter + sortable + centered */
  dateColumn: {
    cellEditor: 'date',
    valueType: 'date',
    filter: { type: 'date' },
    sortable: true,
    align: 'center',
  },

  /** <zh/> 日期时间列 | <en/> Date-time column */
  dateTimeColumn: {
    cellEditor: 'datetime',
    valueType: 'dateTime',
    filter: { type: 'date' },
    sortable: true,
    align: 'center',
  },

  /** <zh/> 选择列：select 编辑器 + enum 筛选 + 居中 | <en/> Select column: select editor + enum filter + centered */
  selectColumn: {
    cellEditor: 'select',
    filter: { type: 'enum' },
    align: 'center',
  },

  /** <zh/> 只读列：不可编辑 | <en/> Read-only column: not editable */
  nonEditableColumn: {
    editable: false,
  },

  /** <zh/> 操作列：居中 + 固定右侧 + 固定宽度 + option 渲染 | <en/> Action column: centered + pinned right + fixed width + option render */
  actionColumn: {
    valueType: 'option',
    align: 'center',
    fixed: 'right',
    width: 150,
    editable: false,
    sortable: false,
    filter: undefined,
  },
})
