import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { IRendererDomAdapter } from '../components/renderer-core/dom-adapter'
import type { TableRendererExpose } from '../utils/table-drag'
import type { ProcessedColumn } from './column'
import type { RendererCaps } from './renderer-caps'
import type { RowKeyMeta } from './row-rect'

/**
 * <zh/> 行上下文 — 行键函数、行数据、行键元信息
 *
 * <zh/> 行身份与访问的统一载体。这三个字段在拖拽、选择、交互子编排器中总是一起出现，
 * <zh/> 抽取为窄接口避免重复声明，并使行依赖意图显式化。
 *
 * <en/> Unified carrier for row identity and access. These three fields always appear together
 * <en/> in drag, selection, and interaction sub-orchestrators; extracted as a narrow interface
 * <en/> to avoid redundant declarations and make row dependencies explicit.
 *
 * @typeParam T - <zh/> 表格行数据类型 | <en/> table row data type
 */
export interface RowContext<T> {
  /** <zh/> 行键函数 | <en/> Row key function */
  rowKeyFn: ComputedRef<(row: T) => string>
  /** <zh/> 表格行数据 | <en/> Table row data */
  tableData: Ref<T[]>
  /** <zh/> 行键元信息（索引映射等） | <en/> Row key metadata (index mapping, etc.) */
  rowKeyMeta: Ref<RowKeyMeta<T>>
}

/**
 * <zh/> 列上下文 — 本地列集合与列更新器
 *
 * <zh/> 可变列数据访问的统一载体。这两个字段在拖拽、交互子编排器中总是一起出现，
 * <zh/> 抽取为窄接口避免重复声明。
 *
 * <en/> Unified carrier for mutable column data access. These two fields always appear together
 * <en/> in drag and interaction sub-orchestrators; extracted as a narrow interface
 * <en/> to avoid redundant declarations.
 */
export interface ColumnContext {
  /** <zh/> 本地处理后的列集合 | <en/> Locally processed column collection */
  localColumns: Ref<ProcessedColumn[]>
  /** <zh/> 列更新器 | <en/> Column updater */
  setColumns: (cols: ProcessedColumn[]) => void
}

/**
 * <zh/> 渲染器上下文 — 表格标识、渲染模式、活动渲染器引用
 *
 * <zh/> 渲染器环境与实例引用的统一载体。这三个字段在拖拽、选择、交互子编排器中总是一起出现，
 * <zh/> 抽取为窄接口避免重复声明，并使渲染器依赖意图显式化。
 *
 * <en/> Unified carrier for renderer environment and instance references. These three fields always
 * <en/> appear together in drag, selection, and interaction sub-orchestrators; extracted as a narrow
 * <en/> interface to avoid redundant declarations and make renderer dependencies explicit.
 *
 * @typeParam T - <zh/> 表格行数据类型 | <en/> table row data type
 */
export interface RendererContext {
  /** <zh/> 表格实例标识 | <en/> Table instance identifier */
  tableId: ComputedRef<string>
  /**
   * <zh/> 渲染器能力表——新代码一律查能力，不再询问渲染模式布尔量。
   * <en/> Renderer capability table — new code always queries capabilities, never the mode boolean.
   */
  caps: MaybeRefOrGetter<RendererCaps>
  /**
   * <zh/> 渲染器 DOM 适配器——EP 内部 DOM 结构的唯一出口，hook 不得持有 EP 类名字符串。
   * <en/> Renderer DOM adapter — the only outlet for EP internal DOM structure; hooks must never hold
   * <en/> an EP class-name string.
   */
  dom: MaybeRefOrGetter<IRendererDomAdapter>
  /** <zh/> 活动渲染器实例引用 | <en/> Active renderer instance reference */
  activeRenderer: ComputedRef<TableRendererExpose | null>
}

/**
 * <zh/> 跨切面上下文 — 表格标识、国际化、错误处理、生命周期标志
 *
 * <zh/> 这四个字段不属于任何单一域，却在多个编排器中被反复传递。
 * <zh/> 抽取为窄接口，使调用方只需传递一个 crossCutting 对象而非 4 个独立参数。
 *
 * <en/> Cross-cutting context — table ID, i18n, error handling, lifecycle flag
 *
 * <en/> These four fields don't belong to any single domain, yet are repeatedly passed to multiple orchestrators.
 * <en/> Extracted as a narrow interface so callers pass a single crossCutting object instead of 4 separate parameters.
 *
 * @typeParam T - <zh/> 表格行数据类型 | <en/> table row data type
 */
export interface CrossCuttingContext {
  /** <zh/> 表格实例标识 | <en/> Table instance identifier */
  tableId: ComputedRef<string>
  /**
   * <zh/> 国际化翻译函数——刻意保留 `any[]`（而非 `unknown[]`）：实现侧为 `(path, params?) => string` 窄签名，
   * <zh/> 在 strictFunctionTypes 下与 `...args: unknown[]` 不兼容，收紧即破坏赋值链，故此处为边界豁免。
   * <en/> i18n translation function — deliberately keeps `any[]` (not `unknown[]`): implementors use the narrow
   * <en/> `(path, params?) => string` signature, incompatible with `...args: unknown[]` under strictFunctionTypes.
   */
  t: (key: string, ...args: any[]) => string
  /**
   * <zh/> 结构化错误处理器——同上保留 `any[]`：实现侧为 `TableErrorHandler`（首参为错误码联合类型），
   * <zh/> 与 `...args: unknown[]` 不兼容，属第三方边界豁免。
   * <en/> Structured error handler — same `any[]` exemption: implementors use `TableErrorHandler`
   * <en/> (first param is an error-code union), incompatible with `...args: unknown[]`.
   */
  handleError: (...args: any[]) => void
  /** <zh/> 组件卸载标志 | <en/> Component unmounted flag */
  isUnmounted: { value: boolean }
}
