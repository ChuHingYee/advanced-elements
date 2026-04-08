/**
 * Sort plan types
 * 排序编译产物类型,纯搬移自 use-column-sort.ts,零行为变更.
 *
 * @internal
 */
export interface SortEntry<T = any> {
  /** Accessor function, extracts sort key from row data. 取值函数,从行数据中提取排序键. */
  accessor: (row: T, rowIndex: number) => unknown
  /** Sort direction multiplier: 1 for ascending, -1 for descending. 排序方向乘数. */
  multiplier: number
  /** Custom sort method, overrides default comparison when present. 自定义排序方法. */
  sortMethod: ((a: T, b: T) => number) | undefined
  workerProp?: string
}

/**
 * Sort compile product, the full result of one buildSortEntries call, passed through to
 * shouldUseWorker / requestWorkerSort within the same tick to avoid reassembling entries.
 * 排序编译产物,一次 buildSortEntries 的完整结果,可在同 tick 内透传复用,避免重复装配条目数组.
 *
 * @internal
 */
export interface SortPlan<T = any> {
  sortEntries: SortEntry<T>[]
  isServerSort: boolean
  hasCustomSortMethod: boolean
}
