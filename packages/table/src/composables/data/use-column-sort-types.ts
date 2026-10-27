import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { SortOrder, SortState } from '../../types/sort'

/**
 * <zh/> `useColumnSort` 契约——自 use-column-sort.ts 拆出（COMPLEXITY-PLAN 战线三，刀法 C）；
 * <zh/> use-column-sort.ts re-export 本文件，既有导入路径零变化。
 * <en/> Contracts of `useColumnSort` — split out of use-column-sort.ts (COMPLEXITY-PLAN battle
 * <en/> line 3, knife C); re-exported, keeping import paths unchanged.
 */
/**
 * useColumnSort 配置选项
 * Options for useColumnSort composable
 */
export interface UseColumnSortOptions<T = any> {
  /**
   * 列定义列表（支持响应式）
   * Column definition list (reactive)
   */
  columns: MaybeRefOrGetter<ProcessedColumn[]>
  /**
   * 待排序数据源（支持响应式）
   * Data source to be sorted (reactive)
   */
  data: MaybeRefOrGetter<T[]>
  /**
   * <zh/> 外部排序状态——提供时复用该 ref 而非内部创建。
   * <zh/> 预创建共享状态切口：调用方预创建后同时注入请求域与管线，排序状态标识全链路稳定。
   * <en/> External sort state — reused when provided instead of creating one internally.
   * <en/> Pre-created shared state seam: callers pre-create it and inject into both the request domain and the pipeline, keeping sort-state identity stable across the chain.
   */
  sortState?: Ref<SortState[]>
  /** <zh/> 数据行数阈值，超过时使用 Web Worker 后台排序 | <en/> Row count threshold for Web Worker background sorting */
  sortWorkerThreshold?: number
  /** <zh/> 总排序键数阈值，低于此值直接主线程排序 | <en/> Total sort key threshold, below which main-thread sorting is used */
  sortWorkerMinEntries?: number
  /** <zh/> Worker 排序超时时间（ms） | <en/> Worker sort timeout in milliseconds */
  sortWorkerTimeout?: number
  /** <zh/> Worker 创建失败或运行出错时的回调 | <en/> Callback for Worker creation failure or runtime error */
  onSortWorkerError?: (error: Error) => void
  /**
   * <zh/> 多列排序最大列数（支持响应式），默认不限；超出时 FIFO 淘汰最早列 | <en/> Max multi-sort columns (reactive), unlimited by default; oldest evicted FIFO when exceeded
   */
  maxSortColumns?: MaybeRefOrGetter<number | undefined>
}

/**
 * useColumnSort 返回值
 * Return value of useColumnSort composable
 */
export interface UseColumnSortReturn<T = any> {
  /**
   * 当前多列排序状态数组
   * Current multi-column sort state array
   */
  sortState: Ref<SortState[]>
  /**
   * <zh/> 切换指定列的排序状态 | <en/> Toggle sort state for the specified column
   * @param prop - <zh/> 列属性名 | <en/> column property name
   * @param event - <zh/> 键盘事件，用于检测 Shift 键 | <en/> keyboard event, used to detect Shift key
   * @param event.shiftKey - <zh/> 是否按住 Shift 键，true 时追加到多列排序 | <en/> whether Shift is held, true to append to multi-column sort
   */
  toggleSort: (prop: string, event?: { shiftKey?: boolean }) => void
  /**
   * <zh/> 直接设置指定列的排序方向 | <en/> Set sort direction for the specified column directly
   * @param prop - <zh/> 列属性名 | <en/> column property name
   * @param order - <zh/> 排序方向（null 表示清除该列排序） | <en/> sort direction (null to clear sort for this column)
   */
  setSort: (prop: string, order: SortOrder) => void
  /**
   * <zh/> 批量设置多列排序状态（覆盖现有排序） | <en/> Batch set multi-column sort state (overwrites existing)
   * @param sorts - <zh/> 排序状态数组 | <en/> sort state array
   */
  setSorts: (sorts: SortState[]) => void
  /**
   * 清除所有列的排序状态
   * Clear sort state of all columns
   */
  clearSort: () => void
  /**
   * <zh/> 获取指定列的当前排序方向 | <en/> Get the current sort direction for the specified column
   * @param columnKey - <zh/> 列标识键 | <en/> column key
   * @returns <zh/> 升序、降序或 null | <en/> ascending, descending, or null
   */
  getSortOrder: (columnKey: string) => SortOrder
  /**
   * <zh/> 获取指定列在多列排序中的索引位置（0-based） | <en/> Get the index position (0-based) of a column in multi-column sort
   * @param columnKey - <zh/> 列标识键 | <en/> column key
   * @returns <zh/> 索引位置，未参与排序时返回 -1 | <en/> index position, -1 if not participating in sort
   */
  getSortIndex: (columnKey: string) => number
  /**
   * 已排序的计算后数据
   * 包含排序后的数据行数组和是否已排序的标志
   * Sorted computed data
   * Contains the sorted data row array and a flag indicating whether sorting was applied
   */
  sortedData: ComputedRef<{ data: T[], isSorted: boolean }>
  /**
   * <zh/> 手动释放排序资源（Worker / 定时器 / 在飞状态），幂等可重复调用。
   * <zh/> 供动态创建场景兜底：当本 composable 在 watch 回调等无组件实例上下文中被创建时，
   * <zh/> 内部的 onBeforeUnmount/onDeactivated 注册会静默失效，调用方必须持有 dispose
   * <zh/> 并在自身作用域销毁时统一回收（参见 use-table-data-pipeline 的升级注册表）。
   * <en/> Manually release sort resources (Worker / timers / in-flight state); idempotent.
   * <en/> Fallback for dynamic creation: when this composable is created without a component
   * <en/> instance context (e.g. inside a watch callback), its internal onBeforeUnmount/
   * <en/> onDeactivated registrations silently no-op — the caller must hold `dispose` and flush
   * <en/> it when its own scope stops (see the upgrade registry in use-table-data-pipeline).
   */
  dispose?: () => void
}
