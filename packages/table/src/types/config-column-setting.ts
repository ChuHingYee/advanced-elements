import type { ComputedRef, Ref } from 'vue'
import type { ProcessedColumn } from './column'

/**
 * <zh/> 列操作回调接口——列设置面板内父子通信契约。
 * <zh/> 由 useColumnGroup 提供，column-setting-item 通过 inject 消费。
 * <zh/> 用于处理列设置项的用户操作：显隐切换、固定/取消固定、子列更新。
 * <en/> Column action callback interface — parent-child communication contract inside the column setting panel.
 * <en/> Provided by useColumnGroup and consumed by column-setting-item via inject.
 * <en/> Handles user actions on column setting items: visibility toggle, pin/unpin, child column update.
 */
export interface ColumnActions {
  /** <zh/> 更新列的显示/隐藏状态 | <en/> Update the column's visibility state */
  onUpdate: (col: ProcessedColumn, hidden: boolean) => void
  /** <zh/> 将列固定到指定方向（'left' | 'right'） | <en/> Pin the column to the given direction ('left' | 'right') */
  onSetFixed: (col: ProcessedColumn, direction: 'left' | 'right') => void
  /** <zh/> 取消列固定，将其移回中间区域 | <en/> Unpin the column and move it back to the middle area */
  onUnfix: (col: ProcessedColumn) => void
  /** <zh/> 更新分组列的子列列表（拖拽排序后触发） | <en/> Update the child column list of a group column (triggered after drag sorting) */
  onChildUpdate: (parentCol: ProcessedColumn, newChildren: ProcessedColumn[]) => void
}

/**
 * <zh/> 列设置列表上下文——列设置面板内父子通信契约。
 * <zh/> 由 useColumnGroup 提供，column-setting-list 通过 inject 消费。
 * <zh/> 包含分组的列列表响应式引用及全选/拖拽相关回调。
 * <en/> Column setting list context — parent-child communication contract inside the column setting panel.
 * <en/> Provided by useColumnGroup and consumed by column-setting-list via inject.
 * <en/> Contains reactive column lists of the groups and select-all/drag related callbacks.
 */
export interface ColumnSettingListContext {
  /** <zh/> 左固定列列表 | <en/> Left pinned column list */
  leftColumns: ComputedRef<ProcessedColumn[]>
  /** <zh/> 未固定列列表 | <en/> Unpinned column list */
  normalColumns: ComputedRef<ProcessedColumn[]>
  /** <zh/> 右固定列列表 | <en/> Right pinned column list */
  rightColumns: ComputedRef<ProcessedColumn[]>
  /** <zh/> 是否已全选所有列 | <en/> Whether all columns are selected */
  isChooseAll: Ref<boolean>
  /** <zh/> 列选中状态是否为半选（部分选中、部分未选中） | <en/> Whether the column selection state is indeterminate (partially selected) */
  isIndeterminate: Ref<boolean>
  /**
   * <zh/> 判断指定列是否已被固定到指定侧。
   * <en/> Check whether the given column is pinned to the given side.
   * @param col - <zh/> 要判断的列 | <en/> The column to check
   * @param group - <zh/> 固定方向（'left' | 'right'） | <en/> Pinned side ('left' | 'right')
   * @returns <zh/> 如果列已固定到该侧则返回 true | <en/> true when the column is pinned to that side
   */
  isPinned: (col: ProcessedColumn, group: 'left' | 'right') => boolean
  /**
   * <zh/> 顶部全选/重置操作回调。 | <en/> Header select-all/reset callback.
   * @param val - <zh/> true=全选, false=取消全选, 'none'=重置全部隐藏 | <en/> true=select all, false=deselect all, 'none'=reset all to hidden
   * @param group - <zh/> 始终为 'all'，表示作用于全部分组 | <en/> Always 'all', applies to all groups
   */
  handleHeaderChange: (val: boolean | 'none', group: 'all') => void
  /**
   * <zh/> 拖拽移动过程中的校验回调。 | <en/> Validation callback during drag move.
   * @param evt - <zh/> 拖拽事件对象 | <en/> drag event object
   * @returns <zh/> 返回 false 可阻止此次拖拽移动 | <en/> returning false prevents this drag move
   */
  handleColumnMove: (evt: any) => boolean | void // Note: sortablejs 拖拽事件对象结构，非业务类型 | sortablejs drag event object structure, not a business type
  /**
   * <zh/> 拖拽结束后的回调。 | <en/> Callback after drag end.
   * @param evt - <zh/> 拖拽事件对象 | <en/> drag event object
   */
  handleColumnEnd: (evt: any) => void // Note: sortablejs 拖拽事件对象结构，非业务类型
  /**
   * <zh/> 拖拽完成后更新指定分组的列列表。 | <en/> Updates the column list of the given group after drag completes.
   * @param groupKey - <zh/> 分组标识（'left' | 'normal' | 'right'） | <en/> Group key ('left' | 'normal' | 'right')
   * @param newCols - <zh/> 拖拽后的新列顺序 | <en/> new column order after drag
   */
  handleGroupUpdate: (groupKey: 'left' | 'normal' | 'right', newCols: ProcessedColumn[]) => void
}
