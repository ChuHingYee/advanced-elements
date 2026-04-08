/** <zh/> 追加行标识字段名 | <en/> Append row flag field name */
export const APPEND_ROW_FLAG = '__advTableAppendRow__'

/** <zh/> 创建追加行占位数据对象 | <en/> Create append row placeholder data object */
export function createAppendRowData(): Record<string, unknown> {
  return { [APPEND_ROW_FLAG]: true }
}

/** <zh/> 判断行数据是否为追加行占位对象 | <en/> Check if row data is an append row placeholder object */
export function isAppendRowData(row: unknown): boolean {
  return Boolean(row) && typeof row === 'object' && (row as Record<string, unknown>)[APPEND_ROW_FLAG] === true
}
