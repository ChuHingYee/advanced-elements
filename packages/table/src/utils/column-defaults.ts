import type { AdvColumn } from '../types'

/**
 * <zh/> 将 defaultColDef 和 columnTypes 应用到扁平或树状列数组，不修改原数组，返回新数组。
 * <en/> Apply defaultColDef and columnTypes to a flat or tree-shaped column array without mutating it, returning a new array.
 *
 * @param columns - <zh/> 原始列配置数组（支持嵌套 children 树状结构） | <en/> original column config array (supports nested children trees)
 * @param defaultColDef - <zh/> 全局默认列定义，合并到每一列 | <en/> global default column definition merged into every column
 * @param columnTypes - <zh/> 按 type 名称定义的列类型预设，与 defaultColDef 合并后作为列基值 | <en/> per-type column presets keyed by type name, merged with defaultColDef as the column base
 * @returns <zh/> 合并后的新列配置数组 | <en/> merged new column config array
 */
export function applyColumnDefaults<T>(
  columns: AdvColumn<T>[],
  defaultColDef?: Partial<AdvColumn<T>>,
  columnTypes?: Record<string, Partial<AdvColumn<T>>>,
): AdvColumn<T>[] {
  if (!defaultColDef && !columnTypes) {
    return columns
  }
  return columns.map(col => mergeColumn(col, defaultColDef, columnTypes))
}

/**
 * <zh/> 递归合并单列的默认配置、类型预设与列自身定义。
 * <en/> Recursively merge a column's default config, type presets and own definition.
 *
 * <zh/> 合并优先级（从低到高）：defaultColDef → columnTypes[type] → 列自身属性。
 * <zh/> 支持 type 为字符串或字符串数组，数组时按顺序叠加各类型预设。若列包含 children，递归合并子列。
 * <en/> Merge priority (low to high): defaultColDef → columnTypes[type] → the column's own props.
 * <en/> type may be a string or string array; arrays stack each preset in order. Columns with children are merged recursively.
 *
 * @param col - <zh/> 待合并的列定义 | <en/> column definition to merge
 * @param defaultColDef - <zh/> 全局默认列定义 | <en/> global default column definition
 * @param columnTypes - <zh/> 列类型预设映射表 | <en/> column type preset map
 * @returns <zh/> 合并后的列定义 | <en/> merged column definition
 */
function mergeColumn<T>(
  col: AdvColumn<T>,
  defaultColDef?: Partial<AdvColumn<T>>,
  columnTypes?: Record<string, Partial<AdvColumn<T>>>,
): AdvColumn<T> {
  let typeDef: Partial<AdvColumn<T>> = {}
  if (col.type && columnTypes) {
    if (typeof col.type === 'string') {
      typeDef = columnTypes[col.type] ?? {}
    }
    else if (Array.isArray(col.type)) {
      for (const typeName of col.type) {
        if (columnTypes[typeName]) {
          typeDef = { ...typeDef, ...columnTypes[typeName] }
        }
      }
    }
  }

  const merged: AdvColumn<T> = {
    ...(defaultColDef ?? {}),
    ...typeDef,
    ...col,
  } as AdvColumn<T>

  if (merged.children) {
    merged.children = merged.children.map(
      child => mergeColumn(child as AdvColumn<T>, defaultColDef, columnTypes) as AdvColumn<T>,
    ) as AdvColumn<T>[]
  }

  return merged
}
