import type { MaybeRefOrGetter, ShallowRef } from 'vue'
import type { TreeApi } from '../../types/config'
import type { SelectionEligibility } from './selection-eligibility'
import type { SelectionChangeReason } from './selection-types'
import { toValue } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { calculateShiftSelect } from '../../utils/selection-range'
import {
  isAllDescendantsSelected,
  removeKeyAndTreeRelatives,
} from '../../utils/tree-selection-cascade'

/**
 * <zh/> 交互策略域——单击 / Ctrl / Shift / 默认 toggle / 树形级联五种选中语义
 * <en/> Interaction-strategy domain — the five selection semantics: click / Ctrl / Shift / default toggle / tree cascade
 *
 * @remarks
 * <zh/> 纯工厂而非 composable：每个策略只做「读当前状态 → 写新 Set → 派发」三步，
 * <zh/> 不持有响应式状态、不注册 watcher。状态写入统一收敛为 `selectedKeys.value = newSet`
 * <zh/> （整体替换而非原地改 Set），以稳定触发 `shallowRef` 依赖。
 * <en/> A pure factory rather than a composable: each strategy only does "read current state →
 * <en/> build a new Set → dispatch", owning no reactive state and registering no watchers.
 * <en/> Writes are uniformly `selectedKeys.value = newSet` (whole-value replacement rather than
 * <en/> in-place Set mutation) so `shallowRef` dependencies fire reliably.
 */
export interface SelectionStrategiesDeps<T = any> {
  /** <zh/> 选中键集 | <en/> selected key set */
  selectedKeys: ShallowRef<Set<string>>
  /** <zh/> 最近点击锚点 | <en/> last-clicked anchor */
  lastClickedKey: ShallowRef<string | null>
  /** <zh/> 事件派发（来自状态核） | <en/> event dispatch (from the state core) */
  emitSelectionChange: (reason: SelectionChangeReason, row?: T) => void
  /** <zh/> 选择资格域 | <en/> selection-eligibility domain */
  eligibility: SelectionEligibility<T>
  /** <zh/> 行键函数 | <en/> row key function */
  rowKey: MaybeRefOrGetter<(row: T) => string>
  /** <zh/> 全量数据（Shift 范围计算在未传 shiftScopeData 时的回退；资格判定索引亦用它） | <en/> Full data (fallback for Shift range computation when shiftScopeData is absent; eligibility indexes use it too) */
  allData: MaybeRefOrGetter<T[]>
  /**
   * <zh/> Shift 范围计算的数据域——传入时范围按此切片，并按此重建索引（不再用全局 keyToIndexMap）。
   * <zh/> 默认回退 `allData`。
   * <en/> Data domain for Shift range computation — when provided, ranges slice it and indexes rebuild from it (the global keyToIndexMap is no longer used).
   * <en/> Falls back to `allData` when omitted.
   */
  shiftScopeData?: MaybeRefOrGetter<T[]>
  /** <zh/> 行映射 | <en/> row map */
  rowMap: MaybeRefOrGetter<Map<string, T>>
  /** <zh/> 可选中谓词 | <en/> selectable predicate */
  selectableFn?: MaybeRefOrGetter<((row: T, index: number) => boolean) | undefined>
  /** <zh/> key→索引映射 | <en/> key→index map */
  keyToIndexMap?: MaybeRefOrGetter<Map<string, number>>
  /** <zh/> 树形 API | <en/> tree API */
  treeApi?: MaybeRefOrGetter<TreeApi | undefined>
}

/** <zh/> 交互策略域返回 | <en/> Interaction-strategy return */
export interface SelectionStrategies<T = any> {
  handleSingleSelect: (row: T, key: string) => void
  handleCtrlSelect: (row: T, key: string, shouldSelect: boolean, ignoreSelectable?: boolean) => void
  handleShiftSelect: (row: T, key: string, shouldSelect: boolean, ignoreSelectable?: boolean) => void
  handleDefaultToggle: (row: T, key: string, shouldSelect: boolean, wasSelected: boolean) => void
  handleTreeToggle: (row: T, key: string, shouldSelect: boolean, ignoreSelectable?: boolean) => void
}

/**
 * <zh/> 创建交互策略域
 * <en/> Create the interaction-strategy domain
 */
export function createSelectionStrategies<T = any>(deps: SelectionStrategiesDeps<T>): SelectionStrategies<T> {
  const {
    selectedKeys,
    lastClickedKey,
    emitSelectionChange,
    eligibility,
    rowKey,
    allData,
    shiftScopeData,
    rowMap,
    selectableFn,
    keyToIndexMap,
    treeApi,
  } = deps
  const { isRowSelectable } = eligibility

  /**
   * 单选策略——清除其他选中，仅选中当前行。
   * Single selection strategy — clear all other selections, select only this row.
   * @param row - <zh/> 目标行 | <en/> target row
   * @param key - <zh/> 行的唯一标识 | <en/> row's unique key
   */
  function handleSingleSelect(row: T, key: string): void {
    selectedKeys.value = new Set([key])
    lastClickedKey.value = key
    emitSelectionChange('select', row)
  }

  /**
   * Ctrl 点击策略——独立切换单行选中状态，不影响其他行。
   * Ctrl-click strategy — toggle single row independently without affecting others.
   * @param row - <zh/> 目标行 | <en/> target row
   * @param key - <zh/> 行的唯一标识 | <en/> row's unique key
   * @param shouldSelect - <zh/> 是否意图选中 | <en/> whether the intent is to select
   * @param [ignoreSelectable] - <zh/> 是否跳过 selectable 检查 | <en/> whether to skip the selectable check
   */
  function handleCtrlSelect(row: T, key: string, shouldSelect: boolean, ignoreSelectable?: boolean): void {
    if (!isRowSelectable(row, key, shouldSelect, ignoreSelectable))
      return
    const newSet = new Set(selectedKeys.value)
    shouldSelect ? newSet.add(key) : newSet.delete(key)
    selectedKeys.value = newSet
    lastClickedKey.value = key
    emitSelectionChange('select', row)
  }

  function handleShiftSelect(row: T, key: string, shouldSelect: boolean, ignoreSelectable?: boolean): void {
    const allDataValue = toValue(allData)
    if (allDataValue.length === 0)
      return

    const currentRowKey = toValue(rowKey)
    const anchorKey = lastClickedKey.value
    const currentKeyToIndexMap = keyToIndexMap ? toValue(keyToIndexMap) : undefined
    // <zh/> 作用域数据优先——过滤/分页后锚点到点击间的不可见行不再被误选；未传入时回退全量（既有行为）
    // <en/> Scope data first — invisible rows between anchor and click are never picked up after filtering/pagination; falls back to full data when absent (existing behavior)
    const scopeData = shiftScopeData !== undefined ? toValue(shiftScopeData) : undefined
    const rangeData = scopeData ?? allDataValue

    const result = calculateShiftSelect<T>({
      selectedKeys: selectedKeys.value,
      anchorKey,
      clickedKey: key,
      clickedRow: row,
      shouldSelect,
      allData: rangeData,
      rowKey: currentRowKey,
      selectableFn: toValue(selectableFn),
      keyToIndexMap: scopeData ? undefined : currentKeyToIndexMap,
    })

    if (result.newKeys) {
      selectedKeys.value = result.newKeys
      emitSelectionChange('select', row)
      return
    }

    if (result.isFallback) {
      // 无锚点或锚点失效时退化为普通单行切换 | No anchor or invalid anchor: degrade to simple single-row toggle
      if (!isRowSelectable(row, key, shouldSelect, ignoreSelectable))
        return
      const newSet = new Set(selectedKeys.value)
      shouldSelect ? newSet.add(key) : newSet.delete(key)
      selectedKeys.value = newSet
      /**
       * <zh/> 锚点失效时（如排序/翻页后原锚点行不在当前数据中），将当前点击行设为新锚点，
       * <zh/> 确保后续 Shift 点击能基于有效锚点计算范围
       * <en/> When anchor is invalid (e.g., anchor row not in current data after sort/pagination),
       * <en/> set the clicked row as the new anchor so subsequent Shift clicks can compute range based on a valid anchor
       */
      if (result.isAnchorInvalid || anchorKey === null)
        lastClickedKey.value = key
      emitSelectionChange('select', row)
    }
  }

  /**
   * 默认 toggle 策略——简单切换行选中状态。
   * Default toggle strategy — simple row selection toggle.
   * @param row - <zh/> 目标行 | <en/> target row
   * @param key - <zh/> 行的唯一标识 | <en/> row's unique key
   * @param shouldSelect - <zh/> 是否意图选中 | <en/> whether the intent is to select
   * @param wasSelected - <zh/> 当前是否已选中 | <en/> whether it is currently selected
   */
  function handleDefaultToggle(row: T, key: string, shouldSelect: boolean, wasSelected: boolean): void {
    if (shouldSelect === wasSelected) {
      return
    }
    const newSet = new Set(selectedKeys.value)
    shouldSelect ? newSet.add(key) : newSet.delete(key)
    selectedKeys.value = newSet
    lastClickedKey.value = key
    emitSelectionChange('select', row)
  }

  /**
   * 树形联动策略——选中/取消行时级联处理子孙和祖先节点。
   * Tree cascade strategy — cascade selection to descendants and ancestors.
   *
   * <zh/> 前置条件：调用方须先经 `isTreeCascadeEnabled()` 确认树形级联开启，
   * <zh/> 故此处 `treeApi` 非空。
   * <en/> Precondition: callers must confirm tree cascade is on via `isTreeCascadeEnabled()`,
   * <en/> so `treeApi` is non-null here (keeps the original non-null assertion and throw surface).
   * @param row - <zh/> 目标行 | <en/> target row
   * @param key - <zh/> 行的唯一标识 | <en/> row's unique key
   * @param shouldSelect - <zh/> 是否意图选中 | <en/> whether the intent is to select
   * @param [ignoreSelectable] - <zh/> 是否跳过 selectable 检查 | <en/> whether to skip the selectable check
   */
  function handleTreeToggle(row: T, key: string, shouldSelect: boolean, ignoreSelectable?: boolean): void {
    // <zh/> 防御性收窄：门面已先查 isTreeCascadeEnabled，但类型上仍可空——直接断言会把调用方时序 bug
    // <zh/> 变成 TypeError，改为 dev 告警 + 拒绝，契约见前置条件注释。
    // <en/> Defensive narrowing: the facade checks isTreeCascadeEnabled first, but the type stays nullable —
    // <en/> an assertion would turn a caller ordering bug into a TypeError; dev-warn and refuse instead.
    const api = toValue(treeApi)
    if (!api) {
      if (isDev)
        devWarn('[AdvTable] handleTreeToggle called without treeApi; caller must check isTreeCascadeEnabled() first.')
      return
    }
    const currentRowKey = toValue(rowKey)
    const currentRowMap = toValue(rowMap)
    const newSet = new Set(selectedKeys.value)

    if (shouldSelect) {
      if (isRowSelectable(row, key, true, ignoreSelectable)) {
        newSet.add(key)
      }
      const descendantKeys = api.getDescendantKeys(key)
      for (const dk of descendantKeys) {
        const dkStr = String(dk)
        const childRow = currentRowMap.get(dkStr)
        if (childRow) {
          // <zh/> 子孙同样走 selectable 校验——与全选谓词对齐，禁选行不被级联选中
          // <en/> Descendants honor selectable too — aligned with the select-all predicate so disabled rows stay unselected
          if (isRowSelectable(childRow, dkStr, true)) {
            newSet.add(currentRowKey(childRow))
          }
        }
        else {
          newSet.add(dkStr)
        }
      }
      const ancestorKeys = api.getAncestorKeys(key)
      // 与级联写入同口径——只统计可选后代，不可选后代不阻止父节点满选
      const isDescendantSelectable = createDescendantSelectablePredicate<T>({ rowMap, eligibility })
      for (const ak of ancestorKeys) {
        if (isAllDescendantsSelected(ak, newSet, api, isDescendantSelectable)) {
          const ancestorRow = currentRowMap.get(ak)
          if (ancestorRow) {
            // <zh/> 祖先同样走 selectable 校验——与全选谓词对齐 | <en/> Ancestors honor selectable too — aligned with select-all
            if (isRowSelectable(ancestorRow, ak, true)) {
              newSet.add(currentRowKey(ancestorRow))
            }
          }
          else {
            newSet.add(ak)
          }
        }
      }
    }
    else {
      removeKeyAndTreeRelatives(newSet, key, api)
    }

    selectedKeys.value = newSet
    lastClickedKey.value = key
    emitSelectionChange('select', row)
  }

  return {
    handleSingleSelect,
    handleCtrlSelect,
    handleShiftSelect,
    handleDefaultToggle,
    handleTreeToggle,
  }
}

/**
 * <zh/> 全选时按 selectableFn 过滤子孙——与 handleTreeToggle 的子孙检查一致，
 * <zh/> 避免不可选行的子孙被"全选"静默选中。
 * <en/> Filter descendants by selectableFn during select-all — consistent with the per-descendant
 * <en/> check in handleTreeToggle, so descendants of non-selectable rows are never silently selected.
 *
 * @remarks
 * <zh/> 与策略域同文件：它是策略域「子孙可选性」判定的唯一实现，供批量域的 selectAll 复用，
 * <zh/> 避免该规则在两个文件中各写一份而漂移。
 * <en/> Same file as the strategies: it is the single implementation of the "descendant selectability"
 * <en/> rule, reused by selectAll in the batch domain so the rule never drifts across two files.
 */
export function createDescendantSelectablePredicate<T = any>(
  deps: Pick<SelectionStrategiesDeps<T>, 'rowMap'> & { eligibility: SelectionEligibility<T> },
): (dk: string | number) => boolean {
  const { rowMap, eligibility } = deps
  return (dk: string | number) => {
    const childRow = toValue(rowMap).get(String(dk))
    if (childRow)
      return eligibility.isRowSelectable(childRow, String(dk), true)
    return true
  }
}
