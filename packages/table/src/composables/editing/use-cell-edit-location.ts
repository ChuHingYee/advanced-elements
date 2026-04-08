import type { ComputedRef, Ref } from 'vue'
import { shallowEqual } from '../../utils/equality'
import { buildKeyToIndexMap } from '../../utils/shared'

/**
 * <zh/> 单元格编辑行定位依赖——均为调用方持有的响应式引用，子模块不自建状态
 * <en/> Cell-edit row-location dependencies — reactive refs owned by the caller, no state created here
 */
export interface CellEditLocationDeps<T = any> {
  /** <zh/> 行键函数（可空） | <en/> Row key function (nullable) */
  rowKey: ComputedRef<((row: T) => string) | null>
  /** <zh/> 正在编辑行的键 | <en/> Key of the row being edited */
  editingRowKey: Ref<string | null>
  /** <zh/> 正在编辑行的对象引用（索引移位检测） | <en/> Object reference of the row being edited (index-shift detection) */
  editingRowRef: Ref<T | null>
}

/**
 * <zh/> 编辑行重定位
 * <zh/> 数据变化（排序/筛选/分页）后将会话索引重定位到同一逻辑行，找不到返回 -1。
 * <en/> Edit-row relocation.
 * <en/> Re-locates the session index onto the same logical row after data changes
 * <en/> (sort/filter/pagination); -1 when the row is gone.
 */
export function useCellEditLocation<T = any>(deps: CellEditLocationDeps<T>) {
  const { rowKey, editingRowKey, editingRowRef } = deps

  function resolveStaleIndex(currentData: T[], currentIndex: number): number {
    const rk = rowKey.value
    if (editingRowKey.value === null || !rk) {
      if (currentIndex < 0 || currentIndex >= currentData.length)
        return -1
      const newRow = currentData[currentIndex] as unknown
      const oldRow = editingRowRef.value as unknown
      if (oldRow != null && newRow != null && typeof oldRow === 'object' && typeof newRow === 'object') {
        // <zh/> 浅拷同内容（新对象但浅相等）视为同一逻辑行，保留编辑避免闪退；重排/删除（内容不等）则取消
        // <en/> Shallow-equal new object with same content is treated as same logical row — keep editing to avoid flash-exit; reordered/deleted (not equal) cancels
        if (shallowEqual(oldRow as Record<string, unknown>, newRow as Record<string, unknown>))
          return currentIndex
        return -1
      }
      if (oldRow !== null && newRow !== oldRow)
        return -1
      return currentIndex
    }
    const row = currentData[currentIndex]
    if (!row) {
      const actualIndex = buildKeyToIndexMap(currentData, rk).get(editingRowKey.value) ?? -1
      return actualIndex
    }
    const currentKey = rk(row)
    if (currentKey === editingRowKey.value)
      return currentIndex
    return buildKeyToIndexMap(currentData, rk).get(editingRowKey.value) ?? -1
  }

  return { resolveStaleIndex }
}
