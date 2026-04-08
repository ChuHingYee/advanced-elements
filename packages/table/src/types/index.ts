/**
 * <zh/> 类型出口白名单（出口收敛评审）
 *
 * <zh/> 经 评审的 export * 清单（来源模块 → 评审结论）：
 * <zh/> - cell-locator     → 公共类型（CellCoord/CellRect 等单元格几何类型）
 * <zh/> - clipboard-api    → 公共类型（剪贴板编辑/选择/管线 API）
 * <zh/> - column           → 公共类型（AdvColumn/ColumnFilterConfig 等列配置类型）
 * <zh/> - column-state     → 公共类型（ColumnState/AdvTableStorageAdapter 持久化类型）
 * <zh/> - config           → 公共类型（AdvTableConfig/FilterConfig 等表格配置类型）
 * <zh/> - context-menu     → 公共类型（菜单配置/项类型）
 * <zh/> - drag-locator     → 公共类型（拖拽定位类型）
 * <zh/> - edit             → 公共类型（单元格编辑参数/类型）
 * <zh/> - error            → 公共类型（错误处理类型）
 * <zh/> - events           → 公共类型（事件载荷派生类型）
 * <zh/> - filter           → 公共类型（列筛选值类型，自 hook 下沉）
 * <zh/> - interceptor      → 公共类型（拦截器 API）
 * <zh/> - renderer         → 公共类型（渲染器 props 类型）
 * <zh/> - renderer-caps     → 公共类型（渲染器能力表 RendererCaps，能力查询替代模式判断）
 * <zh/> - request          → 公共类型（请求类型）
 * <zh/> - response         → 公共类型（响应类型）
 * <zh/> - row-rect         → 公共类型（行矩形定位类型）
 * <zh/> - scope            → 公共类型（数据/列范围模式 DataMode/ColumnMode，导出·打印·拦截共用）
 * <zh/> - slots            → 公共类型（插槽类型）
 * <zh/> - sort             → 公共类型（排序状态类型，自 hook 下沉）
 * <zh/> - table-emits      → 公共类型（AdvTableEmitsMap 事件表）
 * <zh/> - table-props      → 公共类型（AdvTableProps 等，命名导出）
 * <zh/> - translator       → 公共类型（国际化翻译类型）
 * <zh/> - version          → 公共类型（版本类型）
 *
 * <zh/> 已移除的通配导出（内部模块，不进入包根）：
 * <zh/> - orchestrator-context → 内部编排器上下文（RowContext/ColumnContext/RendererContext/CrossCuttingContext）
 * <zh/> - renderer-emits       → 内部渲染器事件表（RendererEmitsMap/VirtualRendererEmitsMap）
 * <zh/> - renderer-interface   → 内部架构接口（ITableRenderer 双引擎契约，显式化但不进包根）
 *
 * <en/> Type export whitelist (export convergence review)
 * <en/> Reviewed export * list (source module → conclusion): see above.
 * <en/> Removed wildcard exports (internal modules, not exposed at package root):
 * <en/> - orchestrator-context → internal orchestrator contexts
 * <en/> - renderer-emits       → internal renderer event maps
 */
export * from './cell-locator'
export * from './clipboard-api'
export * from './column'
export * from './column-state'
export * from './config'
export * from './context-menu'
export * from './drag-locator'
export * from './edit'
export * from './error'
export * from './events'
export * from './filter'
export * from './interceptor'
export * from './renderer'
export * from './renderer-caps'
export * from './request'
export * from './response'
export * from './row-rect'
export * from './scope'
export * from './slots'
export * from './sort'
export * from './table-emits'
export type { AdvTableProps } from './table-props'
export * from './translator'
export * from './version'
