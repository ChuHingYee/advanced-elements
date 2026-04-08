/**
 * <zh/> 渲染器事件签名表 — table-renderer.vue 与 table-virtual-renderer.vue 的共享 emit 类型
 *
 * <zh/> 本文件作为渲染器 emit 的单一真相源，两个渲染器的 defineEmits 均引用本类型。
 *
 * <en/> Renderer event signature map — shared emit type for table-renderer.vue and table-virtual-renderer.vue
 *
 * <en/> This file is the single source of truth for renderer emits; both renderers' defineEmits reference this type.
 */
import type { CellFocusedEventPayload, CellKeyboardEventPayload } from '../composables/rendering/use-cell-events'
import type { ProcessedColumn } from './column'
import type { TableErrorCode } from './error'
import type { CellInteractionPayload } from './table-emits'

/**
 * <zh/> 渲染器 emit 签名表 — 两个渲染器共用
 * <zh/> key 为事件名（camelCase），value 为该事件的参数签名
 *
 * <en/> Renderer emit signature map — shared by both renderers
 * <en/> key: event name (camelCase), value: event parameter signature
 */
export interface RendererEmitsMap<T = any> {
  /** <zh/> 当前行变更 | <en/> Current row change */
  (e: 'currentChange', params: { currentRow: T, oldRow: T | null }): void
  /** <zh/> 行点击 | <en/> Row click */
  (e: 'rowClick', params: { rowData: T, rowIndex: number, event: Event }): void
  /** <zh/> 行右键菜单 | <en/> Row context menu */
  (e: 'rowContextmenu', params: { rowData: T, rowIndex: number, event: Event }): void
  /** <zh/> 行双击 | <en/> Row double click */
  (e: 'rowDblclick', params: { rowData: T, rowIndex: number, event: Event }): void
  /** <zh/> 单元格点击 | <en/> Cell click */
  (e: 'cellClick', params: CellInteractionPayload<T>): void
  /** <zh/> 单元格双击 | <en/> Cell double click */
  (e: 'cellDblclick', params: CellInteractionPayload<T>): void
  /** <zh/> 单元格右键菜单 | <en/> Cell context menu */
  (e: 'cellContextmenu', params: CellInteractionPayload<T>): void
  /** <zh/> 单元格鼠标移入 | <en/> Cell mouse enter */
  (e: 'cellMouseEnter', params: { rowData: T, rowIndex: number, event?: Event }): void
  /** <zh/> 单元格鼠标移出 | <en/> Cell mouse leave */
  (e: 'cellMouseLeave'): void
  /** <zh/> 单元格获得焦点 | <en/> Cell focused */
  (e: 'cellFocused', params: CellFocusedEventPayload<T>): void
  /** <zh/> 单元格按键按下 | <en/> Cell key down */
  (e: 'cellKeyDown', params: CellKeyboardEventPayload<T>): void
  /** <zh/> 单元格按键（字符） | <en/> Cell key press */
  (e: 'cellKeyPress', params: CellKeyboardEventPayload<T>): void
  /** <zh/> 单元格按键释放 | <en/> Cell key up */
  (e: 'cellKeyUp', params: CellKeyboardEventPayload<T>): void
  /** <zh/> 表头点击 | <en/> Header click */
  (e: 'headerClick', params: { column: ProcessedColumn, columnIndex: number, event: Event }): void
  /** <zh/> 表头右键菜单 | <en/> Header context menu */
  (e: 'headerContextmenu', params: { column: ProcessedColumn, columnIndex: number, event: Event }): void
  /** <zh/> 表头列拖拽调整宽度结束 | <en/> Header column drag resize end */
  (e: 'headerDragend', params: { column?: ProcessedColumn, columnIndex: number, newWidth: number, oldWidth: number, event: MouseEvent | KeyboardEvent }): void
  /** <zh/> 滚动事件 | <en/> Scroll event */
  (e: 'scroll', params: { scrollLeft: number, scrollTop: number }): void
  /** <zh/> 切换列分组折叠状态 | <en/> Toggle column group collapse state */
  (e: 'toggleColumnGroupCollapse', columnKey: string): void
}

/**
 * <zh/> 虚拟渲染器独有事件 — 仅 virtual 模式触发
 * <en/> Virtual-renderer-only events — triggered only in virtual mode
 */
export interface VirtualRendererEmitsMap<T = any> extends RendererEmitsMap<T> {
  /** <zh/> 滚动到底部 | <en/> Scroll end reached */
  (e: 'endReached', remainDistance: number): void
  /** <zh/> 行渲染完成 | <en/> Rows rendered */
  (e: 'rowsRendered', params: { rowCacheStart: number, rowCacheEnd: number, rowVisibleStart: number, rowVisibleEnd: number }): void
  /**
   * <zh/> 渲染器内部能力失效（EP 内部结构漂移）——汇入表格 `error` 通道，生产可观测。
   *
   * <zh/> 虚拟行高重测依赖探测 EP 未公开的 `resetAfterRowIndex`；EP 改名/改层级后探测失败，
   * <zh/> 该失效此前仅 dev 期告警，生产完全静默（使用者只见行高错乱、无法归因到 EP 升级）。
   * <zh/> 经本事件上报后，EP 漂移成为消费方可通过 `@error` / `errorStrategy` 编程感知的事件。
   * <zh/> `cause.reason` 区分固定行高网格/实例缺失（正常）与无原生入口（**真正的 EP 漂移**）。
   *
   * <en/> Renderer internal capability failure (EP internal-structure drift) — funnelled into the
   * <en/> table's `error` channel so it is production-observable. Virtual row-height remeasure probes
   * <en/> EP's unpublished `resetAfterRowIndex`; when EP renames it the probe fails, and that failure
   * <en/> was previously dev-only, so production was silent (users saw wrong row heights with no way to
   * <en/> attribute them to an EP upgrade). Reporting it here makes EP drift programmatically
   * <en/> perceivable via `@error` / `errorStrategy`. `cause.reason` separates the benign
   * <en/> fixed-grid/missing-instance cases from **genuine EP drift**.
   */
  (e: 'rendererError', code: TableErrorCode, cause?: Record<string, unknown>): void
}
