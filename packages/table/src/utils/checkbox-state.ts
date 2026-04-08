/**
 * <zh/> 选择状态辅助函数，含勾选框状态计算。
 * <en/> Selection-state helpers, including checkbox status computation.
 *
 * <zh/> 提供从已选数量与总数推导全选/半选/未选状态的能力，供表格行选择（selection 列）的 checkbox 状态渲染使用。
 * <en/> Provides the ability to derive all-selected/indeterminate/none-selected state from the selected count and total, used to render the checkbox state of the table's selection column.
 */

/**
 * <zh/> 根据已选数量与总数，推导全选/半选/未选状态。
 * <en/> Derive all-selected/indeterminate/none-selected state from the selected count and total.
 *
 * <zh/> 当 total 为 0 时，返回全未选中状态（isAllSelected=false, isIndeterminate=false）。
 * <en/> When total is 0, returns the all-unselected state (isAllSelected=false, isIndeterminate=false).
 *
 * @param selectedCount - <zh/> 当前已选中的行数 | <en/> currently selected row count
 * @param total - <zh/> 可被选中的总行数 | <en/> total selectable row count
 * @returns <zh/> 包含 isAllSelected（是否全部选中）与 isIndeterminate（是否半选）的对象 | <en/> object with isAllSelected (all selected) and isIndeterminate (partially selected)
 *
 * @example
 * deriveCheckStatus(5, 10)
 * // => { isAllSelected: false, isIndeterminate: true }
 *
 * deriveCheckStatus(10, 10)
 * // => { isAllSelected: true, isIndeterminate: false }
 *
 * deriveCheckStatus(0, 10)
 * // => { isAllSelected: false, isIndeterminate: false }
 */
export function deriveCheckStatus(
  selectedCount: number,
  total: number,
): { isAllSelected: boolean, isIndeterminate: boolean } {
  if (total === 0)
    return { isAllSelected: false, isIndeterminate: false }
  return {
    isAllSelected: selectedCount === total,
    isIndeterminate: selectedCount > 0 && selectedCount < total,
  }
}
