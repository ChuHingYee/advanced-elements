import type { AdvConfig, AdvTableConfig, SFCWithInstall } from '@advanced-elements/config-provider'
import type { App, Component, Plugin } from 'vue'
import AdvConfigProvider, { advConfigKey, provideAdvConfig, useAdvConfig } from '@advanced-elements/config-provider'

import AdvTable from './AdvTable.vue'

export { advConfigKey, AdvConfigProvider, provideAdvConfig, useAdvConfig }
export type { AdvConfig, AdvTableConfig, SFCWithInstall }

export { default as AdvTable } from './AdvTable.vue'
export { createScopedEditorRegistry, registerAllBuiltInEditors, registerBuiltInEditor, registerCellEditor, resolveEditor, unregisterCellEditor } from './components/cell-editors'
export type { ScopedEditorRegistry } from './components/cell-editors'
export type { IRendererDomAdapter } from './components/renderer-core/dom-adapter'
/**
 * <zh/> `useTableApi` 返回值类型——14 个 API 组合并后的完整字段集合
 * <en/> Return type of `useTableApi` — full field set after merging 14 API groups
 */
export type { UseTableApiReturn } from './composables/api/use-table-api'
/**
 * <zh/> AdvTable 组件通过 `ref` 暴露的实例类型，供消费者标注 `ref<TableInstanceExpose<T>>` 使用
 * <zh/>（运行时顶层 Ref 已解包；`TableExpose` 仅为编写侧形状，见）
 * <en/> Instance type exposed by AdvTable via `ref`, for consumers to annotate `ref<TableInstanceExpose<T>>` usage
 */
export type { TableExpose, TableInstanceExpose } from './composables/api/use-table-api'
/** <zh/> 单选选中选项对象式（`toggleRowSelection` 规范形态入参） | <en/> Object-form single-row selection options (canonical `toggleRowSelection` input) */
export type { ToggleRowSelectionOptions } from './composables/api/use-table-api'
export { canSwitchMode, useModeSwitchBehavior } from './composables/core/use-mode-switch-behavior'
export type { ModeSwitchCleanup, ModeSwitchNotice } from './composables/core/use-mode-switch-behavior'
export type { ResolvedSizeConfig } from './composables/core/use-table-config'
/** <zh/> AG 风格增量数据事务（add/update/remove）的公开类型 | <en/> Public types for the AG-style incremental data transaction */
export type { ApplyTransactionResult, DataTransactionOps } from './composables/data/use-apply-data-transaction'
export type { UseRequestRetryOptions } from './composables/data/use-request'
/** 拦截器 composable — 在键盘 / 编辑 / 点击等事件触发前后介入，控制时机与行为 */
export { useInterceptor } from './composables/editing/use-interceptor'
export type { UseInterceptorOptions, UseInterceptorReturn } from './composables/editing/use-interceptor'
/**
 * <zh/> 自定义筛选类型注册表——`registerFilterType` 注册任意筛选策略，进入列筛选用链
 * <en/> Custom filter-type registry — `registerFilterType` registers arbitrary filter strategies into the column-filter chain
 */
export { clearFilterRegistry, createFilterRegistry, filterRegistryKey, getFilterStrategy, getRegisteredFilterTypes, registerFilterType, unregisterFilterType, useFilterRegistry } from './composables/features/filter-registry'
export type { FilterRegistry, FilterStrategy, RegisterFilterTypeOptions } from './composables/features/filter-registry'

export type { TableExportCsvOptions, TableExportOptions } from './composables/features/use-table-export'
/** <zh/> 单元格范围选择状态 | <en/> Cell range selection state */
export type { CellRangeSelection } from './composables/interaction/use-cell-range-selection'
export { registerDayjsLocaleMap } from './composables/locale/use-dayjs-locale'
/**
 * <zh/> 内置列 key 常量——选择列和操作列无需用户手动设置 key/prop，
 * <zh/> ensureColumnIds 会自动赋值；导出供用户在 API 调用中引用这些列 |
 * <en/> Built-in column key constants — selection and option columns don't require manual key/prop,
 * <en/> ensureColumnIds assigns them automatically; exported for users to reference these columns in API calls
 */
export { ADV_TABLE_OPTION_COLUMN_KEY, ADV_TABLE_SELECTION_COLUMN_KEY } from './constants'
export { advLocaleKey, en, useAdvLocale, zhCn } from './locale'
export type { AdvTableLocale } from './locale'
export * from './types'
export type { ExportCsvOptions, ExportOptions, ImportOptions, SizeConfig, TreeConfig, TreeRowMeta } from './types/config'
export type { DefaultRendererProps, RendererCommonProps, RendererProps, VirtualRendererProps } from './types/renderer'
export { isDefaultRendererProps, isVirtualRendererProps } from './types/renderer'
export type { SpanDynamicCoexistence } from './types/renderer-interface'
/**
 * <zh/> 行级剪贴板工具——业务侧自写复制按钮/右键菜单复用，与内置剪贴板同口径（Tab 分隔）
 * <en/> Row-level clipboard utilities — reuse in custom copy buttons/menus, same caliber as built-in clipboard (Tab-separated)
 */
export { copyCellToClipboard, copyRowsToClipboard, copyRowToClipboard } from './utils/context-menu-clipboard'
/**
 * <zh/> 公开签名引用的类型此前散落在内部模块（utils / composables），包根无法命名，
 * <zh/> 消费者只能写匿名结构或深入内部路径。此处按"公共契约"显式再导出：
 * <zh/> - `DebugConfig`（`debug` prop）、`SpanDynamicCoexistence`（`spanDynamicMode` prop）
 * <zh/> - `UseRequestRetryOptions`（`request.retries`）、`ScrollTarget`/`ScrollToRowOptions`（scrollToRow/Column）
 * <zh/> - `CellRangeSelection`（`cellRangeSelected` 事件）、`IRendererDomAdapter`（渲染器 props 的 `dom`）
 * <en/> types referenced by public signatures used to live in internal modules (utils /
 * <en/> composables) and were not nameable from the package root. Re-exported here as public contracts.
 */
export type { DebugConfig } from './utils/debug-logger'
/** <zh/> 将当前表格数据导出为 CSV 文件 | <en/> Export current table data to a CSV file */
export { exportCsv, exportCsvChunked, exportCsvSync } from './utils/export-csv'
export type { ExportCsvOptions as ExportCsvOptionsUtil, ExportCsvUtilOptions } from './utils/export-csv'
/** <zh/> 将当前表格数据导出为 Excel 文件 | <en/> Export current table data to an Excel file */
export { exportExcel } from './utils/export-excel'
export type { ExportExcelOptions } from './utils/export-excel'
/** <zh/> 导入解析 — CSV 文本或 Excel 二进制转为结构化行数据对象 | <en/> Import parsing — CSV text or Excel binary to structured row objects */
export { parseCsvText, parseExcelBuffer } from './utils/import-helpers'
export type { ParseResult } from './utils/import-helpers'
export { tf } from './utils/locale-fallback'
/** <zh/> 行键归一化 — string | number 统一为 string，未配置 rowKey 时回退 AUTO_KEY_NAME 兜底 | <en/> Row-key normalization — string | number unified to string, falls back to AUTO_KEY_NAME without rowKey */
export { AUTO_KEY_NAME, normalizeRowKey } from './utils/normalize-row-key'
export type { RowKeyFn, RowKeyInput } from './utils/normalize-row-key'
/**
 * <zh/> 通知通道抽象——允许消费方通过 globalConfig.notify 注入自定义通知实现
 * <en/> Notification channel abstraction — allows consumers to inject custom notification implementations via globalConfig.notify
 */
export type { NotifyFn, TableNotificationType } from './utils/notification'
/**
 * <zh/> rowPin 双域行索引换算——visibleData 域 ↔ renderData 域（`validateRow` 必须传入 renderData 域）
 * <en/> RowPin dual-domain index conversion — visibleData domain ↔ renderData domain (`validateRow` requires the renderData domain)
 */
export { toRenderDataIndex, toVisibleDataIndex } from './utils/row-pin-index'
/**
 * <zh/> 导出作用域口径（列 + 数据组合决议）——业务侧自写导出复用，与内置导出/打印同口径
 * <en/> Export scope caliber (combined column + data resolution) — reuse in custom business exports, same caliber as built-in export/print
 */
export { resolveColumnsByMode, resolveDataByMode, resolveExportScope } from './utils/scope-resolvers'
export type { ColumnMode, DataMode, ExportScope } from './utils/scope-resolvers'
/**
 * <zh/> 汇总聚合口径（AG Grid aggFunc 对齐）——单列归约、原始值读取、表尾格式化
 * <en/> Summary aggregation caliber (AG Grid aggFunc parity) — per-column reduce, raw value read, footer format
 */
export { buildDefaultSummaryRow, computeColumnAggregate, computeRawAggregates, formatAggregateValue, formatRawAggregatesToFooter, readColumnValues, runSummaryPass, shouldDeferSummary, SUMMARY_ASYNC_THRESHOLD } from './utils/summary-defaults'
export type { AggFuncLike, AggFuncName, DefaultSummaryColumnLike, SummaryWorkItem } from './utils/summary-defaults'
export type { ScrollTarget, ScrollToRowOptions } from './utils/table-drag'

/**
 * <zh/> 合计行工具（AG Grid aggregation-total-rows 对齐）——合成行判定、位置/标签/粘性决议
 * <en/> Total-row utilities (AG Grid aggregation-total-rows parity) — synthetic-row guards, position/label/sticky resolvers
 */
export {
  buildGrandTotalRow,
  buildGroupTotalRow,
  filterLeafDataRows,
  isGrandTotalRow,
  isGroupTotalRow,
  isSyntheticRow,
  resolveGrandTotalPosition,
  resolveGroupTotalPosition,
  resolveLabelProp,
  resolveTotalLabel,
  resolveTotalSticky,
} from './utils/total-rows'
export type { GrandTotalRow, GroupTotalRow } from './utils/total-rows'
/**
 * <zh/> 自定义 valueType 注册表——`registerValueType` 注册任意字符串类型，同时进入渲染与导出文本双链路
 * <en/> Custom valueType registry — `registerValueType` registers any string type into both render and export-text pipelines
 */
export { getCustomValueType, registerValueType, unregisterValueType } from './utils/value-type-registry'
export type { CustomValueTypeDefinition, CustomValueTypeTextContext } from './utils/value-type-registry'

const AdvTableWithInstall = AdvTable as typeof AdvTable & Plugin
  ; (AdvTableWithInstall as SFCWithInstall<typeof AdvTableWithInstall>).install = (
  app: App,
): void => {
  app.component(AdvTable.name ?? 'AdvTable', AdvTable as Component)
}

export default AdvTableWithInstall
