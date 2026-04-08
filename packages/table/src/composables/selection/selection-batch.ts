import type { MaybeRefOrGetter, ShallowRef } from 'vue'
import type { TreeApi } from '../../types/config'
import type { SelectionEligibility } from './selection-eligibility'
import type { SelectionQuery } from './selection-query'
import type { SelectionChangeReason } from './selection-types'
import { toValue } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { isSelectableBusinessRow } from '../../utils/synthetic-row'
import { addDescendantKeysToSet, completeAncestors, removeKeyAndTreeRelatives } from '../../utils/tree-selection-cascade'
import { createDescendantSelectablePredicate } from './selection-strategies'

/**
 * <zh/> 批量操作域——全选 / 清空 / 受控设置 / 按 key 批量写入
 * <en/> Batch domain — select-all / clear / controlled set / bulk writes by key
 *
 * @remarks
 * <zh/> 纯工厂而非 composable：全部入口只是「在守卫作用域内改 `selectedKeys` 并派发」，
 * <zh/> 无自有响应式状态与 watcher。所有入口都经 `withSelectionGuard` 包裹，
 * <zh/> 因此可被 `batchSelectionUpdate` 安全地嵌套调用。
 * <en/> A pure factory rather than a composable: every entry point just mutates `selectedKeys`
 * <en/> inside a guard scope and dispatches — no own reactive state, no watchers. Every entry
 * <en/> point is wrapped in `withSelectionGuard`, so it can be safely nested inside
 * <en/> `batchSelectionUpdate`.
 */
export interface SelectionBatchDeps<T = any> {
  /** <zh/> 选中键集 | <en/> selected key set */
  selectedKeys: ShallowRef<Set<string>>
  /** <zh/> 最近点击锚点 | <en/> last-clicked anchor */
  lastClickedKey: ShallowRef<string | null>
  /** <zh/> 守卫作用域（来自状态核） | <en/> guard scope (from the state core) */
  withSelectionGuard: <R>(fn: () => R) => R
  /** <zh/> 事件派发（来自状态核） | <en/> event dispatch (from the state core) */
  emitSelectionChange: (reason: SelectionChangeReason, row?: T) => void
  /** <zh/> 选择资格域 | <en/> selection-eligibility domain */
  eligibility: SelectionEligibility<T>
  /** <zh/> 选中查询域（toggleAll 需要 getCheckStatus） | <en/> selection-query domain (toggleAll needs getCheckStatus) */
  query: SelectionQuery<T>
  /** <zh/> 树形级联策略（selectRowByKey 复用点击语义） | <en/> tree-cascade strategy (selectRowByKey reuses click semantics) */
  handleTreeToggle: (row: T, key: string, shouldSelect: boolean, ignoreSelectable?: boolean) => void
  /** <zh/> 行键函数 | <en/> row key function */
  rowKey: MaybeRefOrGetter<(row: T) => string>
  /** <zh/> 行映射 | <en/> row map */
  rowMap: MaybeRefOrGetter<Map<string, T>>
  /** <zh/> 可选中谓词 | <en/> selectable predicate */
  selectableFn?: MaybeRefOrGetter<((row: T, index: number) => boolean) | undefined>
  /** <zh/> 选择模式 | <en/> selection mode */
  selectionMode?: MaybeRefOrGetter<'single' | 'multiple'>
  /** <zh/> 树形 API | <en/> tree API */
  treeApi?: MaybeRefOrGetter<TreeApi | undefined>
}

/** <zh/> 批量操作域返回 | <en/> Batch-domain return */
export interface SelectionBatch<T = any> {
  selectRowsByKeys: (keys: (string | number)[], selected?: boolean) => void
  toggleAllSelection: (visibleRows: T[]) => void
  selectAll: (visibleRows: T[]) => void
  clearVisibleRows: (visibleRows: T[]) => void
  clearSelection: () => void
  selectRowByKey: (key: string | number, selected?: boolean) => void
  replaceSelection: (rows: T[]) => void
  setSelection: (rows: T[], selected?: boolean) => void
  initSelectionByKeys: (keys: (string | number)[]) => void
}

/**
 * <zh/> 创建批量操作域
 * <en/> Create the batch domain
 */
export function createSelectionBatch<T = any>(deps: SelectionBatchDeps<T>): SelectionBatch<T> {
  const {
    selectedKeys,
    withSelectionGuard,
    emitSelectionChange,
    eligibility,
    query,
    handleTreeToggle,
    rowKey,
    rowMap,
    selectableFn,
    selectionMode,
    treeApi,
  } = deps
  const { isRowSelectable, filterUnselectableKeys, isTreeCascadeEnabled } = eligibility
  /** <zh/> 子孙可选性判定（策略域单一实现，供 selectAll 复用） | <en/> Descendant-selectability predicate (single implementation in the strategies domain, reused by selectAll) */
  const descendantSelectable = createDescendantSelectablePredicate<T>({ rowMap, eligibility })

  /**
   * <zh/> 批量选中/取消选中多行（按 key）。
   * <zh/> 当 selected=true 时为**替换语义**：先用传入的 keys 替换整个选中集（传空数组即清空选中），
   * <zh/> 使其在受控选中场景下可直接由参数决定选中值。
   * <zh/> 当 selected=false 时为**追加取消语义**：仅取消传入的 keys，不影响其他已选中行。
   * <zh/> 当 selected=undefined 时为**切换语义**：逐个切换传入的 keys 的选中状态。
   * <en/> Batch select/deselect rows by key.
   * <en/> When selected=true: **replace semantics** — replaces the entire selection with the given keys
   * <en/> (passing an empty array clears the selection), useful for controlled selection scenarios.
   * <en/> When selected=false: **additive deselect** — only removes the given keys, leaving other selections intact.
   * <en/> When selected=undefined: **toggle** — toggles each key in the array individually.
   * @param keys - <zh/> 行 key 数组 | <en/> row key array
   * @param selected - <zh/> true 替换选中集，false 取消选中，undefined 切换 | <en/> true replace selection, false deselect, undefined toggle
   */
  function selectRowsByKeys(keys: (string | number)[], selected?: boolean): void {
    withSelectionGuard(() => {
      const currentMode = toValue(selectionMode)
      const map = toValue(rowMap)
      // selected=true 时使用替换语义：从空集合开始，仅选入传入的 keys（空数组 = 清空）
      // selected=true uses replace semantics: start from empty set, only select the given keys (empty array = clear)
      const newSet = selected === true ? new Set<string>() : new Set(selectedKeys.value)
      // 记录替换前的选中数量——当 selected=true 且无 changedRows 时（如空数组清空），仍需触发事件
      // Track pre-replace size — when selected=true with no changedRows (e.g. empty array clear), still need to emit
      const oldSize = selectedKeys.value.size
      const changedRows: T[] = []
      for (const rawKey of keys) {
        const strKey = String(rawKey)
        const shouldSelect = selected ?? !newSet.has(strKey)
        if (currentMode === 'single' && shouldSelect) {
          const row = map.get(strKey)
          if (row && !isRowSelectable(row, strKey, true))
            continue
          // <zh/> single 模式仅首个可选项生效——后续 keys 静默丢弃，dev 提示避免误解为多选。
          // <en/> Single mode honors only the first selectable key — later keys are dropped; warn in dev
          // <en/> so callers don't mistake it for multi-select.
          if (isDev && keys.length > 1)
            devWarn('[AdvTable] selectRowsByKeys with multiple keys in single mode: only the first selectable key takes effect.')
          newSet.clear()
          newSet.add(strKey)
          if (row)
            changedRows.push(row)
          break
        }
        if (shouldSelect) {
          const row = map.get(strKey)
          if (row && !isRowSelectable(row, strKey, true))
            continue
          newSet.add(strKey)
          if (row)
            changedRows.push(row)
        }
        else {
          newSet.delete(strKey)
          const row = map.get(strKey)
          if (row)
            changedRows.push(row)
        }
      }
      selectedKeys.value = newSet
      if (changedRows.length > 0) {
        // <zh/> 批量事件约束：逐行派发 select——每行变更均独立通知消费方
        // <en/> Batch-event invariant: emit per changed row — every change notifies consumers
        // <en/> independently
        for (const row of changedRows)
          emitSelectionChange('select', row)
      }
      else if (selected === true && oldSize > 0) {
        // 替换语义下 keys 为空或全部被过滤时，选中集从非空变为空，需触发 init 事件
        // Under replace semantics, when keys is empty or all filtered out, selection goes from non-empty to empty
        emitSelectionChange('init')
      }
    })
  }

  function selectAll(visibleRows: T[]): void {
    withSelectionGuard(() => {
      const currentRowKey = toValue(rowKey)
      const currentSelectableFn = toValue(selectableFn)
      const api = toValue(treeApi)
      const cascade = isTreeCascadeEnabled()
      const newSet = new Set(selectedKeys.value)
      /**
       * <zh/> 级联选中子孙时按 selectableFn 过滤——复用策略域的单一实现，
       * <zh/> 避免不可选行的子孙被"全选"静默选中，也避免该规则在两处漂移。
       * <en/> Filter descendants by selectableFn during cascade — reuses the strategies domain's
       * <en/> single implementation so descendants of non-selectable rows are never silently
       * <en/> selected by "select all", and the rule never drifts across two places.
       */
      const isDescendantSelectable = descendantSelectable
      /**
       * <zh/> 「已被祖先整棵覆盖」的 key 集合——用于短路重复的子树遍历。
       *
       * <zh/> 为何等价：级联写入的子孙集为 `{ X ∈ 后代(K) : isDescendantSelectable(X) }`，
       * <zh/> 而该谓词只依赖节点自身（见 selection-strategies 的单一实现，与发起祖先无关）。
       * <zh/> 因此对任意祖先 A 与其余后代 R，`后代(R) ⊆ 后代(A)` ⇒ R 的级联产物必是 A 级联产物的子集，
       * <zh/> 跳过 R 的遍历不会遗漏任何 key（此推导与遍历顺序无关，无需依赖 DFS 前序）。
       * <zh/> 大树上收益显著：全展开时每行都重复遍历自己的整棵子树（O(n·d)），
       * <zh/> 而命中短路后整体降为 O(n)。
       *
       * <en/> Keys already covered wholesale by an ancestor — used to short-circuit repeated subtree walks.
       *
       * <en/> Why it is equivalent: a cascade writes `{ X ∈ descendants(K) : isDescendantSelectable(X) }`,
       * <en/> and that predicate depends only on the node itself (single implementation in
       * <en/> selection-strategies, independent of the initiating ancestor). Hence for any ancestor A and
       * <en/> its descendant R, `descendants(R) ⊆ descendants(A)`, so R's cascade output is a subset of
       * <en/> A's — skipping R's walk can never drop a key (the derivation is order-independent and needs
       * <en/> no DFS pre-order assumption). The win is large on big trees: fully expanded, every row
       * <en/> re-walks its whole subtree (O(n·d)), whereas hitting the short-circuit reduces it to O(n).
       */
      const covered = cascade ? new Set<string>() : null
      visibleRows.forEach((row, index) => {
        // 与 getCheckStatus 同口径——合成行永不进入选中集（共用 isSelectableBusinessRow）
        if (!isSelectableBusinessRow(row, index, currentSelectableFn ?? undefined))
          return
        const key = currentRowKey(row)
        if (covered?.has(String(key)))
          return
        newSet.add(key)
        if (cascade) {
          // <zh/> 守卫就近（同 clearVisibleRows） | <en/> guard-local (same as clearVisibleRows)
          addDescendantKeysToSet(newSet, key, api!, isDescendantSelectable, covered!)
        }
      })
      if (cascade) {
        // 补父节点时只统计可选后代（不可选后代不阻止父节点满选）
        completeAncestors(newSet, api!, descendantSelectable)
      }
      selectedKeys.value = newSet
      emitSelectionChange('selectAll')
    })
  }

  function clearVisibleRows(visibleRows: T[]): void {
    withSelectionGuard(() => {
      const currentRowKey = toValue(rowKey)
      const currentSelectableFn = toValue(selectableFn)
      const api = toValue(treeApi)
      const cascade = isTreeCascadeEnabled()
      const newSet = new Set(selectedKeys.value)
      visibleRows.forEach((row, index) => {
        // <zh/> 与 selectAll 同口径——合成行永不进入选中集（共用 isSelectableBusinessRow）
        // <en/> Same caliber as selectAll — synthetic rows never enter the selection set (shared isSelectableBusinessRow)
        if (!isSelectableBusinessRow(row, index, currentSelectableFn ?? undefined))
          return
        const key = currentRowKey(row)
        if (cascade) {
          // <zh/> 守卫就近原则：api 的非空性由上方 cascade 判定保证，此处以局部常量承接，
          // <zh/> 避免远距离 `api!` 断言。
          // <en/> Guard-local: api's non-nullity is guaranteed by the cascade check above; bind it
          // <en/> to a local const to avoid the distant `api!` assertion.
          const treeApiNonNull = api!
          removeKeyAndTreeRelatives(newSet, key, treeApiNonNull)
        }
        else {
          newSet.delete(key)
        }
      })
      selectedKeys.value = newSet
      // <zh/> reason 语义约束：清空操作派发 'clear'，批量选/清对消费方可区分
      // <en/> Reason semantics invariant: a CLEAR operation emits 'clear', keeping bulk-select
      // <en/> distinguishable from bulk-clear for consumers
      emitSelectionChange('clear')
    })
  }

  function clearSelection(): void {
    if (selectedKeys.value.size === 0)
      return
    withSelectionGuard(() => {
      selectedKeys.value = new Set()
      emitSelectionChange('clear')
    })
  }

  function toggleAllSelection(visibleRows: T[]): void {
    const status = query.getCheckStatus(visibleRows)
    if (status.isAllSelected) {
      clearVisibleRows(visibleRows)
    }
    else {
      selectAll(visibleRows)
    }
  }

  function selectRowByKey(key: string | number, selected?: boolean): void {
    const strKey = String(key)
    withSelectionGuard(() => {
      const currentMode = toValue(selectionMode)
      const shouldSelect = selected ?? !selectedKeys.value.has(strKey)

      if (currentMode === 'single' && shouldSelect) {
        // <zh/> 单选同样受 selectable 约束：禁选行拒绝写入（未知行放行，跨页乐观保留，由 init 过滤收敛）
        // <en/> Single mode honors selectable too: reject non-selectable rows (unknown rows pass optimistically)
        const row = toValue(rowMap).get(strKey)
        if (row && !isRowSelectable(row, strKey, true))
          return
        selectedKeys.value = new Set([strKey])
        if (row)
          emitSelectionChange('select', row)
        return
      }

      // <zh/> 树形级联：selectRowByKey 需与点击触发的 handleTreeToggle 保持一致
      // <zh/> 否则受控选中（selectedRowKeys）与用户点击行为分裂
      // <en/> Tree cascade: keep selectRowByKey consistent with click-triggered handleTreeToggle
      if (isTreeCascadeEnabled()) {
        const row = toValue(rowMap).get(strKey)
        if (row) {
          if (shouldSelect && !isRowSelectable(row, strKey, true))
            return
          return handleTreeToggle(row, strKey, shouldSelect)
        }
      }

      // <zh/> 非树路径同样校验 selectable：未知行放行（跨页/异步数据），已知禁选行拒绝
      // <en/> Non-tree path validates selectable too: unknown rows pass (cross-page), known unselectable rejected
      if (shouldSelect) {
        const row = toValue(rowMap).get(strKey)
        if (row && !isRowSelectable(row, strKey, true))
          return
      }
      const newSet = new Set(selectedKeys.value)
      shouldSelect ? newSet.add(strKey) : newSet.delete(strKey)
      selectedKeys.value = newSet
      const row = toValue(rowMap).get(strKey)
      if (row)
        emitSelectionChange('select', row)
    })
  }

  function replaceSelection(rows: T[]): void {
    withSelectionGuard(() => {
      const currentRowKey = toValue(rowKey)
      const newSet = new Set<string>()
      rows.forEach((row) => {
        newSet.add(currentRowKey(row))
      })
      selectedKeys.value = newSet
      emitSelectionChange('init')
    })
  }

  function setSelection(rows: T[], selected: boolean = true): void {
    if (rows.length === 0)
      return
    withSelectionGuard(() => {
      const currentRowKey = toValue(rowKey)
      const newSet = new Set(selectedKeys.value)
      rows.forEach((row) => {
        const key = currentRowKey(row)
        if (selected) {
          if (!isRowSelectable(row, key, true))
            return
          newSet.add(key)
        }
        else {
          newSet.delete(key)
        }
      })
      selectedKeys.value = newSet
      emitSelectionChange('init')
    })
  }

  function initSelectionByKeys(keys: (string | number)[]): void {
    withSelectionGuard(() => {
      const currentKeys = selectedKeys.value
      const rawKeys = new Set(keys.map(String))

      const newKeys = filterUnselectableKeys(rawKeys)

      if (isDev && typeof console !== 'undefined' && rawKeys.size > newKeys.size) {
        const droppedKeys = [...rawKeys].filter(k => !newKeys.has(k))
        devWarn(
          `[AdvTable] ${droppedKeys.length} key(s) in selectedRowKeys were silently filtered out by selectableFn: `
          + `${droppedKeys.slice(0, 5).join(', ')}${droppedKeys.length > 5 ? ` …(+${droppedKeys.length - 5} more)` : ''}. `
          + 'These keys do not match any selectable row and will not appear in selectionChange / select events.',
        )
      }

      // 检查值是否真的变化了，避免不必要的更新 | Check whether the value actually changed, to avoid unnecessary updates
      if (currentKeys.size === newKeys.size) {
        let isSame = true
        for (const key of currentKeys) {
          if (!newKeys.has(key)) {
            isSame = false
            break
          }
        }
        if (isSame)
          return
      }

      selectedKeys.value = newKeys
      emitSelectionChange('init')
    })
  }

  return {
    selectRowsByKeys,
    toggleAllSelection,
    selectAll,
    clearVisibleRows,
    clearSelection,
    selectRowByKey,
    replaceSelection,
    setSelection,
    initSelectionByKeys,
  }
}
