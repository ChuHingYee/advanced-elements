import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { TreeApi } from '../../types/config'
import type { RendererCaps } from '../../types/renderer-caps'
import type { CheckStatus, UseSelectionStateReturn } from '../selection/use-selection-state'
import type { SelectionChangeMeta } from './selection-types'
import { computed, toValue, watch } from 'vue'
import { deriveCheckStatus } from '../../utils/checkbox-state'
import { isSelectableBusinessRow } from '../../utils/synthetic-row'
import { useSelectionState } from '../selection/use-selection-state'

export interface UseTableSelectionOptions<T> {
  rowKey: ComputedRef<(row: T) => string>
  allData: Ref<T[]>
  rowKeyMeta: Ref<{ keyToRow: Map<string, T>, keyToIndex: Map<string, number> }>
  selectableFn: ComputedRef<((row: T, rowIndex: number) => boolean) | undefined>
  selectionMode: ComputedRef<'single' | 'multiple'>
  rowMultiSelectWithClick: ComputedRef<boolean>
  /**
   * <zh/> 外部受控选中键（真正受控）：传入即以之为准回写内部选中（见下方点燃链注释），未传入时内部态自治；
   * <zh/> 内部选择提交后经顶层回写 `v-model:selectedRowKeys`，父组件拒绝更新时回滚内部选中。
   * <en/> Externally controlled selection keys (truly controlled): when provided it writes back into internal selection; internal state is autonomous otherwise.
   * <en/> Internal commits write back to `v-model:selectedRowKeys`; a parent rejecting the update reverts internal selection.
   */
  selectedRowKeys: () => (string | number)[] | undefined
  visibleData: () => T[]
  finalDisplayData: () => T[]
  /**
   * <zh/> 渲染器能力表——选择作用域只查 `selectionScope`，不询问渲染模式布尔量。
   * <en/> Renderer capability table — the selection scope queries `selectionScope` only, never the render-mode boolean.
   */
  caps: MaybeRefOrGetter<Pick<RendererCaps, 'selectionScope'>>
  treeApi?: ComputedRef<TreeApi | undefined>

  onSelectionChange: (rows: T[], meta: SelectionChangeMeta) => void
  onSelect: (payload: { selection: T[], row: T }) => void
  onSelectAll: (selection: T[]) => void
  onRowSelected: (payload: { row: T, selected: boolean }) => void
  /** <zh/> rowMap 变化时是否剪除丢失行（见 useSelectionState.pruneOnRowMapChange） | <en/> whether to prune lost rows on rowMap change (see useSelectionState.pruneOnRowMapChange) */
  pruneOnRowMapChange?: MaybeRefOrGetter<boolean | undefined>
}

const EMPTY_CHECK_STATUS: Readonly<CheckStatus> = Object.freeze({ isAllSelected: false, isIndeterminate: false })

export interface UseTableSelectionReturn<T> {
  selectionState: UseSelectionStateReturn<T>
  checkStatus: ComputedRef<CheckStatus>
  refreshSelection: () => void
  toggleAllSelection: () => void
  selectAll: (data?: T[]) => void
  selectAllFiltered: () => void
  deselectAllFiltered: () => void
  selectAllOnCurrentPage: () => void
  deselectAllOnCurrentPage: () => void
  getSelectedIndices: () => number[]
  getCurrentPageData: () => T[]
}

/**
 * 表格选中编排 composable — 整合 useSelectionState 与可见数据，
 * 提供跨页选中、全选/反选、当前页选中等高级操作。
 *
 * @param options - 选中编排配置
 * @returns 选中状态与高级操作方法
 */
export function useTableSelection<T>(options: UseTableSelectionOptions<T>): UseTableSelectionReturn<T> {
  const {
    rowKey,
    allData,
    rowKeyMeta,
    selectableFn,
    selectionMode,
    rowMultiSelectWithClick,
    selectedRowKeys,
    visibleData,
    finalDisplayData,
    caps,
    treeApi,
    onSelectionChange,
    onSelect,
    onSelectAll,
    onRowSelected,
    pruneOnRowMapChange,
  } = options

  const selectionState = useSelectionState<T>(
    {
      rowKey,
      allData,
      rowMap: computed(() => rowKeyMeta.value.keyToRow),
      keyToIndexMap: computed(() => rowKeyMeta.value.keyToIndex),
      // <zh/> Shift 范围与全选/checkStatus 同作用域——过滤/分页后不可见行不被误选（default=当页，virtual=全量筛选结果）
      // <en/> Shift ranges share the select-all/checkStatus scope — invisible rows are never picked up after filtering/pagination (default=current page, virtual=all filtered rows)
      shiftScopeData: () => resolveScopeData(),
      selectableFn,
      selectionMode,
      rowMultiSelectWithClick,
      treeApi,
      pruneOnRowMapChange,
    },
    {
      // <zh/> 内层 meta 恒有值（core 每次派发必构 meta，optional 仅为类型兼容） | <en/> Inner meta is always present (core builds one per dispatch; optional for type compatibility only)
      onSelectionChange: (rows, meta) => onSelectionChange(rows, meta!),
      onSelect: payload => onSelect(payload),
      onSelectAll: selection => onSelectAll(selection),
      onRowSelected: payload => onRowSelected(payload),
    },
  )

  /**
   * <zh/> 选择作用域数据集——`selectionScope==='filtered'` 时 visibleData 仅为窗口行，全选口径须用 finalDisplayData；
   * <zh/> `'page'` 时全量行均已渲染，用 visibleData。查询的是能力（`selectionScope`）而非模式。
   * <en/> Selection-scope dataset — with `selectionScope==='filtered'` visibleData is window-only, so the
   * <en/> select-all scope must use finalDisplayData; otherwise all rows are rendered and visibleData
   * <en/> applies. It queries the capability (`selectionScope`), never the mode.
   */
  function resolveScopeData(): T[] {
    return toValue(caps).selectionScope === 'filtered' ? finalDisplayData() : visibleData()
  }

  /** <zh/> 稳定的 checkStatus——值未变化时复用同一引用，避免无谓重渲染 | <en/> Stable checkStatus — returns same reference when values unchanged to avoid re-renders */
  /**
   * <zh/> checkStatus 增量维护——作用域数据/可选谓词/行键函数不变时不全量重算：
   * <zh/> 缓存可选域键集（scopeKeys）与总数（total），选中变化仅对新旧 Set 做差分，
   * <zh/> 命中域内键才 ±1；数据/谓词/行键变化时才全量重建，保证 all/indeterminate 与全量口径逐位一致。
   * <en/> incremental checkStatus — when scope data/selectable predicate/rowKey are unchanged,
   * <en/> reuse the cached selectable key set + total and diff old vs new Sets (±1 for in-scope keys);
   * <en/> full rebuild only on data/predicate/rowKey change, keeping all/indeterminate bit-identical to full scan.
   */
  const checkCache: {
    data: T[] | null
    fn: ((row: T, index: number) => boolean) | undefined
    rowKey: ((row: T) => string) | null
    total: number
    scopeKeys: Set<string>
    selectedCount: number
    keys: Set<string> | null
  } = {
    data: null,
    fn: undefined,
    rowKey: null,
    total: 0,
    scopeKeys: new Set<string>(),
    selectedCount: 0,
    keys: null,
  }
  const checkStatus = computed<CheckStatus>((prev) => {
    if (selectionMode.value !== 'multiple')
      return EMPTY_CHECK_STATUS
    /**
     * 虚拟滚动下 visibleData 仅包含可视区行，全选状态判断应基于 finalDisplayData（全量筛选后数据），
     * 否则滚动后全选 checkbox 状态会因可视区行变化而闪烁。
     */
    const dataForCheck = resolveScopeData()
    const fn = selectableFn.value
    const currentRowKey = rowKey.value
    const keys = selectionState.selectedKeys.value
    if (
      checkCache.data === dataForCheck
      && checkCache.fn === fn
      && checkCache.rowKey === currentRowKey
      && checkCache.keys !== null
    ) {
      const prevKeys = checkCache.keys
      if (prevKeys !== keys) {
        let delta = 0
        if (prevKeys.size <= keys.size) {
          for (const k of keys) {
            if (!prevKeys.has(k) && checkCache.scopeKeys.has(k))
              delta++
          }
          for (const k of prevKeys) {
            if (!keys.has(k) && checkCache.scopeKeys.has(k))
              delta--
          }
        }
        else {
          for (const k of prevKeys) {
            if (!keys.has(k) && checkCache.scopeKeys.has(k))
              delta--
          }
          for (const k of keys) {
            if (!prevKeys.has(k) && checkCache.scopeKeys.has(k))
              delta++
          }
        }
        checkCache.selectedCount += delta
        checkCache.keys = keys
      }
      // <zh/> 与 selection-query/checkbox-state 全量口径一致（total=0 时全不选） | <en/> Same caliber as the full-scan path (total=0 → none selected)
      const next = deriveCheckStatus(checkCache.selectedCount, checkCache.total)
      if (prev && prev.isAllSelected === next.isAllSelected && prev.isIndeterminate === next.isIndeterminate)
        return prev
      return next
    }
    const next = selectionState.getCheckStatus(dataForCheck, fn)
    // <zh/> 重建缓存：同步计算 scopeKeys/total/selectedCount，供下次差分 | <en/> Rebuild cache for next diff
    const scopeKeys = new Set<string>()
    let total = 0
    let selectedCount = 0
    for (let i = 0; i < dataForCheck.length; i++) {
      const r = dataForCheck[i] as T
      // <zh/> 与 getCheckStatus 同口径：合成行永不计入、selectableFn 过滤，共用 isSelectableBusinessRow
      // <en/> Same caliber as getCheckStatus: synthetic rows never count, selectableFn filters — shared isSelectableBusinessRow
      if (!isSelectableBusinessRow(r, i, fn))
        continue
      total++
      let k: string
      try {
        k = currentRowKey(r)
      }
      catch {
        continue
      }
      scopeKeys.add(k)
      if (keys.has(k))
        selectedCount++
    }
    checkCache.data = dataForCheck
    checkCache.fn = fn
    checkCache.rowKey = currentRowKey
    checkCache.total = total
    checkCache.scopeKeys = scopeKeys
    checkCache.selectedCount = selectedCount
    checkCache.keys = keys
    if (prev && prev.isAllSelected === next.isAllSelected && prev.isIndeterminate === next.isIndeterminate)
      return prev
    return next
  })

  /** <zh/> 将外部 selectedRowKeys 同步进选择状态 | <en/> Sync external selectedRowKeys into selection state */
  function refreshSelection() {
    const keys = selectedRowKeys()
    if (keys) {
      if (keys.length > 0) {
        selectionState.initSelectionByKeys(keys)
      }
      else {
        selectionState.clearSelection()
      }
    }
  }

  /**
   * <zh/> 受控选中键同步回调——外部 selectedRowKeys 变化（含 setup immediate）即刷新内部选中
   * <en/> Controlled-keys sync callback — refreshes internal selection on external selectedRowKeys change (incl. setup immediate)
   */
  function onSelectedRowKeysChanged(): void {
    refreshSelection()
  }

  // <zh/> 点燃链（接上条）：外部 selectedRowKeys 变化 → refreshSelection 回写内部选中；与 rowMap 剪枝派发形成闭环，排查选中抖动时两处对照
  // <en/> Ignition chain (cont.): external selectedRowKeys change → refreshSelection writes back; forms a loop with rowMap-prune notify
  watch(() => selectedRowKeys(), onSelectedRowKeysChanged, { immediate: true })

  /**
   * <zh/> 大数据全选指引：单次写入为 O(n) Set 构建 + 单次派发（封装层收敛），但 ElTable default 模式会对选中变化重渲染可见行
   * <zh/> 千行以上全选/连选优先 `mode="virtual"`，或改用 `selectAllOnCurrentPage` 缩小作用域。
   * <en/> Large-data select-all guidance: one O(n) Set build + one notify on our side, but ElTable default mode re-renders visible rows on selection change;
   * <en/> prefer `mode="virtual"` beyond ~1k rows, or `selectAllOnCurrentPage` to narrow the scope.
   */
  function toggleAllSelection() {
    /**
     * 虚拟滚动下 toggleAllSelection 需基于 finalDisplayData（全量筛选后数据），
     * 与 checkStatus 的数据源保持一致，否则全选 checkbox 点击后状态会不一致。
     */
    const dataForToggle = resolveScopeData()
    selectionState.toggleAllSelection(dataForToggle)
  }

  function selectAll(data?: T[]) {
    selectionState.selectAll(data ?? allData.value)
  }

  function selectAllFiltered() {
    selectionState.selectAll(finalDisplayData())
  }

  function deselectAllFiltered() {
    selectionState.clearVisibleRows(finalDisplayData())
  }

  function selectAllOnCurrentPage() {
    selectionState.selectAll(visibleData())
  }

  function deselectAllOnCurrentPage() {
    selectionState.clearVisibleRows(visibleData())
  }

  function getSelectedIndices(): number[] {
    return selectionState.getSelectedIndices(allData.value)
  }

  function getCurrentPageData(): T[] {
    return [...visibleData()]
  }

  return {
    selectionState,
    checkStatus,
    refreshSelection,
    toggleAllSelection,
    selectAll,
    selectAllFiltered,
    deselectAllFiltered,
    selectAllOnCurrentPage,
    deselectAllOnCurrentPage,
    getSelectedIndices,
    getCurrentPageData,
  }
}
