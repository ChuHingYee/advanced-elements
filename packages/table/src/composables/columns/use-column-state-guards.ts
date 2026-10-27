import type { ColumnState } from '../../types/column-state'
import type { RendererModeName } from '../../types/renderer-caps'

/**
 * <zh/> 列状态持久化的字段级 schema 守卫——自 use-column-state.ts 拆出
 * <zh/> （COMPLEXITY-PLAN 战线三，刀法 A 纯函数下沉），主体逐字未改。
 * <en/> Field-level schema guards for column-state persistence — split out of
 * <en/> use-column-state.ts (COMPLEXITY-PLAN battle line 3, knife A), bodies unchanged.
 */

/** <zh/> 当前列状态序列化 schema 版本，结构变更时递增并在 restoreState 中做不匹配重置 | <en/> Current column state serialization schema version, incremented on structure change and used for mismatch reset in restoreState */
export const COLUMN_STATE_SCHEMA_VERSION = 1

/**
 * <zh/> 合法的 fixed 取值集合 | <en/> Valid fixed value set
 */
/**
 * <zh/> 合法的 fixed 取值集合——除 `'left' | 'right' | false` 外还必须接受 `true`：
 * <zh/> `true` 是列定义与 Element Plus 语义中"左侧固定"的等价写法，本库多处使用
 * <zh/> （列分类 / 汇总单元格 / 渲染器都按"左固定"处理）。旧集合漏收 `true`，
 * <zh/> 导致含此类列的表格在 `restoreState` 中被整体判为非法而丢弃存档。
 * <en/> Valid `fixed` value set — besides `'left' | 'right' | false` it must also accept `true`:
 * <en/> `true` is the equivalent spelling of "pinned left" in column definitions and Element Plus
 * <en/> semantics and is used across this library (column classification / summary cells / renderers
 * <en/> all treat it as left-pinned). The old set omitted `true`, so tables with such columns were
 * <en/> judged invalid wholesale by `restoreState` and had their stored state discarded.
 */
const VALID_FIXED_VALUES = new Set<string | boolean>(['left', 'right', false, true])

/**
 * <zh/> 合法的 sort 取值集合 | <en/> Valid sort value set
 */
const VALID_SORT_VALUES = new Set<string | null>(['ascending', 'descending', null])

/**
 * <zh/> 合法的 mode 取值集合 | <en/> Valid mode value set
 */
const VALID_MODE_VALUES = new Set<RendererModeName>(['default', 'virtual'])

/**
 * <zh/> 校验值是否为有限正数（用于 width） | <en/> Check if value is a finite positive number (for width)
 */
function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/**
 * <zh/> 校验值是否为有限非负整数（用于 sortIndex/schemaVersion） | <en/> Check if value is a finite non-negative integer (for sortIndex/schemaVersion)
 */
function isFiniteNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0
}

/**
 * 校验反序列化的数据是否为合法的 ColumnState[] 结构
 *
 * <zh/> 字段级 schema 校验：除基本数组+对象结构外，还校验每个字段类型，
 * <zh/> 避免异常数据（如 width 为字符串/负数、fixed 为任意字符串、sort 为非法值）
 * <zh/> 进入 applyColumnState 后导致渲染异常或 sortState 类型不匹配
 *
 * <en/> Field-level schema validation: in addition to basic array+object structure,
 * also validates each field's type to prevent abnormal data
 * (e.g. width as string/negative, fixed as arbitrary string, sort as invalid value)
 * from entering applyColumnState and causing rendering issues or sortState type mismatch
 */
export function isValidColumnStateData(data: unknown): data is ColumnState[] {
  if (!Array.isArray(data))
    return false
  return data.every((item): item is ColumnState => {
    if (item == null || typeof item !== 'object' || Array.isArray(item))
      return false
    const s = item as Record<string, unknown>
    // colId 必须是 string | colId must be string
    if (typeof s.colId !== 'string' || s.colId.length === 0)
      return false
    // width 若存在必须是有限正数 | width, if present, must be a finite positive number
    if (s.width !== undefined && !isFinitePositiveNumber(s.width))
      return false
    // hidden 若存在必须是 boolean | hidden, if present, must be boolean
    if (s.hidden !== undefined && typeof s.hidden !== 'boolean')
      return false
    // fixed 若存在必须是 'left' | 'right' | false | fixed, if present, must be 'left' | 'right' | false
    if (s.fixed !== undefined && !VALID_FIXED_VALUES.has(s.fixed as string | boolean))
      return false
    // sort 若存在必须是 'ascending' | 'descending' | null | sort, if present, must be 'ascending' | 'descending' | null
    if (s.sort !== undefined && !VALID_SORT_VALUES.has(s.sort as string | null))
      return false
    // sortIndex 若存在必须是有限非负整数 | sortIndex, if present, must be a finite non-negative integer
    if (s.sortIndex !== undefined && !isFiniteNonNegativeInt(s.sortIndex))
      return false
    // schemaVersion 若存在必须是整数 | schemaVersion, if present, must be an integer
    if (s.schemaVersion !== undefined && !Number.isInteger(s.schemaVersion))
      return false
    // mode 若存在必须是 'default' | 'virtual' | mode, if present, must be 'default' | 'virtual'
    // <zh/> 非受信持久化数据的成员检查：cast 仅为通过 Set 泛型约束，真值校验由 has() 在运行时完成
    // <en/> Membership check on untrusted persisted data: the cast only satisfies the Set generic; has() validates at runtime
    if (s.mode !== undefined && !VALID_MODE_VALUES.has(s.mode as RendererModeName))
      return false
    return true
  })
}
