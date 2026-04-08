/**
 * <zh/> 事件命名规范清单（事件命名守卫·命名规范注册表）
 *
 * <zh/> 三类事件的命名规则：
 * <zh/> ① <主体>Change 结构（状态变更类）：pageChange / sortChange / filterChange / dataChange / searchChange /
 * <zh/> selectionChange / currentChange / afterDataChange / beforeDataChange
 * <zh/> ② cellEditing* 结构（单元格编辑会话域）：cellEditingStarted / cellEditingStopped /
 * <zh/> cellEditingRequest / cellEditingCancelled
 * <zh/> ③ 豁免清单（el-table 原生风格兼容）：rowClick / cellDblclick / headerDragend 等
 *
 * <en/> Event naming spec manifest (event-naming guard, naming spec registry).
 *
 * <en/> Three naming rule classes:
 * <en/> ① `<subject>Change` structure (state-change class): pageChange / sortChange / filterChange /
 * <en/> dataChange / searchChange / selectionChange / currentChange / afterDataChange / beforeDataChange
 * <en/> ② `cellEditing*` structure (cell editing session domain): cellEditingStarted /
 * <en/> cellEditingStopped / cellEditingRequest / cellEditingCancelled
 * <en/> ③ Exemption list (el-table native-style compat): rowClick / cellDblclick / headerDragend, etc.
 */
import type { AdvTableEmitsMap } from '../types/table-emits'

/**
 * <zh/> 旧事件名（已彻底移除）。任何引用这些名的代码都应被标记为错误。
 * <en/> Removed event names (legacy). Any reference to them should error.
 */
export const removedEventNames = [
  'changePage',
  'cellEditRequest',
  'editCancelled',
] as const

/** <zh/> 状态变更类事件的规范词根后缀 | <en/> Canonical suffix for state-change events */
export const CHANGE_EVENT_SUFFIX = 'Change'

/** <zh/> 状态变更类事件名集合（<主体>Change） | <en/> State-change event names (<subject>Change) */
export const changeEventNames = [
  'pageChange',
  'sortChange',
  'filterChange',
  'dataChange',
  'searchChange',
  'selectionChange',
  'currentChange',
  'afterDataChange',
  'beforeDataChange',
  'batchPendingChange',
] as const

/** <zh/> 单元格编辑会话域事件名集合（cellEditing*） | <en/> Cell editing session domain event names (cellEditing*) */
export const cellEditingEventNames = [
  'cellEditingStarted',
  'cellEditingStopped',
  'cellEditingRequest',
  'cellEditingCancelled',
] as const

/** <zh/> el-table 原生风格命名豁免清单 | <en/> el-table native-style naming exemption list */
export const elTableStyleExemptions = [
  'rowClick',
  'rowContextmenu',
  'rowDblclick',
  'cellClick',
  'cellDblclick',
  'cellContextmenu',
  'cellMouseEnter',
  'cellMouseLeave',
  'headerClick',
  'headerContextmenu',
  'headerDragend',
  'scroll',
] as const

/**
 * <zh/> 守卫类型：确保 removedEventNames 中没有任何键残留在 AdvTableEmitsMap 中。
 * <zh/> 先通过 keyof 判定是否残留，再在残留时暴露具体残留名；未访问不存在属性，避免 TS2339。
 * <en/> Guard type: ensures none of removedEventNames survive in AdvTableEmitsMap.
 * <en/> First use keyof to detect survivors, then surface the remaining name(s); never
 * <en/> indexes missing properties to avoid TS2339.
 */
type _RemovedKeyCheck = (typeof removedEventNames)[number] extends never
  ? true
  : (typeof removedEventNames)[number] extends keyof AdvTableEmitsMap<any>
      ? ['removed event names still present in AdvTableEmitsMap:', (typeof removedEventNames)[number]]
      : true

/** <zh/> 编译期守卫：若旧事件名仍存在于 AdvTableEmitsMap 中，_AssertRemovedEventNamesAbsent 解析为 false | <en/> Compile-time guard: if a removed legacy name still exists in AdvTableEmitsMap, _AssertRemovedEventNamesAbsent resolves to false */
export type _AssertRemovedEventNamesAbsent = _RemovedKeyCheck extends true ? true : ['removed event names still present in AdvTableEmitsMap']
