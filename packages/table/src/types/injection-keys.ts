/**
 * <zh/> 所有 provide/inject InjectionKey 定义集中管理。
 * <en/> Centralized management of all provide/inject InjectionKey definitions.
 *
 * <zh/> 此文件仅包含 Symbol 运行时值声明，类型定义按域分布在 `config-api.ts`/`config-tree.ts`/`config-column-setting.ts`。
 * 通过 `types/config.ts` 桶文件统一导出。
 * <en/> This file contains only Symbol runtime value declarations; type definitions are split by domain in
 * `config-api.ts`/`config-tree.ts`/`config-column-setting.ts`.
 * Re-exported via the `types/config.ts` barrel file.
 *
 * <zh/> 隐式契约约定（20 键）：每个键即一条跨层隐式契约——
 * <zh/> 1. 提供点唯一（见 `use-renderer-integration` 装配注释），消费侧一律经 `useSafeInject`
 * <zh/>    拿缺省 devWarn，缺 provide 时静默降级（`polling-btn refresh` 除外：缺失抛错）；
 * <zh/> 2. 改名/删键编译器不报错，靠 `injection-contract.test.ts` 锁定，改动此文件必同步该测试；
 * <zh/> 3. 新增键前先回答：是否拥有 state + lifecycle（是才配一个键，纯转发不配）。
 * <en/> Implicit-contract convention (20 keys): each key is one cross-layer implicit contract —
 * <en/> 1. single provider site (see the `use-renderer-integration` assembly comment); consumers
 * <en/>    must go through `useSafeInject` for a missing-default devWarn and degrade silently
 * <en/>    without provide (except `polling-btn refresh`, which throws when missing);
 * <en/> 2. renames/removals are invisible to the compiler and locked only by
 * <en/>    `injection-contract.test.ts` — keep that test in sync when editing this file;
 * <en/> 3. before adding a key, answer: does it own state + lifecycle (only then a key; no key for pure forwarding).
 */
import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue'
// <zh/> 纯类型导入（编译期擦除）：选择态真源类型，不引入运行时依赖，types→composables 无运行时环
// <en/> Type-only import (erased at compile time): selection state source type, no runtime edge, no types→composables runtime cycle
import type { UseSelectionStateReturn } from '../composables/selection/selection-types'
import type { AdvTableLocale } from '../locale/types'
import type {
  FilterPanelApi,
  TableContext,
  TableEditApi,
  TableFilterSortOps,
  TableHoverLayerApi,
  TableRangeSelectionApi,
  TableSharedFilterPopoverApi,
  TableSharedHeaderTooltipApi,
} from './config-api'

import type {
  ColumnActions,
  ColumnSettingListContext,
} from './config-column-setting'
import type {
  ColumnGroupApi,
  RowExpandApi,
  RowGroupApi,
  RowPinApi,
  RowViewModelContext,
  TreeApi,
} from './config-tree'

import type { ValidateError } from './edit'

/** AdvTableLocale 的 provide/inject key */
export const advLocaleKey: InjectionKey<Ref<AdvTableLocale | undefined>>
  = Symbol('advLocale')

/**
 * <zh/> R2：上帝上下文已删除——以下为按域注入的唯一通道（全新版本一步到位，不保留转发层）。
 * <en/> R2: the god context is removed — the following per-domain injections are the only channel (clean break, no forwarding layer).
 */
export const advTableKey: InjectionKey<TableContext> = Symbol('advTable')

/** TableEditApi 的 provide/inject key */
export const advTableEditKey: InjectionKey<TableEditApi> = Symbol('advTableEdit')

/** TableSharedFilterPopoverApi 的 provide/inject key */
export const advTableSharedFilterPopoverKey: InjectionKey<TableSharedFilterPopoverApi> = Symbol('advTableSharedFilterPopover')

/** TableSharedHeaderTooltipApi 的 provide/inject key */
export const advTableSharedHeaderTooltipKey: InjectionKey<TableSharedHeaderTooltipApi> = Symbol('advTableSharedHeaderTooltip')

/** TableHoverLayerApi 的 provide/inject key */
export const advTableHoverLayerKey: InjectionKey<TableHoverLayerApi> = Symbol('advTableHoverLayer')

/** 校验错误列表的 provide/inject key */
export const advTableValidateErrorsKey: InjectionKey<Ref<ValidateError[]>> = Symbol('advTableValidateErrors')

/** RowViewModelContext 的 provide/inject key */
export const advTableRowViewModelKey: InjectionKey<RowViewModelContext> = Symbol('advTableRowViewModel')

/** ColumnActions 的 provide/inject key */
export const advTableColumnActionsKey: InjectionKey<ColumnActions> = Symbol('advTableColumnActions')
/** ColumnSettingListContext 的 provide/inject key */
export const advTableColumnSettingListKey: InjectionKey<ColumnSettingListContext> = Symbol('advTableColumnSettingList')
/** <zh/> R2 域键：列分组 | <en/> R2 domain key: column group */
export const advTableColumnGroupKey: InjectionKey<ColumnGroupApi> = Symbol('advTableColumnGroup')
/** <zh/> R2 域键：筛选排序 | <en/> R2 domain key: filter-sort */
export const advTableFilterSortKey: InjectionKey<TableFilterSortOps> = Symbol('advTableFilterSort')
/** <zh/> R2 域键：当前行（唯一真源 shallowRef） | <en/> R2 domain key: current row (single-source shallowRef) */
export const advTableCurrentRowKey: InjectionKey<ShallowRef<any | null>> = Symbol('advTableCurrentRow')
/** <zh/> R2 域键：行拖拽中 | <en/> R2 domain key: row dragging */
export const advTableIsRowDraggingKey: InjectionKey<ShallowRef<boolean>> = Symbol('advTableIsRowDragging')
/** <zh/> R2 域键：性能档位 | <en/> R2 domain key: performance profile */
export const advTablePerformanceProfileKey: InjectionKey<ComputedRef<'high' | 'low'>> = Symbol('advTablePerformanceProfile')
/** <zh/> R2 域键：树 | <en/> R2 domain key: tree */
export const advTableTreeKey: InjectionKey<TreeApi> = Symbol('advTableTree')
/** <zh/> R2 域键：行分组 | <en/> R2 domain key: row group */
export const advTableRowGroupKey: InjectionKey<RowGroupApi> = Symbol('advTableRowGroup')
/** <zh/> R2 域键：行展开 | <en/> R2 domain key: row expand */
export const advTableRowExpandKey: InjectionKey<RowExpandApi> = Symbol('advTableRowExpand')
/** <zh/> R2 域键：行固定 | <en/> R2 domain key: row pin */
export const advTableRowPinKey: InjectionKey<RowPinApi> = Symbol('advTableRowPin')
/** <zh/> R2 域键：范围选择 | <en/> R2 domain key: range selection */
export const advTableRangeSelectionKey: InjectionKey<TableRangeSelectionApi> = Symbol('advTableRangeSelection')
/** <zh/> R2 域键：筛选面板 | <en/> R2 domain key: filter panel */
export const advTableFilterPanelKey: InjectionKey<FilterPanelApi> = Symbol('advTableFilterPanel')
/** <zh/> R2 域键：选择状态（真源类型，消费侧禁止 as any） | <en/> R2 domain key: selection (source-typed, no as any at consumption sites) */
export const advTableSelectionKey: InjectionKey<UseSelectionStateReturn<any>> = Symbol('advTableSelection')
/** <zh/> R2 域键：全选切换 | <en/> R2 domain key: toggle-all-selection */
export const advTableToggleAllSelectionKey: InjectionKey<() => void> = Symbol('advTableToggleAllSelection')
