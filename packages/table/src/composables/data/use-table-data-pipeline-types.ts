import type { MaybeRefOrGetter, Ref } from 'vue'
import type { ColSpanCellsConfig, ProcessedColumn, RowSpanCellsConfig, SpanRange } from '../../types'
import type { ExternalFilterConfig, RowExpandConfig, RowGroupConfig, RowPinConfig, TreeConfig } from '../../types/config'
import type { DataPipelineStage, GroupTotalRowOption, SuppressStickyTotalRow, TotalValueGetter } from '../../types/config-options'
import type { SortState } from '../../types/sort'
import type { Translator } from '../../types/translator'
import type { DebugLogger } from '../../utils/debug-logger'
import type { SpanLimitInfo } from '../data/use-cell-span'
import type { RowExpandStorageError } from '../data/use-row-expand'

/**
 * <zh/> `useTableDataPipeline` 选项契约——自 use-table-data-pipeline.ts 拆出（COMPLEXITY-PLAN 战线三，
 * <zh/> 刀法 C）；use-table-data-pipeline.ts re-export 本文件，既有导入路径零变化。
 * <en/> Options contract of `useTableDataPipeline` — split out of use-table-data-pipeline.ts
 * <en/> (COMPLEXITY-PLAN battle line 3, knife C); re-exported, keeping import paths unchanged.
 */
export interface UseTableDataPipelineOptions<T = any> {
  localColumns: MaybeRefOrGetter<ProcessedColumn[]>
  pipelineData: MaybeRefOrGetter<T[]>
  tableData: MaybeRefOrGetter<T[]>
  /**
   * <zh/> 管线顺序（**setup 期静态配置**）：如 `['externalFilter','columnFilter','quickFilter','sort']`
   * <zh/> 可将权限类外部筛前置以减少后续计算。缺省为历史固定顺序。
   *
   * <zh/> **运行时变更不生效**：此处只在 setup 求值一次。运行时需要换序请改用 `pipelineOrder` 的
   * <zh/> 静态数组形态（或销毁重建该 composable）。类型保留 `MaybeRefOrGetter` 是为兼容 getter
   * <zh/> 调用点的既有写法，getter 同样只求值一次——不要依赖其响应性。
   * <en/> Pipeline order (**static setup-time config**). Defaults to the historical order.
   *
   * <en/> **Runtime changes take no effect**: evaluated once at setup. To reorder at runtime,
   * <en/> pass a static array (or destroy/recreate this composable). `MaybeRefOrGetter` is kept for
   * <en/> compatibility with existing getter call sites; a getter is likewise evaluated once — do not
   * <en/> rely on its reactivity.
   */
  pipelineOrder?: MaybeRefOrGetter<DataPipelineStage[] | undefined>
  selectableFn?: MaybeRefOrGetter<((row: T, index: number) => boolean) | undefined>
  isClientPagination: MaybeRefOrGetter<boolean>
  currentPage: MaybeRefOrGetter<number>
  pageSize: MaybeRefOrGetter<number>
  rowSpanCells?: MaybeRefOrGetter<RowSpanCellsConfig | undefined>
  colSpanCells?: MaybeRefOrGetter<ColSpanCellsConfig | undefined>
  ranges?: MaybeRefOrGetter<SpanRange[] | undefined>
  /**
   * <zh/> 用户函数式 spanMethod，透传至 useCellSpan，使虚拟模式下 getSpanInfo 也能反映函数式 spanMethod
   * <en/> User function-style spanMethod, passed through to useCellSpan so getSpanInfo in virtual mode also reflects the function-style spanMethod
   */
  userSpanMethod?: MaybeRefOrGetter<import('./use-cell-span').UserSpanMethod | undefined>
  quickFilterText?: MaybeRefOrGetter<string | undefined>
  externalFilter?: MaybeRefOrGetter<ExternalFilterConfig<T> | undefined>
  treeConfig?: MaybeRefOrGetter<TreeConfig | undefined>
  rowGroupConfig?: MaybeRefOrGetter<RowGroupConfig | undefined>
  rowExpandConfig?: MaybeRefOrGetter<RowExpandConfig | undefined>
  rowPinConfig?: MaybeRefOrGetter<RowPinConfig | undefined>
  /**
   * <zh/> 合成行是否计入分页容量，默认 true（计入）；false 时仅数据行分页，合成行在分页后追加
   * <en/> Whether synthetic rows count towards pagination, default true; false paginates data rows only and appends synthetics after
   */
  includeSynthetic?: MaybeRefOrGetter<boolean>
  rowKeyFn?: MaybeRefOrGetter<(row: T) => string>
  /**
   * <zh/> 分组小计行（AG Grid groupTotalRow）——透传至分页可见性/行分组
   * <en/> Group total rows (AG Grid groupTotalRow) — passed to pagination visibility / row grouping
   */
  groupTotalRow?: MaybeRefOrGetter<GroupTotalRowOption | undefined>
  /** <zh/> 合计标签（AG Grid totalValueGetter）| <en/> Total label (AG Grid totalValueGetter) */
  totalValueGetter?: MaybeRefOrGetter<TotalValueGetter | undefined>
  /** <zh/> 合计标签回退文本 | <en/> Label fallback text */
  sumText?: MaybeRefOrGetter<string | undefined>
  /**
   * <zh/> 国际化翻译函数——透传至行分组供合计标签回退（`table.summary`）使用
   * <en/> i18n translator — forwarded to row grouping for the total-label fallback (`table.summary`)
   */
  t?: MaybeRefOrGetter<Translator | undefined>
  /** <zh/> 粘性抑制（AG Grid suppressStickyTotalRow）| <en/> Sticky suppression (AG Grid suppressStickyTotalRow) */
  suppressStickyTotalRow?: MaybeRefOrGetter<SuppressStickyTotalRow | undefined>
  /** <zh/> 保留组头聚合（AG Grid groupSuppressBlankHeader）| <en/> Keep header aggregates (AG Grid groupSuppressBlankHeader) */
  groupSuppressBlankHeader?: MaybeRefOrGetter<boolean | undefined>
  /**
   * <zh/> 预创建的排序/筛选状态——提供时 noop 存根与懒升级的真实 composable 共用同一 ref，
   * <zh/> 状态标识在升级前后保持稳定，调用方可直接持有引用，无需晚绑定回填
   * <en/> Pre-created sort/filter state — shared by noop stubs and lazily-upgraded real composables,
   * <en/> keeping state identity stable across upgrades so callers hold direct references with no late-bound backfill
   */
  sortState?: Ref<SortState[]>
  filterState?: Ref<Record<string, any>>
  /**
   * <zh/> 排序 Worker 创建失败或运行出错时的回调 | <en/> Callback for sort Worker creation failure or runtime error
   */
  onSortWorkerError?: (error: Error) => void
  /**
   * <zh/> 单元格合并计算因数据规模超限被跳过时的回调 | <en/> Callback invoked when cell span computation is skipped due to scale exceeding limit
   */
  onSpanLimitExceeded?: (info: SpanLimitInfo) => void
  /**
   * <zh/> 固定行总数超限被截断时的回调（顶部优先保留，超出部分移回滚动区）
   * <en/> Callback invoked when pinned rows are truncated past the cap (top wins, extras return to the scroll area)
   */
  onPinLimitExceeded?: (info: { total: number, limit: number, truncatedTop: number, truncatedBottom: number }) => void
  /**
   * <zh/> 行展开持久化存储读/写失败时的回调 | <en/> Callback invoked when row expand persistence storage read/write fails
   */
  onRowExpandStorageError?: (info: RowExpandStorageError) => void
  /**
   * <zh/> 行展开时回调（expanded=true） | <en/> Callback when a row is expanded (expanded=true)
   */
  onRowExpand?: (row: T, rowKey: string | number) => void
  /**
   * <zh/> 行折叠时回调（expanded=false） | <en/> Callback when a row is collapsed (expanded=false)
   */
  onRowCollapse?: (row: T, rowKey: string | number) => void
  /** <zh/> 快速搜索行文本缓存上限，默认 5000 | <en/> Quick filter row text cache size limit, default 5000 */
  quickFilterCacheSize?: number
  /** <zh/> 多列排序最大列数（来自 sortConfig.maxSortColumns），默认不限 | <en/> Max multi-sort columns (from sortConfig.maxSortColumns), unlimited by default */
  maxSortColumns?: number
  /**
   * <zh/> dev-only 警告回调，替代直接 console.warn，便于通过统一错误处理器控制输出
   * <en/> dev-only warning callback, replaces direct console.warn, allowing unified control via error handler
   */
  devWarn?: (message: string, ...args: unknown[]) => void
  /**
   * <zh/> 调试日志器——受 `debug` prop 控制，开启后输出管线各阶段诊断信息
   * <en/> Debug logger — controlled by `debug` prop, outputs per-stage pipeline diagnostics when enabled
   */
  debug?: DebugLogger
}
