/**
 * @file queries.ts
 * @description
 * <zh/> 对等矩阵定位与交互助手——全部锚点基于共享管线保证的双模式一致属性：
 * <zh/> - 表头：[data-adv-table-column-key="…"]（default=拖拽标记 / virtual=v2 header span）
 * <zh/> - 单元格：[data-adv-cell-row][data-adv-cell-col]（createCellSpan 统一写入）
 * <zh/> - 行：[data-adv-table-row-key]
 *
 * <en/> Parity locators & interaction helpers — every anchor relies on dual-mode-consistent
 * <en/> attributes guaranteed by the shared pipeline (see anchors above).
 */
import type { DOMWrapper, VueWrapper } from '@vue/test-utils'

type W = VueWrapper | VW<any>
export type CellEl = DOMWrapper<Element>

/** <zh/> 按列 key 定位表头单元格（含拖拽标记/v2 span 外层） | <en/> Locate header cell by column key */
export function findHeader(wrapper: W, colKey: string): CellEl {
  return wrapper.find(`[data-adv-table-column-key="${colKey}"]`)
}

/**
 * <zh/> 定位数据单元格。row/col 为**普通列坐标域**（不含 selection 列），
 * <zh/> 与 createCellSpan 写入的 data-adv-cell-row/col 一致。
 * <en/> Locate a data cell. row/col are in the normal-column coordinate domain
 * <en/> (selection column excluded), matching data-adv-cell-row/col written by createCellSpan.
 */
export function findCell(wrapper: W, row: number, col: number): CellEl {
  return wrapper.find(`[data-adv-cell-row="${row}"][data-adv-cell-col="${col}"]`)
}

/** <zh/> 收集某列全部可见文本（按行序）——渲染对等的文本快照 | <en/> Collect visible texts of a column in row order */
export function columnTexts(wrapper: W, col: number): string[] {
  return wrapper
    .findAll(`[data-adv-cell-col="${col}"]`)
    .map(c => c.text())
}

/** <zh/> 点击某列表头的升序排序指示器（两模式同锚点） | <en/> Click the ascending sort indicator of a header (same anchor both modes) */
export async function clickSortAsc(wrapper: W, colKey: string): Promise<void> {
  const header = findHeader(wrapper, colKey)
  const asc = header.find('.adv-table__sort-icon--asc')
  expect(asc.exists()).toBe(true)
  await asc.trigger('click')
}

/** <zh/> 点击全选复选框（表头区域首个 ElCheckbox，两模式同构） | <en/> Click the select-all checkbox (first ElCheckbox in header area) */
export async function clickSelectAll(wrapper: W): Promise<void> {
  const checkboxes = wrapper.findAll('.el-checkbox')
  expect(checkboxes.length).toBeGreaterThan(0)
  const input = checkboxes[0].find('input')
  if (input.exists()) {
    await input.setValue(true)
  }
  else {
    await checkboxes[0].trigger('click')
  }
}

/** <zh/> 行级复选框是否选中（跳过表头全选框） | <en/> Whether row checkbox is checked (skipping the select-all one) */
export function rowCheckboxChecked(wrapper: W, rowIndex: number): boolean {
  const inputs = wrapper.findAll('.el-checkbox input')
  // index 0 = 全选；其后为逐行（顺序与渲染一致）
  const target = inputs[rowIndex + 1]
  return !!target?.element?.checked
}
