import { buildKeyToIndexMap } from './shared'

/**
 * <zh/> Shift 范围选择计算参数
 * <en/> Shift range selection calculation parameters
 */
export interface ShiftSelectParams<T> {
  /** <zh/> 当前已选中的 key 集合 | <en/> Currently selected key set */
  selectedKeys: Set<string>
  /** <zh/> 锚点行 key（上次点击的行） | <en/> Anchor row key (last clicked row) */
  anchorKey: string | null
  /** <zh/> 当前点击的行 key | <en/> Currently clicked row key */
  clickedKey: string
  /** <zh/> 当前点击的行数据 | <en/> Currently clicked row data */
  clickedRow: T
  /** <zh/> 是否意图选中（true 选中，false 取消选中） | <en/> Whether to select (true select, false deselect) */
  shouldSelect: boolean
  /**
   * <zh/> 范围计算的数据集——调用方必须传入**作用域有序数据**（Shift 范围按起止索引切片此数组），
   * <zh/> 传全量未过滤数据会导致不可见行被误选。
   * <en/> Dataset for range computation — callers must pass the **scope-ordered** data (Shift ranges slice this array by start/end indexes);
   * <en/> passing unfiltered full data picks up invisible rows by mistake.
   */
  allData: T[]
  /** <zh/> 行 key 函数 | <en/> Row key function */
  rowKey: (row: T) => string
  /** <zh/> 可选行判断函数 | <en/> Selectable predicate */
  selectableFn?: ((row: T, index: number) => boolean) | undefined
  /** <zh/> 外部注入的 key→index 映射（O(1) 查找），未注入时回退到 buildKeyToIndexMap | <en/> External key→index map (O(1) lookup), falls back to buildKeyToIndexMap when not provided */
  keyToIndexMap?: Map<string, number> | undefined
}

/**
 * <zh/> Shift 范围选择计算结果
 * <en/> Shift range selection calculation result
 */
export interface ShiftSelectResult {
  /** <zh/> 新的选中 key 集合（null 表示无法执行范围选） | <en/> New selected key set (null means range selection cannot proceed) */
  newKeys: Set<string> | null
  /**
   * <zh/> 是否为回退场景——锚点为 null 或锚点在当前数据中已失效（如排序/翻页后），退化为普通单行切换
   * <en/> Whether it's a fallback scenario — anchor is null or anchor is invalid in current data (e.g., after sort/pagination), degrades to simple single-row toggle
   */
  isFallback: boolean
  /**
   * <zh/> 是否因锚点失效而回退——调用方应将当前点击行设为新锚点
   * <en/> Whether fallback is due to invalid anchor — caller should set the clicked row as the new anchor
   */
  isAnchorInvalid?: boolean
}

/**
 * <zh/> 计算 Shift 点击的范围选择结果——纯函数，不修改任何状态
 *
 * <zh/> 从 use-selection-state.ts 的 handleShiftSelect 抽取，职责单一化：
 * <zh/> - 计算锚点行到点击行之间的范围
 * <zh/> - 根据可选性过滤行
 * <zh/> - 返回新的选中 key 集合
 * <zh/> 调用方负责将结果写入响应式状态并发射事件
 *
 * <en/> Calculate shift-click range selection result — pure function, does not modify any state
 *
 * <en/> Extracted from use-selection-state.ts's handleShiftSelect, single responsibility:
 * <en/> - Calculate the range between anchor row and clicked row
 * <en/> - Filter rows by selectability
 * <en/> - Return the new selected key set
 * <en/> Caller is responsible for writing the result to reactive state and emitting events
 *
 * @param params - <zh/> 范围选择参数 | <en/> range selection parameters
 * @returns <zh/> 范围选择结果 | <en/> range selection result
 */
export function calculateShiftSelect<T>(params: ShiftSelectParams<T>): ShiftSelectResult {
  const { selectedKeys, anchorKey, clickedKey, allData, rowKey, selectableFn, keyToIndexMap } = params

  if (allData.length === 0)
    return { newKeys: null, isFallback: false }

  const keyToIndex = keyToIndexMap ?? buildKeyToIndexMap(allData, rowKey)

  // 无锚点时退化为普通单行切换
  // Degrades to normal single-row toggle when no anchor exists
  if (anchorKey === null)
    return { newKeys: null, isFallback: true }

  const anchorIdx = keyToIndex.get(anchorKey) ?? -1
  const clickedIdx = keyToIndex.get(clickedKey) ?? -1
  /**
   * <zh/> 锚点在当前数据中已失效（如排序/翻页后锚点行不在当前视图）时，退化为单行切换，
   * <zh/> 并提示调用方将当前点击行设为新锚点，避免后续 Shift 点击持续失效
   * <en/> When the anchor is invalid in current data (e.g., anchor row not in current view after sort/pagination),
   * <en/> degrade to single-row toggle and signal the caller to set the clicked row as the new anchor,
   * <en/> preventing subsequent Shift clicks from continuously failing
   */
  if (anchorIdx === -1)
    return { newKeys: null, isFallback: true, isAnchorInvalid: true }
  if (clickedIdx === -1)
    return { newKeys: null, isFallback: false }

  const startIndex = Math.min(anchorIdx, clickedIdx)
  const endIndex = Math.max(anchorIdx, clickedIdx)

  const range = allData.slice(startIndex, endIndex + 1)
  const newSet = new Set(selectedKeys)

  for (let i = 0; i < range.length; i++) {
    const row = range[i]
    const rKey = rowKey(row)
    if (selectableFn) {
      const rowIndex = startIndex + i
      if (!selectableFn(row, rowIndex))
        continue
    }
    if (params.shouldSelect) {
      newSet.add(rKey)
    }
    else {
      newSet.delete(rKey)
    }
  }

  return { newKeys: newSet, isFallback: false }
}
