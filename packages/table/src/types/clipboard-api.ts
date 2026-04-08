/**
 * <zh/> 剪贴板 API 领域接口（Clipboard domain interfaces）
 *
 * <zh/> 从 use-table-renderer-events.ts 提取的独立类型定义，
 * <zh/> 使 useClipboardHandler 不再类型依赖 useTableRendererEvents。
 *
 * <zh/> RendererEventsSelectionApi / RendererEventsEditApi / RendererEventsDataPipelineApi
 * <zh/> 是这些接口的超集，通过结构化类型系统自动兼容。
 *
 * <en/> Clipboard API domain interfaces
 *
 * <en/> Extracted from use-table-renderer-events.ts as independent type definitions,
 * <en/> so useClipboardHandler no longer has a type dependency on useTableRendererEvents.
 *
 * <en/> RendererEventsSelectionApi / RendererEventsEditApi / RendererEventsDataPipelineApi
 * <en/> are supersets of these interfaces, automatically compatible via structural typing.
 */
import type { ProcessedColumn } from './column'
import type { CellEditStopReason } from './edit'

/**
 * <zh/> 剪贴板所需的选择域接口
 * <zh/> RendererEventsSelectionApi 是此接口的超集
 * <en/> Selection domain interface required by clipboard
 * <en/> RendererEventsSelectionApi is a superset of this interface
 */
export interface ClipboardSelectionApi<T> {
  selectionState: { getSelectedRows?: () => T[] }
  hasSelection: () => boolean
  suppressRowClickSelection: () => boolean
  rowClickSelect: () => boolean
}

/**
 * <zh/> 剪贴板所需的编辑域接口
 * <zh/> RendererEventsEditApi 是此接口的超集
 * <en/> Edit domain interface required by clipboard
 * <en/> RendererEventsEditApi is a superset of this interface
 */
export interface ClipboardEditApi {
  editConfig: () => { enableClipboard?: boolean, enableCellEditingOnF2?: boolean, enableCellEditingOnBackspace?: boolean, singleClickEdit?: boolean } | undefined
  isColumnEditable: (col: ProcessedColumn) => boolean
  startEditing: (params: { rowIndex: number, prop: string, columnKey: string, value: any }) => void
  updateCellEditingValue: (columnKey: string, val: unknown) => void
  commitEditing: (reason?: CellEditStopReason) => Promise<import('./edit').CommitResult>
  batchCommitCells: (cells: Array<{ rowIndex: number, prop: string, columnKey: string, value: any }>, reason?: CellEditStopReason) => Promise<import('./edit').CommitResult>
}

/**
 * <zh/> 剪贴板所需的数据管线接口
 * <zh/> RendererEventsDataPipelineApi 是此接口的超集
 * <en/> Data pipeline interface required by clipboard
 * <en/> RendererEventsDataPipelineApi is a superset of this interface
 */
export interface ClipboardPipelineApi<T> {
  effectiveColumns: () => ProcessedColumn[]
  columnByKey: () => Map<string, ProcessedColumn>
  visibleData: () => T[]
  rowKeyFn: () => (row: T) => string
}
