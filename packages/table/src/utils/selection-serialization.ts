/**
 * <zh/> 选中状态序列化工具——从 use-selection-state.ts 抽取的纯查询函数
 *
 * <zh/> 职责单一化：
 * <zh/> - 将 selectedKeys Set 转换为数组、计数、索引列表
 * <zh/> - 遍历选中行
 * <zh/> - 按行 key 检查选中状态
 *
 * <en/> Selection state serialization utilities — pure query functions extracted from use-selection-state.ts
 *
 * <en/> Single responsibility:
 * <en/> - Convert selectedKeys Set to array, count, index list
 * <en/> - Iterate over selected rows
 * <en/> - Check selection status by row key
 */

/**
 * <zh/> 获取选中 key 数组
 * <en/> Get selected keys as an array
 * @param selectedKeys - <zh/> 选中 key 集合 | <en/> selected key set
 * @returns <zh/> 选中 key 数组 | <en/> selected key array
 */
export function getSelectedKeysArray(selectedKeys: Set<string>): string[] {
  return Array.from(selectedKeys)
}

/**
 * <zh/> 获取选中行数量
 * <en/> Get selected row count
 * @param selectedKeys - <zh/> 选中 key 集合 | <en/> selected key set
 * @returns <zh/> 选中行数量 | <en/> selected row count
 */
export function getSelectedCountValue(selectedKeys: Set<string>): number {
  return selectedKeys.size
}

/**
 * <zh/> 获取选中行在 allData 中的索引列表
 * <en/> Get selected row indices in allData
 * @param selectedKeys - <zh/> 选中 key 集合 | <en/> selected key set
 * @param allData - <zh/> 全部数据 | <en/> all data
 * @param rowKey - <zh/> 行 key 函数 | <en/> row key function
 * @returns <zh/> 选中行索引数组 | <en/> selected row index array
 */
export function getSelectedRowIndices<T>(selectedKeys: Set<string>, allData: T[], rowKey: (row: T) => string): number[] {
  const indices: number[] = []
  allData.forEach((row, index) => {
    if (selectedKeys.has(rowKey(row)))
      indices.push(index)
  })
  return indices
}

/**
 * <zh/> 遍历选中行
 * <en/> Iterate over selected rows
 * @param selectedKeys - <zh/> 选中 key 集合 | <en/> selected key set
 * @param rowMap - <zh/> 行 key→行数据 映射 | <en/> row key→row data map
 * @param callback - <zh/> 回调函数 | <en/> callback function
 */
export function iterateSelectedRows<T>(
  selectedKeys: Set<string>,
  rowMap: Map<string, T>,
  callback: (row: T, key: string) => void,
): void {
  const keys = getSelectedKeysArray(selectedKeys)
  keys.forEach((key) => {
    const row = rowMap.get(key)
    if (row)
      callback(row, key)
  })
}

/**
 * <zh/> 检查行 key 是否已选中
 * <en/> Check if a row key is selected
 * @param selectedKeys - <zh/> 选中 key 集合 | <en/> selected key set
 * @param key - <zh/> 行 key（string | number） | <en/> row key (string | number)
 * @returns <zh/> true 表示已选中 | <en/> true if selected
 */
export function isKeySelected(selectedKeys: Set<string>, key: string | number): boolean {
  return selectedKeys.has(String(key))
}

/**
 * <zh/> 从 key 数组中过滤掉不可选行，返回仅包含可选行 key 的新 Set
 * <en/> Filter out non-selectable keys from a Set
 * @param keys - <zh/> 原始 key 集合 | <en/> original key set
 * @param rowMap - <zh/> 行 key→行数据 映射 | <en/> row key→row data map
 * @param selectableFn - <zh/> 可选行判断函数 | <en/> selectable predicate
 * @param keyToIndexMap - <zh/> key→index 映射（可选，用于 O(1) 查找） | <en/> key→index map (optional, for O(1) lookup)
 * @returns <zh/> 过滤后的 key 集合 | <en/> filtered key set
 */
export function filterUnselectableKeys<T>(
  keys: Set<string>,
  rowMap: Map<string, T>,
  selectableFn: ((row: T, index: number) => boolean) | undefined,
  keyToIndexMap?: Map<string, number>,
): Set<string> {
  if (!selectableFn)
    return keys
  const result = new Set<string>()
  for (const key of keys) {
    const row = rowMap.get(key)
    if (!row) {
      // 行不在当前数据中（可能尚未加载），保守保留以免丢失跨页选中 | Row not in current data (may not be loaded yet); keep conservatively to avoid losing cross-page selection
      result.add(key)
      continue
    }
    const index = keyToIndexMap ? (keyToIndexMap.get(key) ?? -1) : -1
    if (selectableFn(row, index))
      result.add(key)
  }
  return result
}
