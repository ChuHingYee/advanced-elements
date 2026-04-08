import type { AdvColumn } from './column'

/**
 * <zh/> 动态列单元格插槽的 props（插槽名 = 列 prop）
 * <en/> Props for dynamic column cell slot (slot name = column prop)
 *
 * @example
 * ```vue
 * <AdvTable :columns="cols" :data="rows">
 *   <template #name="{ row, cellData, column, index }">
 *     {{ cellData }}
 *   </template>
 * </AdvTable>
 * ```
 */
export interface AdvTableColumnSlotProps<T = Record<string, unknown>> {
  /** <zh/> 当前行数据 | <en/> Current row data */
  row: T
  /** <zh/> 从 row[column.prop] 解析的单元格数据 | <en/> Cell data parsed from row[column.prop] */
  cellData: unknown
  /** <zh/> 当前列配置 | <en/> Current column config */
  column: AdvColumn<T>
  /** <zh/> 行索引 | <en/> Row index */
  index: number
}

/**
 * <zh/> 动态列表头插槽的 props（插槽名 = `${prop}-header`）
 * <en/> Props for dynamic header slot (slot name = `${prop}-header`)
 */
export interface AdvTableHeaderSlotProps {
  // 标记接口，空插槽无需额外 props
  // Marker interface, empty slot needs no extra props
}

/**
 * <zh/> `#error` 插槽 props——渲染错误兜底态的作用域。
 *
 * @remarks
 * <zh/> `reset` 是公开的恢复入口（等价于实例 API 的错误边界 reset）：调用后重置兜底态并重新挂载渲染器。
 * <zh/> 该类型与 `defineSlots` 共用同一来源，避免"运行时传了、类型里没有"。
 *
 * <en/> `#error` slot props — the scope of the render-error fallback.
 *
 * @remarks
 * `reset` is the public recovery entry (equivalent to the error-boundary reset in the instance API):
 * calling it clears the fallback state and re-mounts the renderer. `defineSlots` references this
 * same type, so the runtime value and the declared type cannot drift.
 *
 * @example
 * ```vue
 * <AdvTable :columns="cols" :data="rows">
 *   <template #error="{ error, reset }">
 *     <span>{{ error?.code }}</span>
 *     <button @click="reset">retry</button>
 *   </template>
 * </AdvTable>
 * ```
 */
export interface AdvTableErrorSlotProps {
  /** <zh/> 渲染错误信息（无错误时为 null） | <en/> Render error info (null when there is no error) */
  error: import('./error').TableError | null
  /** <zh/> 重置错误边界并恢复渲染 | <en/> Reset the error boundary and resume rendering */
  reset: () => void
}

/**
 * <zh/> 内置插槽名——动态列插槽必须把它们排除掉。
 * <zh/> 否则当行类型含同名字段（如 `Row { footer: string }`）时，同一个键上两个函数类型求交，
 * <zh/> 参数退化为 `A & B`，IDE 会提示"既要 currentPage 又要 cellData"的怪签名。
 * <en/> Built-in slot names — the dynamic column slots must exclude them. Otherwise, when the row type
 * <en/> carries a field of the same name (e.g. `Row { footer: string }`), two function types intersect on the
 * <en/> same key and the parameter degrades to `A & B`, so the IDE shows an odd signature requiring both
 * <en/> `currentPage` and `cellData`.
 */
export type AdvTableBuiltinSlotName
  = | 'default'
    | 'header-left'
    | 'header-right'
    | 'footer'
    | 'footer-extra'
    | 'empty'
    | 'append'
    | 'expandRow'
    | 'expand-row'
    | 'groupHeader'
    | 'group-header'
    | 'error'
// <zh/> 命名规范：kebab-case 为规范名（`expand-row` / `group-header`），camelCase（`expandRow` /
// <zh/> `groupHeader`）为历史兼容别名，运行时等价，两者均可使用。
// <en/> Naming convention: kebab-case is canonical (`expand-row` / `group-header`); camelCase
// <en/> (`expandRow` / `groupHeader`) remains as a historical compat alias, equivalent at runtime;
// <en/> both spellings are accepted.

/**
 * <zh/> 动态列插槽名——行类型的字符串键去掉内置插槽名。
 *
 * <zh/> 已知边界：当 T 带索引签名（含默认的 `Record<string, unknown>`）时 `Exclude<string, …>` 仍是
 * <zh/> `string`，插槽名拼写无法被类型检查捕获。这是"插槽名 = 列 prop"这一设计本身的代价，
 * <zh/> 类型层无法消除（要消除只能放弃动态插槽名，改显式声明）。
 *
 * <en/> Dynamic column slot names — the row type's string keys minus the built-in slot names.
 *
 * <en/> Known limit: when T has an index signature (including the default `Record<string, unknown>`),
 * <en/> `Exclude<string, …>` remains `string`, so slot-name typos cannot be caught by the type checker. That
 * <en/> is the inherent cost of "slot name = column prop" and cannot be removed at the type level (removing it
 * <en/> would mean dropping dynamic slot names for explicit declarations).
 */
export type AdvTableColumnSlotName<T> = Exclude<keyof T & string, AdvTableBuiltinSlotName>
