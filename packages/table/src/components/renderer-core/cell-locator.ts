import type { ComputedRef } from 'vue'
import type { CellLocator } from '../../types/cell-locator'
import { ADV_TABLE_ROW_KEY_ATTR } from '../../constants'
import { readRowKeyAttr } from '../../utils/row-key-attr'

/**
 * @file cell-locator.ts
 * @description
 * <zh/> 单元格定位器——由 DOM 反查单元格的行列索引。
 *
 * <zh/> **本文件不含任何 Element Plus 类名**：default 实现只依赖原生表格结构标签
 * <zh/> （`tr` / `tbody` / `table`）与 `cellIndex`，virtual 实现只依赖本库自有的
 * <zh/> `data-adv-*` 属性。所有 EP 类名与结构路径集中在 DOM 适配器
 * <zh/> （`default-dom-adapter.ts` / `virtual-dom-adapter.ts`），二者经
 * <zh/> {@link import('./dom-adapter').IRendererDomAdapter.createCellLocator} 供给本模块。
 *
 * <en/> Cell locator — resolves a cell's row/column index from the DOM.
 *
 * <en/> **No Element Plus class names here**: the default implementation relies only on native table
 * <en/> structure tags (`tr` / `tbody` / `table`) and `cellIndex`; the virtual implementation relies
 * <en/> only on this library's own `data-adv-*` attributes. All EP class names and structural paths
 * <en/> live in the DOM adapters (`default-dom-adapter.ts` / `virtual-dom-adapter.ts`), which supply
 * <en/> this module through {@link import('./dom-adapter').IRendererDomAdapter.createCellLocator}.
 */

/**
 * <zh/> 创建 ElTable 单元格定位器，基于原生表格结构解析行列索引
 * <en/> Create ElTable cell locator, resolves row/column indices based on native table structure
 */
export function createElTableCellLocator(): CellLocator {
  return {
    getRowIndex(cell: HTMLElement): number | null {
      const tr = cell.closest('tr')
      if (!tr)
        return null
      const tbody = tr.closest('tbody')
      if (tbody)
        return Array.from(tbody.children).indexOf(tr)
      const table = tr.closest('table')
      if (table)
        return Array.from(table.children).indexOf(tr)
      return null
    },
    getColumnIndex(cell: HTMLElement): number | null {
      if (cell.tagName === 'TD')
        return (cell as HTMLTableCellElement).cellIndex
      return null
    },
  }
}

/**
 * <zh/> 创建 ElTableV2 单元格定位器，基于 data-adv-table-row-key 属性解析行列索引
 *
 * <zh/> 行索引域说明：keyToIndex 必须基于渲染数据（props.data / virtualData）构建，
 * <zh/> 而非 rowKeyMeta.keyToIndex（全量 tableData 域）。
 * <zh/> 在客户端分页 / 树形折叠场景下，全量索引与渲染数据索引产生分叉，
 * <zh/> 导致 cellFocused/cellKeyDown 等事件的 rowIndex 与 default 模式不一致。
 *
 * <en/> Create ElTableV2 cell locator, resolves row/column indices based on data-adv-table-row-key attribute
 *
 * <en/> Row index domain: keyToIndex must be built from render data (props.data / virtualData),
 * <en/> NOT from rowKeyMeta.keyToIndex (full tableData domain).
 * <en/> Under client pagination / collapsed trees, the full-data index diverges from the render-data index,
 * <en/> causing cellFocused/cellKeyDown event rowIndex to be inconsistent with the default mode.
 *
 * @param keyToIndex - <zh/> 渲染数据域行键 → 行索引映射 | <en/> render-data-domain rowKey → rowIndex map
 */
export function createTableV2CellLocator(
  keyToIndex: ComputedRef<Map<string, number>> | undefined,
): CellLocator {
  return {
    getRowIndex(cell: HTMLElement): number | null {
      // <zh/> 选择器与取值均走常量，不再内联字面量
      // <en/> Both the selector and the read go through the constant, no more inline literals
      const rowKeyEl = cell.closest(`[${ADV_TABLE_ROW_KEY_ATTR}]`)
      if (!rowKeyEl || !keyToIndex)
        return null
      const rowKey = readRowKeyAttr(rowKeyEl)
      if (rowKey) {
        const rowIndex = keyToIndex.value.get(rowKey)
        if (rowIndex !== undefined)
          return rowIndex
      }
      return null
    },
    getColumnIndex(cell: HTMLElement): number | null {
      const cellWithAttr = cell.closest<HTMLElement>('[data-adv-cell-col]')
      if (cellWithAttr) {
        const colAttr = cellWithAttr.getAttribute('data-adv-cell-col')
        if (colAttr != null)
          return Number(colAttr)
      }
      return null
    },
  }
}
