export { createElTableCellLocator, createTableV2CellLocator } from './cell-locator'
export { createDefaultDomAdapter } from './default-dom-adapter'
export type { BodyScrollbarSpec, IRendererDomAdapter } from './dom-adapter'
/**
 * <zh/> renderer-core 公共抽象层——统一 ElTable 与 ElTableV2 两种渲染模式的共享代码
 *
 * <zh/> 包含：
 * <zh/> - DOM 适配器（EP 内部类名/结构的唯一出口）与由其创建的单元格式/拖拽定位器
 * <zh/> - 共享渲染辅助函数
 * <zh/> - 统一事件绑定
 *
 * <en/> renderer-core public abstraction layer — unifies shared code between ElTable and ElTableV2 rendering modes
 *
 * <en/> Contains:
 * <en/> - DOM adapter (the only outlet for EP internals) plus the cell/drag locators it creates
 * <en/> - Shared rendering helpers
 * <en/> - Unified event bindings
 */
export { EL_TABLE_DISABLED_TREE_PROPS, EL_TABLE_TREE_DISABLED_KEY } from './el-table-tree-isolation'
export { withHeaderDragEndHandler } from './event-bindings'
export type { EventBindingOptions } from './event-bindings'
export {
  COLLAPSED_ARROW_PATH,
  EP_ARROW_PATH,
  EXPANDED_ARROW_PATH,
  extractColumnRenderProps,
  hasCustomRender,
  injectRendererContext,
  NO_TOOLTIP_VALUE_TYPES,
  renderColumnSlot,
  renderHeaderCell,
  renderHeaderDragMarker,
  renderHeaderSlot,
  renderRowDragMarker,
  renderSortIndicator,
  useRendererLocale,
} from './render-helpers'
export { createVirtualDomAdapter } from './virtual-dom-adapter'
