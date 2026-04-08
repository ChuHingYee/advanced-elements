import type { InternalExposeKey, TableExpose, UseTableApiReturn } from '../composables/api/use-table-api'

/**
 * <zh/> 实例 API 契约成员清单锚点（类型完备性守卫·编译期闸门）
 *
 * <zh/> 该清单是"类型世界"与"运行时世界"的唯一翻译点：
 * <zh/> ① `satisfies` 约束每项均为合法契约成员——契约删成员而清单未同步 → typecheck 报错；
 * <zh/> ② `_ContractExhaustive` 断言契约成员被清单全量覆盖——契约加成员而清单未同步 → typecheck 报错。
 * <zh/> 运行期双向集合比对消费方：`__tests__/guards/type-completeness.test.ts`。
 * <en/> Instance API contract key anchor (type-completeness guard, compile-time gate).
 *
 * <en/> This list is the single translation point between the type world and the runtime world:
 * <en/> ① `satisfies` constrains every entry to be a valid contract member — removing a contract
 * <en/> member without updating this list fails typecheck;
 * <en/> ② `_ContractExhaustive` asserts the contract is fully covered — adding a contract member
 * <en/> without updating this list fails typecheck.
 * <en/> Runtime bidirectional comparison consumer: `__tests__/guards/type-completeness.test.ts`.
 */
interface TypeGuardRow {
  id: string
  name: string
}

export const apiContractKeys = [
  // 数据与分页域
  'refresh',
  'loading',
  'setLoading',
  'setResponseData',
  'getPagination',
  'setCurrentPage',
  'setPageSize',
  'getFullData',
  'getCurrentPageData',
  'applyTransaction',
  'rollbackLast',
  'getRenderData',
  // 选择域
  'clearSelection',
  'toggleRowSelection',
  'toggleAllSelection',
  'invertSelection',
  'selectAll',
  'setCurrentRow',
  'refreshSelection',
  'setSelection',
  'getSelectedRows',
  'getCurrentRow',
  'initSelectionByKeys',
  'selectAllFiltered',
  'deselectAllFiltered',
  'selectAllOnCurrentPage',
  'deselectAllOnCurrentPage',
  'deselectAll',
  'selectRowByKey',
  'selectRowsByKeys',
  'isSelectedByKey',
  'getSelectedKeys',
  'getSelectedCount',
  'replaceSelection',
  'forEachSelected',
  'getSelectedIndices',
  // 搜索域
  'getQueryFormModel',
  'setQueryFormModel',
  'tableSearchRef',
  // 导入导出域
  'exportExcel',
  'exportCsv',
  'print',
  'triggerImport',
  'importing',
  // 筛选域
  'setFilter',
  'resetColumnFilter',
  'resetAllFilters',
  'getFilterValue',
  'isColumnFiltered',
  'hasActiveFilter',
  'hasActiveQuickFilter',
  'setQuickFilter',
  'getQuickFilter',
  // 排序域
  'toggleSort',
  'setSort',
  'setSorts',
  'clearSort',
  'getSortOrder',
  'getSortIndex',
  // 编辑域
  'startEditing',
  'stopEditing',
  'updateCellEditingValue',
  'getCellEditingValue',
  'commitBatchEdit',
  'cancelBatchEdit',
  'hasPendingChanges',
  'batchHasPending',
  'batchPendingChanges',
  'submitEdit',
  'discardEdit',
  'getRowKey',
  'validate',
  'validateRow',
  'clearValidate',
  'undo',
  'redo',
  'canUndo',
  'canRedo',
  'hasUnsavedChanges',
  // 右键菜单域
  'showContextMenu',
  'hideContextMenu',
  // 列状态域
  'getColumnState',
  'applyColumnState',
  'resetColumnState',
  // 命名视图域
  'saveView',
  'applyView',
  'getSavedViews',
  'deleteView',
  // 树形展开域（对象词根 TreeNode）
  'toggleTreeNodeExpand',
  'expandTreeNode',
  'collapseTreeNode',
  'expandAllTreeNodes',
  'collapseAllTreeNodes',
  'getTreeMeta',
  // 行展开域（对象词根 DetailRow）
  'toggleDetailRowExpand',
  'expandDetailRow',
  'collapseDetailRow',
  'expandAllDetailRows',
  'collapseAllDetailRows',
  // 行分组域
  'toggleGroupExpand',
  'expandAllGroups',
  'collapseAllGroups',
  // 行固定域
  'pinRow',
  'unpinRow',
  'isRowPinned',
  'clearPinnedRows',
  // 滚动域
  'scrollToRow',
  'scrollToColumn',
  // 动态行高重测域
  'resetAfterRowIndex',
  'refreshVirtualRowHeight',
] as const satisfies readonly (keyof UseTableApiReturn<TypeGuardRow>)[]

/**
 * <zh/> TableExpose 相对 UseTableApiReturn 的增量成员（version/tableRootRef） | <en/> TableExpose-only additions over UseTableApiReturn (version/tableRootRef)
 */
export const tableExposeOnlyKeys = ['version', 'tableRootRef'] as const

/**
 * <zh/> 仅域内使用、不进公开 expose 的内部成员（与 `InternalExposeKey` 同源，运行时剔除见 `AdvTable.vue`）
 * <en/> Internal-only members kept out of the public expose (same source as `InternalExposeKey`)
 */
export const internalExposeKeys = ['tableSearchRef', 'importing', 'batchPendingChanges'] as const satisfies readonly (keyof UseTableApiReturn<TypeGuardRow>)[]

/**
 * <zh/> 契约成员全量覆盖断言：契约中存在而清单未登记的成员必须为 never，否则编译失败 | <en/> Exhaustive coverage assertion: contract members absent from the list must resolve to never, otherwise compilation fails
 */
type AssertNever<T extends never = never> = T

type _ContractExhaustive = AssertNever<Exclude<keyof UseTableApiReturn<TypeGuardRow>, typeof apiContractKeys[number]>>

/**
 * <zh/> 公开 expose 全量覆盖断言：TableExpose = 契约清单 − 内部成员 + 增量成员，三处必须同构 | <en/> Public expose assertion: TableExpose must mirror the contract list minus internals plus additions
 */
type _PublicExposeExhaustive = AssertNever<Exclude<keyof TableExpose<TypeGuardRow>, Exclude<typeof apiContractKeys[number], InternalExposeKey> | typeof tableExposeOnlyKeys[number]>>
type _PublicExposeNoExtra = AssertNever<Exclude<Exclude<typeof apiContractKeys[number], InternalExposeKey> | typeof tableExposeOnlyKeys[number], keyof TableExpose<TypeGuardRow>>>
export type { _ContractExhaustive, _PublicExposeExhaustive, _PublicExposeNoExtra }
