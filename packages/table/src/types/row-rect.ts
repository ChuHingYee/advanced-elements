/**
 * <zh/> teleport 模式的位置信息
 * <en/> Position info for teleport mode
 */
export interface RowRect {
  /** <zh/> 顶部位置（视口坐标） | <en/> Top position (viewport coordinates) */
  top: number
  height: number
  /** <zh/> 表格容器右边缘在视口中的位置 | <en/> Position of table container's right edge in viewport */
  containerRight: number
  /** <zh/> 表格容器左边缘在视口中的位置，用于计算 action bar 的最大宽度防止溢出 | <en/> Position of table container's left edge in viewport, used to calculate action bar max width to prevent overflow */
  containerLeft: number
}

/**
 * <zh/> 行键元数据，用于 O(1) 查找
 * <en/> Row key metadata, for O(1) lookup
 */
export interface RowKeyMeta<T = any> {
  keyToRow: Map<string, T>
  keyToIndex: Map<string, number>
  keyFn: (row: T) => string
  /** <zh/> 源数据数组引用，用于稳定性检查 | <en/> Source data array reference, for stability checks */
  dataRef: readonly T[]
}

/**
 * <zh/> 行键的**外部输入形态**——选择/树形/行固定的公开 API 一律接受 `string | number`。
 *
 * <zh/> 与 {@link RowKeyInput} 的区别：后者是 `rowConfig.rowKey` 的配置形态（还允许 Symbol 与取值函数），
 * <zh/> 本类型只描述「已取出的一把行键」，避免各 API 重复内联 `string | number` 导致口径漂移。
 *
 * <en/> The **external input form** of a row key — selection / tree / row-pinning public APIs all accept
 * <en/> `string | number`.
 *
 * <en/> Distinct from {@link RowKeyInput} (the `rowConfig.rowKey` config form, which also allows a Symbol
 * <en/> or a getter function): this type only describes "an already-resolved row key", so public APIs no
 * <en/> longer repeat an inline `string | number` that can drift out of sync.
 */
export type TableRowKey = string | number

/**
 * <zh/> **归一化后**的行键——内部存储与查询的统一口径。
 *
 * <zh/> 框架内 `rowKeyFn` 恒返回字符串（{@link RowKeyFn}），选择集合、行固定集合、
 * <zh/> 快速筛选行缓存等都以它为主键；读取类 API（如 `getSelectedKeys`）返回本类型，
 * <zh/> 与其内部实现保持一致，不做无意义的再宽化。
 *
 * <en/> The **normalized** row key — the canonical caliber for internal storage and lookups.
 *
 * <en/> Inside the library `rowKeyFn` always returns a string ({@link RowKeyFn}); the selection set, the
 * <en/> pinned-row set and the quick-filter row cache are all keyed by it. Read-side APIs such as
 * <en/> `getSelectedKeys` return this type, staying truthful to the implementation instead of widening it
 * <en/> back to `string | number`.
 */
export type NormalizedRowKey = string
