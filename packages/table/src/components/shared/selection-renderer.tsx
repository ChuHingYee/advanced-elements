/**
 * @component SelectionRenderer
 * @displayName 选择渲染器
 * @displayName Selection Renderer
 * @description <zh/> 选择列单元格/表头内容渲染（checkbox/radio + 全选态） | <en/> Selection column cell/header content rendering (checkbox/radio plus select-all state)
 * @category 数据展示 | Data Display
 */
import type { CheckStatus, UseSelectionStateReturn } from '../../composables/selection/use-selection-state'
import type { TreeApi } from '../../types/config'
import { ElCheckbox, ElRadio } from 'element-plus'
import { getSelectAllCheckboxProps } from '../../utils/selection-helpers'
import { isRowSelectable } from '../../utils/shared'
import { isSyntheticRow } from '../../utils/synthetic-row'

export interface SelectionCellRenderOptions<T = any> {
  row: T
  rowIndex: number
  selectionState: UseSelectionStateReturn<T> | undefined
  selectionMode: 'single' | 'multiple'
  rowKey: (row: T) => string
  selectableFn?: (row: T, index: number) => boolean
  treeApi?: TreeApi | undefined
  /**
   * <zh/> 后代可选性判定：由调用方按行映射 + selectable 构造；传入后渲染态只统计可选后代，
   * <zh/> 与级联写入（handleTreeToggle / selectAll）同口径。缺省时保持既有行为。
   * <en/> Descendant selectability: mapped per row by the caller together with selectable; the render state
   * <en/> only counts selectable descendants, same caliber as cascade writes (handleTreeToggle / selectAll).
   * <en/> Existing behavior is kept when omitted.
   */
  isDescendantSelectable?: (key: string | number) => boolean
  /** <zh/> 行键元信息（调用方注入 advTableKey 即得，供默认后代判定解析行对象） | <en/> Row-key meta for the default descendant resolution */
  rowKeyMeta?: { keyToRow: Map<string, any>, keyToIndex: Map<string, number> } | undefined
}

/**
 * <zh/> 行级修饰键捕获——每个单元格独立持有，避免多实例/Teleport/并发测试下模块单例串台。
 * <zh/> click 先于 change 同步触发，同一单元格的两次事件共享该闭包对象；不同单元格互不干扰。
 * <en/> Per-cell modifier-key capture — each cell owns its instance, avoiding cross-instance
 * <en/> races from a module singleton under multi-table/Teleport/concurrent tests.
 * <en/> Click fires synchronously before change; both events of the same cell share this closure.
 */
function createModCapture(): {
  onClick: (e: MouseEvent) => void
  consume: () => { ctrlKey: boolean, shiftKey: boolean }
} {
  const captured = { ctrlKey: false, shiftKey: false }
  return {
    onClick(e: MouseEvent): void {
      captured.ctrlKey = e.ctrlKey || e.metaKey
      captured.shiftKey = e.shiftKey
    },
    consume(): { ctrlKey: boolean, shiftKey: boolean } {
      const mod = { ctrlKey: captured.ctrlKey, shiftKey: captured.shiftKey }
      captured.ctrlKey = false
      captured.shiftKey = false
      return mod
    },
  }
}

function getTreeCheckState<T>(
  row: T,
  selectionState: UseSelectionStateReturn<T> | undefined,
  treeApi: TreeApi | undefined,
  rowKey: (row: T) => string,
  // 只统计可选后代；未传入时保持既有行为
  isDescendantSelectable?: (key: string | number) => boolean,
): boolean | 'indeterminate' {
  const isSelected = selectionState?.isSelected(row) ?? false
  if (!treeApi || treeApi.checkStrictly.value || !treeApi.treeEnabled.value) {
    return isSelected
  }
  if (isSelected)
    return true
  const key = rowKey(row)
  const descendantKeys = treeApi.getDescendantKeys(key)
  if (descendantKeys.size === 0)
    return false
  let hasSelected = false
  let hasUnselected = false
  let hasSelectable = false
  for (const dk of descendantKeys) {
    // 不可选后代不计入（与级联写入同口径）
    if (isDescendantSelectable && !isDescendantSelectable(dk))
      continue
    hasSelectable = true
    if (selectionState?.isSelectedByKey(String(dk))) {
      hasSelected = true
    }
    else {
      hasUnselected = true
    }
    if (hasSelected && hasUnselected)
      return 'indeterminate'
  }
  if (!hasSelectable)
    return false
  return hasSelected && !hasUnselected
}

/**
 * <zh/> 渲染 selection 单元格内容（单选渲染 Radio，多选渲染 Checkbox）
 * <en/> Render selection cell content (Radio for single, Checkbox for multiple)
 */
export function renderSelectionCellContent<T = any>(options: SelectionCellRenderOptions<T>) {
  const { row, rowIndex, selectionState, selectionMode, rowKey, selectableFn, treeApi, isDescendantSelectable, rowKeyMeta } = options
  // synthetic 行（detail/group/total）不渲染选择框，且不得调用业务 rowKey（严格 rowKey 会抛错）
  if (isSyntheticRow(row))
    return <span />
  const disabled = !isRowSelectable(row, rowIndex, selectableFn as ((row: unknown, index: number) => boolean) | undefined)
  const rowKeyValue = rowKey(row)

  if (selectionMode === 'single') {
    const modCapture = createModCapture()
    return (
      <span onClick={modCapture.onClick}>
        <ElRadio
          modelValue={selectionState?.isSelected(row) ? rowKeyValue : undefined}
          value={rowKeyValue}
          disabled={disabled}
          onChange={(val: any) => {
            const mod = modCapture.consume()
            // <zh/> ElRadio onChange 传回的是 value（行 key 字符串），需转布尔作为选中状态
            // <en/> ElRadio onChange passes back the value (row key string); convert to boolean as the selected state
            selectionState?.toggleRowSelection(row, Boolean(val), false, mod)
          }}
        />
      </span>
    )
  }

  // 调用方显式传入优先；否则按行映射 + selectableFn 就地构造（缺行映射时回退既有行为）
  const resolvedDescendantSelectable = isDescendantSelectable ?? (rowKeyMeta && selectableFn
    ? (dk: string | number) => {
        const descendantRow = rowKeyMeta.keyToRow.get(String(dk))
        if (!descendantRow)
          return true
        return selectableFn(descendantRow, rowKeyMeta.keyToIndex.get(String(dk)) ?? -1)
      }
    : undefined)
  const checkState = getTreeCheckState(row, selectionState, treeApi, rowKey, resolvedDescendantSelectable)
  const isIndeterminate = checkState === 'indeterminate'
  const isChecked = checkState === true
  const modCapture = createModCapture()

  return (
    <span onClick={modCapture.onClick}>
      <ElCheckbox
        modelValue={isChecked}
        indeterminate={isIndeterminate}
        disabled={disabled}
        onChange={(val: any) => {
          const mod = modCapture.consume()
          selectionState?.toggleRowSelection(row, val, false, mod)
        }}
      />
    </span>
  )
}

export interface SelectionHeaderRenderOptions {
  selectionMode: 'single' | 'multiple'
  checkStatus: CheckStatus
  visibleCount: number
  /** <zh/> 编排层全选切换（必填，与 checkStatus 同源，正确处理虚拟模式的全量筛选数据源） | <en/> Orchestrator-level select-all toggle (required, same source as checkStatus, handles virtual-mode full filtered dataset) */
  toggleAllSelection: () => void
}

/**
 * <zh/> 渲染 selection 表头内容（全选 checkbox；单选模式为空）
 * <en/> Render selection header content (select-all checkbox; empty for single mode)
 */
export function renderSelectionHeaderContent(options: SelectionHeaderRenderOptions) {
  const { selectionMode, checkStatus, visibleCount, toggleAllSelection } = options

  if (selectionMode === 'single') {
    return null
  }

  const selectAllProps = getSelectAllCheckboxProps({
    checkStatus,
    toggleAllSelection,
    visibleDataLength: visibleCount,
  })
  return <ElCheckbox {...selectAllProps} />
}
