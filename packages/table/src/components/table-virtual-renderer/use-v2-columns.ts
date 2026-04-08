/**
 * <zh/> virtual 渲染器的列装配域
 * <en/> Virtual-renderer column assembly
 *
 * @remarks
 * <zh/> 职责单一：把「统一索引域的列」装配为 ElTableV2 的最终列数组，并派生其几何量：
 * <zh/> `useVirtualColumns`（列准备）→ selection/normal/fixed 三组 V2 列 → 合并 `v2Columns`
 * <zh/> → 列偏移前缀和、表头层级、溢出检测与表头高度。
 * <zh/> 关键不变式：`v2Columns` 的顺序恒为 `[...selection, ...normal(非 fixed), ...normal(fixed)]`，
 * <zh/> 与 `allVirtualLeafColumns`（统一索引域）及 `data-adv-cell-col` 语义一致——
 * <zh/> 顺序错乱会让 `columns.value[index]` 返回错误的列对象。
 * <en/> Single responsibility: assemble the unified-index-domain columns into ElTableV2's final column
 * <en/> array and derive its geometry: `useVirtualColumns` (column prep) → selection/normal/fixed V2
 * <en/> column groups → merged `v2Columns` → column offset prefix sums, header depth, overflow
 * <en/> detection and header height.
 * <en/> Key invariant: `v2Columns` is always ordered `[...selection, ...normal(non-fixed),
 * <en/> ...normal(fixed)]`, matching `allVirtualLeafColumns` (unified index domain) and the
 * <en/> `data-adv-cell-col` semantics — a wrong order makes `columns.value[index]` return the wrong column.
 */
import type { Column } from 'element-plus'
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { UseSelectionStateReturn } from '../../composables/selection/use-selection-state'
import type { ProcessedColumn as LocalColumn } from '../../types'
import type { TableHoverLayerApi } from '../../types/config-api'
import type { V2RendererProps } from './v2-renderer-props'
import { computed } from 'vue'
import { extractLeafWidths } from '../../utils/column-tree'
import { mapsShallowEqual } from '../../utils/equality'
import { getColumnDepth, getColumnKey } from '../../utils/shared'
import { useNormalV2Columns } from './normal-v2-column'
import { useSelectionV2Column } from './selection-v2-column'
import { useVirtualColumns } from './use-virtual-columns'

/** <zh/> 列装配域依赖 | <en/> Column-assembly deps */
export interface UseV2ColumnsDeps<T = any> {
  /** <zh/> 渲染器 props | <en/> renderer props */
  props: V2RendererProps
  /** <zh/> 列宽解析器 | <en/> column width resolver */
  getColumnWidth: (col: LocalColumn) => number
  /** <zh/> 列宽覆盖表（reactive 裸对象，非 ref） | <en/> column width overrides (a bare reactive object, not a ref) */
  columnWidths: Record<string, number>
  /** <zh/> 可见的普通列（来自 useVirtualRenderer） | <en/> visible normal columns (from useVirtualRenderer) */
  displayNormalColumns: ComputedRef<LocalColumn[]>
  /** <zh/> 行键函数 | <en/> row key function */
  rowKeyFn: ComputedRef<(row: T) => string>
  /** <zh/> hover 层 API | <en/> hover layer API */
  hoverLayerApi: TableHoverLayerApi
  /** <zh/> 转发的插槽 | <en/> forwarded slots */
  slots: MaybeRefOrGetter<any>
  /** <zh/> 国际化函数 | <en/> locale function */
  t: () => ((path: string) => string) | undefined
  /** <zh/> 是否存在 hover 操作列 | <en/> whether hover option columns exist */
  hasHoverOptionColumns: ComputedRef<boolean>
  /** <zh/> hover 操作列 | <en/> hover option columns */
  hoverOptionColumns: ComputedRef<LocalColumn[]>
  /** <zh/> hover 操作是否走 teleport | <en/> whether hover options use teleport */
  hoverOptionTeleport: Ref<boolean | undefined> | ComputedRef<boolean | undefined>
  /** <zh/> 是否应使用 teleport | <en/> whether teleport should be used */
  shouldUseTeleport: ComputedRef<boolean>
  /** <zh/> 容器宽度（溢出检测） | <en/> container width (overflow detection) */
  tableContainerWidth: Ref<number>
  /** <zh/> 选择模式 | <en/> selection mode */
  resolvedSelectionMode: ComputedRef<'single' | 'multiple'>
  /** <zh/> 选择状态 API（来自表格上下文） | <en/> selection state API (from the table context) */
  selectionState?: UseSelectionStateReturn | undefined
  /** <zh/> 树形 API（来自表格上下文） | <en/> tree API (from the table context) */
  treeApi?: any
  /** <zh/> 表头点击 | <en/> header click */
  onHeaderClick: (params: any) => void
  /** <zh/> 表头右键 | <en/> header contextmenu */
  onHeaderContextmenu: (params: any) => void
  /** <zh/> 列分组折叠切换 | <en/> column group collapse toggle */
  onToggleColumnGroupCollapse: (key: string) => void
}

/**
 * <zh/> 创建列装配域
 * <en/> Create the column-assembly domain
 */
export function useV2Columns<T = any>(deps: UseV2ColumnsDeps<T>) {
  const {
    props,
    getColumnWidth,
    columnWidths,
    displayNormalColumns,
    rowKeyFn,
    hoverLayerApi,
    slots,
    t,
    hasHoverOptionColumns,
    hoverOptionColumns,
    hoverOptionTeleport,
    shouldUseTeleport,
    tableContainerWidth,
    resolvedSelectionMode,
    selectionState,
    treeApi,
    onHeaderClick,
    onHeaderContextmenu,
    onToggleColumnGroupCollapse,
  } = deps

  const {
    normalizedColumns,
    mainFiltered,
    leftDepth,
    rightDepth,
    preparedColumns,
  } = useVirtualColumns({
    columns: () => props.columns,
    isCollapsed: props.isCollapsed,
    getColumnWidth,
  })

  const { selectionV2Columns } = useSelectionV2Column<T>({
    selectionColumns: props.selectionColumns,
    selectionWidth: props.selectionWidth,
    selectionMode: () => resolvedSelectionMode.value,
    data: () => props.data,
    checkStatus: () => props.checkStatus,
    selectionState,
    selectableFn: props.selectableFn,
    rowKeyFn,
    treeApi,
  })

  const headerMainFilteredTree = computed(() => {
    const selCols = selectionV2Columns.value
    // <zh/> any 说明（已用 vue-tsc 验证）：V2 选择列为匿名对象形态（缺 ProcessedColumn 必填的 hidden 等字段），
    // <zh/> 与 mainFiltered（ProcessedColumn[]）同数组会触发结构失配；下游仅读 width/children，运行时安全。
    // <en/> Why any (verified with vue-tsc): the V2 selection column is an anonymous shape (missing ProcessedColumn
    // <en/> required fields like hidden), so joining it with mainFiltered (ProcessedColumn[]) mismatches; downstream
    // <en/> only reads width/children, so this is safe at runtime.
    if (selCols.length > 0)
      return [selCols[0] as any, ...mainFiltered.value]
    return mainFiltered.value
  })
  const headerMainLeafWidths = computed(() => extractLeafWidths(headerMainFilteredTree.value, getColumnWidth))
  const headerMainDepth = computed(() => getColumnDepth(headerMainFilteredTree.value))

  const { normalV2Columns, fixedV2Columns } = useNormalV2Columns({
    displayNormalColumns,
    displayColumns: normalizedColumns,
    hasHoverOptionColumns,
    hoverOptionColumns,
    hoverApi: hoverLayerApi,
    slots,
    t,
    rowKeyFn,
    getColumnWidth,
    columnWidths,
    hoverOptionTeleport,
    shouldUseTeleport,
    onHeaderClick,
    onHeaderContextmenu,
    canCollapse: props.canCollapse,
    isCollapsed: props.isCollapsed,
    onToggleColumnGroupCollapse,
    originalColumns: props.originalColumns,
    autoSizeColumns: () => props.autoSizeColumns,
    floatingFilter: () => props.floatingFilter,
    resizable: () => props.resizable,
    preparedColumns,
    editConfig: () => props.editConfig,
    columnIndexOffset: () => props.selectionColumns.length,
  })

  const v2KeyToOriginalCol = computed<Map<string, any>>((prev) => {
    const map = new Map<string, any>()
    const selV2 = selectionV2Columns.value
    const selOrig = props.selectionColumns
    for (let i = 0; i < selV2.length && i < selOrig.length; i++) {
      map.set(getColumnKey(selV2[i]), selOrig[i])
    }
    // <zh/> normalColumns 包含非固定列和固定列，需同时映射 normalV2Columns 和 fixedV2Columns
    // <en/> normalColumns includes both non-fixed and fixed columns; must map both normalV2Columns and fixedV2Columns
    const normOrig = props.normalColumns
    const normOrigByKey = new Map<string, any>()
    for (const col of normOrig) {
      normOrigByKey.set(getColumnKey(col), col)
    }
    for (const v2Col of normalV2Columns.value) {
      const origCol = normOrigByKey.get(getColumnKey(v2Col))
      if (origCol)
        map.set(getColumnKey(v2Col), origCol)
    }
    for (const v2Col of fixedV2Columns.value) {
      const origCol = normOrigByKey.get(getColumnKey(v2Col))
      if (origCol)
        map.set(getColumnKey(v2Col), origCol)
    }
    if (prev && mapsShallowEqual(prev, map))
      return prev
    return map
  })

  const v2Columns = computed<Column<any>[]>((prev) => {
    const mergedColumns = [...selectionV2Columns.value, ...normalV2Columns.value, ...fixedV2Columns.value] as Column<any>[]

    if (prev && prev.length === mergedColumns.length && prev.every((col, i) => col === mergedColumns[i]))
      return prev
    return mergedColumns
  })

  /**
   * <zh/> v2Columns 的「列 key → 下标」映射——与 v2Columns 同源派生（随同一 computed 链缓存），
   * <zh/> 即 `data-adv-cell-col`（normal-v2-column 的 globalColIndex）的逆查表。
   * <zh/> getInteractionDomain 必须消费本表，不得自行 `new Map(v2Columns...)` 重建列序：
   * <zh/> 两处各自按 getColumnKey 重建时，一旦列集不同源（selection/fixed/teleport/分组列）
   * <zh/> 即索引漂移，表现为 virtual 范围选择拖拽无反应（翻译 miss → -1）。
   * <en/> "column key → index" map over v2Columns — derived from the same source as v2Columns
   * <en/> (cached along the same computed chain); the reverse lookup for `data-adv-cell-col`
   * <en/> (normal-v2-column's globalColIndex). getInteractionDomain MUST consume this map and
   * <en/> never rebuild the order via its own `new Map(v2Columns...)`: two independent
   * <en/> getColumnKey rebuilds drift once the column sets diverge (selection/fixed/teleport/
   * <en/> grouped columns), surfacing as a virtual range-selection drag that does nothing
   * <en/> (translation miss → -1).
   */
  const v2ColumnIndexByKey = computed<Map<string, number>>((prev) => {
    const map = new Map<string, number>()
    v2Columns.value.forEach((col, index) => {
      const key = getColumnKey(col as unknown as Parameters<typeof getColumnKey>[0])
      if (!map.has(key))
        map.set(key, index)
    })
    if (prev && mapsShallowEqual(prev, map))
      return prev
    return map
  })

  /**
   * <zh/> 列偏移前缀和缓存——scrollToColumn 由 O(c) 累加降为 O(1) 查表，随 v2Columns 同步更新
   * <en/> Column offset prefix-sum cache — scrollToColumn drops from O(c) accumulation to O(1) lookup, synced with v2Columns
   */
  const v2ColumnOffsetCache = computed(() => {
    const cols = v2Columns.value
    // <zh/> 显式 number[] 注解，避免字面量被推断为 never[]/{}[] 导致后续累加报错
    // <en/> Explicit number[] annotation keeps the literal from widening to never[]/{}[] for the accumulation below
    const offsets: number[] = [0]
    for (let i = 0; i < cols.length; i++)
      offsets.push((offsets[i] ?? 0) + Number((cols[i] as { width?: unknown })?.width ?? 0))
    const keyToIndex = new Map<string, number>()
    for (let i = 0; i < cols.length; i++) {
      const key = getColumnKey(cols[i] as unknown as Parameters<typeof getColumnKey>[0])
      if (!keyToIndex.has(key))
        keyToIndex.set(key, i)
    }
    return { offsets, keyToIndex }
  })

  const globalHeaderDepth = computed(() => preparedColumns.value.maxDepth)

  /**
   * <zh/> 列总宽度是否超出容器宽度（仅在所有列都有数值宽度时检测）
   * <en/> Whether total columns width exceeds container width (only checked when all columns have numeric width)
   * @remarks
   * <zh/> 当 autoSizeColumns 为 false 时，所有列都有固定数值宽度，可以准确计算溢出。
   * <zh/> 当 autoSizeColumns 为 true 时，部分列的 width 可能为 undefined（flex 列），
   * <zh/> 此时不检测溢出，返回 false，避免影响 ElTableV2 的 bodyWidth 计算。
   * <en/> When autoSizeColumns is false, all columns have fixed numeric widths, overflow can be accurately calculated.
   * <en/> When autoSizeColumns is true, some columns may have undefined width (flex columns),
   * <en/> in which case overflow is not detected and false is returned to avoid breaking ElTableV2's bodyWidth calculation.
   */
  const v2ColumnsOverflow = computed(() => {
    if (tableContainerWidth.value <= 0)
      return false
    let totalWidth = 0
    for (const col of v2Columns.value) {
      const w = col.width
      if (typeof w !== 'number')
        return false
      totalWidth += w
    }
    return totalWidth > tableContainerWidth.value
  })

  const needsFixedWidth = computed(() => fixedV2Columns.value.length > 0 || globalHeaderDepth.value > 1 || v2ColumnsOverflow.value)

  const computedHeaderHeight = computed(() => {
    if (props.showHeader === false)
      return 0
    const depth = globalHeaderDepth.value
    const hasFloating = props.floatingFilter && depth > 0
    if (depth <= 1)
      return hasFloating ? props.headerCellHeight + props.floatingFilterHeight : props.headerCellHeight
    const heights = Array.from({ length: depth }).fill(props.headerCellHeight) as number[]
    if (hasFloating)
      heights[depth - 1] = props.headerCellHeight + props.floatingFilterHeight
    return heights
  })

  return {
    normalizedColumns,
    mainFiltered,
    leftDepth,
    rightDepth,
    preparedColumns,
    selectionV2Columns,
    headerMainFilteredTree,
    headerMainLeafWidths,
    headerMainDepth,
    normalV2Columns,
    fixedV2Columns,
    v2KeyToOriginalCol,
    v2Columns,
    v2ColumnIndexByKey,
    v2ColumnOffsetCache,
    globalHeaderDepth,
    v2ColumnsOverflow,
    needsFixedWidth,
    computedHeaderHeight,
  }
}
