import { AUTO_KEY_NAME } from '../../utils/normalize-row-key'

/** <zh/> 追加行标识字段名 | <en/> Append row flag field name */
export const APPEND_ROW_FLAG = '__advTableAppendRow__'

/** <zh/> 创建追加行占位数据对象 | <en/> Create append row placeholder data object */
export function createAppendRowData(): Record<string, unknown> {
  // <zh/> 预置 AUTO_KEY_NAME：EP 的 :row-key 在用户配置显式字段（如 'id'）时读不到合成行，
  // 动态行高记账与列表 key 同时失效（详见 TableVirtualRenderer 的 epRowKeyStampedData）
  // <en/> Preassign AUTO_KEY_NAME: with a user-configured explicit :row-key field (e.g. 'id'),
  // EP cannot read synthetic rows, breaking dynamic-height bookkeeping and list keys alike
  // (see epRowKeyStampedData in TableVirtualRenderer)
  return { [APPEND_ROW_FLAG]: true, [AUTO_KEY_NAME]: '__append__' }
}

/** <zh/> 判断行数据是否为追加行占位对象 | <en/> Check if row data is an append row placeholder object */
export function isAppendRowData(row: unknown): boolean {
  return Boolean(row) && typeof row === 'object' && (row as Record<string, unknown>)[APPEND_ROW_FLAG] === true
}
