import type { ProcessedColumn } from '../../types'
import type { ApplyColumnStateOptions, ColumnState } from '../../types/column-state'
import type { ContextMenuParams, ImplementedBuiltinMenuCode } from '../../types/context-menu'
import type { CellEditStopReason, CommitResult } from '../../types/edit'
import type { TableErrorCode } from '../../types/error'
import { copyCellToClipboard, copyRowsToClipboard, copyRowToClipboard } from '../../utils/context-menu-clipboard'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { stripSensitiveColumns } from '../../utils/security'
import { getColumnKey } from '../../utils/shared'

/**
 * <zh/> 内置菜单动作分发器的依赖接口
 * <en/> Built-in menu action dispatcher dependency interface
 *
 * @remarks
 * <zh/> 将 table.vue 中分散的函数引用收敛为结构化依赖，避免大量位置参数
 * <en/> Converges scattered function references in table.vue into structured dependencies, avoiding numerous positional parameters
 */
export interface UseContextMenuActionsOptions<T> {
  /** <zh/> 获取有效列列表 | <en/> Get the effective column list */
  effectiveColumns: () => ProcessedColumn[]
  /** <zh/> 选中状态——获取已选行 | <en/> Selection state — get the selected rows */
  getSelectedRows: () => T[]
  /** <zh/> 启动单元格编辑 | <en/> Start cell editing */
  startEditing: (params: { rowIndex: number, prop: string, columnKey: string, value: any }) => void
  /** <zh/> 更新编辑中单元格的值（全行模式） | <en/> Update the editing cell's value (full-row mode) */
  updateCellEditingValue: (columnKey: string, val: unknown) => void
  /**
   * <zh/> 提交编辑—— resolves CommitResult（与 useCellEdit.commitEditing 同形，调用方 fire-and-forget 可忽略）
   * <en/> Commit editing — resolves CommitResult (same shape as useCellEdit.commitEditing; fire-and-forget callers may ignore it)
   */
  commitEditing: (reason?: CellEditStopReason) => Promise<CommitResult>
  /** <zh/> 应用列状态（宽度/隐藏/固定/排序） | <en/> Apply column state (width/hidden/fixed/sort) */
  applyColumnState: (state: ColumnState[] | null | undefined, options?: ApplyColumnStateOptions) => void
  /** <zh/> 重置列状态 | <en/> Reset column state */
  resetColumnState: () => void
  /** <zh/> 清除排序 | <en/> Clear sorting */
  clearSort: () => void
  /** <zh/> 重置单列筛选 | <en/> Reset a single column's filter */
  resetColumnFilter: (columnKey: string) => void
  /** <zh/> 重置所有筛选 | <en/> Reset all filters */
  resetAllFilters: () => void
  /** 导出 CSV */
  exportCsv: () => void
  /** 导出 Excel */
  exportExcel: () => void
  /** <zh/> 触发导入 | <en/> Trigger import */
  triggerImport: () => void
  /** <zh/> 打印 | <en/> Print */
  print: () => void
  /**
   * <zh/> 错误回调——内置菜单操作中的异步失败（如 pasteCell 剪贴板读取失败）通过此回调派发
   * <en/> Error callback — dispatches async failures from built-in menu actions (e.g. pasteCell clipboard read failure)
   */
  onError?: (error: unknown, code: TableErrorCode) => void
}

/** <zh/> 剪贴板首行首格提取——模块级编译避免每次粘贴重复创建（e18e） | <en/> first-cell extraction hoisted to module scope (e18e) */
const PASTE_FIRST_CELL_RE = /\r?\n/
/**
 * <zh/> 内置菜单动作分发器。
 * <zh/> 将原 table.vue 中的 100 行 switch-case 提取为独立 composable，保持所有行为完全一致。
 * <en/> Built-in menu action dispatcher — extracts the 100-line switch-case from the original table.vue
 * <en/> into an independent composable, keeping all behavior exactly the same.
 *
 * @param options - <zh/> 依赖函数集合 | <en/> dependency function set
 * @returns handleBuiltinAction - <zh/> 按 code 执行对应内置操作 | <en/> execute built-in action by code
 */
export function useContextMenuActions<T>(options: UseContextMenuActionsOptions<T>) {
  /**
   * <zh/> 根据菜单 code 执行对应内置操作。
   *
   * <zh/> clearCell/editCell 涉及异步编辑管线（commitEditing 返回 Promise），故声明为 async。
   * <zh/> 调用方采用 fire-and-forget 模式，错误在内部 catch。
   * <en/> clearCell/editCell involves async editing pipeline (commitEditing returns Promise), hence declared as async.
   * <en/> Caller uses fire-and-forget pattern, errors are caught internally.
   *
   * @param code - <zh/> 内置菜单项 code | <en/> built-in menu item code
   * @param context - <zh/> 右键菜单上下文参数 | <en/> context menu parameters
   */
  /**
   * <zh/> 复制结果上报：copy* 永不抛错（失败返回 false），此处 await 并在失败时走 onError 可观测，
   * <zh/> 替代此前的 fire-and-forget 静默（拒写无感知）。
   * <en/> Report copy results: copy* never throws (false on failure); await here and report.
   */
  async function reportCopy(ok: boolean | Promise<boolean>, code: TableErrorCode): Promise<void> {
    let succeeded = false
    try {
      succeeded = await ok
    }
    catch (error) {
      options.onError?.(error, code)
      return
    }
    if (!succeeded)
      options.onError?.(new Error('[AdvTable] Clipboard copy failed'), code)
  }

  async function handleBuiltinAction(code: ImplementedBuiltinMenuCode, context: ContextMenuParams<T>): Promise<void> {
    // <zh/> 安全契约：剪贴板复制与导出共用同一敏感列过滤——sensitive 列的值不允许离开表格。
    // <zh/> 单格路径（copyCell/copyCellWithHeader/cutCell）同样受约，覆盖行级与单格两类路径。
    // <en/> Security contract: clipboard copy shares the same sensitive-column filter as export —
    // <en/> values of sensitive columns must never leave the table.
    // <en/> Single-cell paths (copyCell/copyCellWithHeader/cutCell) are covered too, spanning
    // <en/> both row-level and single-cell paths.
    const { safeColumns: columns, strippedProps } = stripSensitiveColumns(options.effectiveColumns())
    if (strippedProps.length > 0 && (code === 'copyRow' || code === 'copyRowWithHeaders' || code === 'copySelectedRows' || code === 'copySelectedRowsWithHeaders')) {
      devWarn(`[AdvTable] sensitive column(s) excluded from clipboard copy: ${strippedProps.join(', ')}`)
    }
    // <zh/> 单格动作的敏感列守卫——context.column 命中 strippedProps 时整个动作中止
    // <zh/>（cutCell 连清空一并中止：复制不发生的"剪切"对用户不可预期，清空应走 clearCell）。
    // <en/> Single-cell guard — abort the whole action when context.column is in strippedProps
    // <en/> (cutCell aborts its clear too: a "cut" whose copy never happened is unexpected;
    // <en/> clearing should go through clearCell).
    const isSensitiveCellAction = (code === 'copyCell' || code === 'copyCellWithHeader' || code === 'cutCell')
      && (() => {
        const prop = (context.column?.prop ?? context.column?.property) as string | undefined
        return prop != null && strippedProps.includes(prop)
      })()
    if (isSensitiveCellAction) {
      devWarn(`[AdvTable] sensitive column "${String(context.column?.prop ?? context.column?.property)}" is excluded from clipboard copy`)
      return
    }
    switch (code) {
      case 'copyCell':
        if (context.row && context.column)
          await reportCopy(copyCellToClipboard(context.row, context.column), 'TABLE_CLIPBOARD_COPY_FAILED')
        break
      case 'copyCellWithHeader':
        if (context.row && context.column)
          await reportCopy(copyRowToClipboard(context.row, [context.column], true), 'TABLE_CLIPBOARD_COPY_FAILED')
        break
      case 'copyRow':
        if (context.row)
          await reportCopy(copyRowToClipboard(context.row, columns), 'TABLE_CLIPBOARD_COPY_FAILED')
        break
      case 'copyRowWithHeaders':
        if (context.row)
          await reportCopy(copyRowToClipboard(context.row, columns, true), 'TABLE_CLIPBOARD_COPY_FAILED')
        break
      case 'copySelectedRows':
        await reportCopy(copyRowsToClipboard(options.getSelectedRows(), columns), 'TABLE_CLIPBOARD_COPY_FAILED')
        break
      case 'copySelectedRowsWithHeaders':
        await reportCopy(copyRowsToClipboard(options.getSelectedRows(), columns, true), 'TABLE_CLIPBOARD_COPY_FAILED')
        break
      case 'cutCell':
        if (context.row && context.column)
          await reportCopy(copyCellToClipboard(context.row, context.column), 'TABLE_CLIPBOARD_CUT_FAILED')
        if (context.row && context.rowIndex != null && context.column?.prop) {
          /** 剪切 = 复制 + 清空——通过编辑管线清空值，确保校验、dirty 追踪和拦截器正常触发 */
          await options.startEditing({
            rowIndex: context.rowIndex,
            prop: context.column.prop,
            columnKey: context.column.key ?? context.column.prop,
            value: context.row[context.column.prop as keyof T],
          })
          options.updateCellEditingValue(context.column.key ?? context.column.prop, '')
          await options.commitEditing('contextMenu')
        }
        break
      case 'clearCell':
        if (context.row && context.rowIndex != null && context.column?.prop) {
          /** 通过编辑管线清空值——确保校验、dirty 追踪和拦截器正常触发 */
          await options.startEditing({
            rowIndex: context.rowIndex,
            prop: context.column.prop,
            columnKey: context.column.key ?? context.column.prop,
            value: context.row[context.column.prop as keyof T],
          })
          options.updateCellEditingValue(context.column.key ?? context.column.prop, '')
          await options.commitEditing('contextMenu')
        }
        break
      case 'pasteCell':
        // <zh/> 单元格粘贴补全：读取剪贴板首行首列值，经编辑管线写入当前格，
        // <zh/> 与 cutCell/clearCell 同链——校验、dirty 追踪、拦截器全部生效。
        // <en/> Cell-paste completion: read the clipboard's first cell and write it to
        // <en/> the current cell via the edit pipeline — same chain as cutCell/clearCell, so
        // <en/> validation, dirty tracking and interceptors all apply.
        if (context.row && context.rowIndex != null && context.column?.prop) {
          try {
            // <zh/> 兼容：SSR/非安全上下文/旧浏览器无 clipboard | <en/> Compat: SSR/non-secure/legacy browsers may lack clipboard
            if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
              throw new Error('Clipboard API unavailable')
            }
            const text = await navigator.clipboard.readText()
            const pastedValue = text.split(PASTE_FIRST_CELL_RE)[0]?.split('\t')[0] ?? ''
            if (pastedValue !== '') {
              await options.startEditing({
                rowIndex: context.rowIndex,
                prop: context.column.prop,
                columnKey: context.column.key ?? context.column.prop,
                value: context.row[context.column.prop as keyof T],
              })
              options.updateCellEditingValue(context.column.key ?? context.column.prop, pastedValue)
              await options.commitEditing('contextMenu')
            }
          }
          catch (err) {
            // <zh/> 剪贴板不可达时通过 onError 回调派发结构化错误（D-6：消除静默吞错）
            // <en/> Dispatch structured error via onError when clipboard is unreachable (D-6: eliminate silent error swallowing)
            options.onError?.(err, 'TABLE_CLIPBOARD_FAILED')
          }
        }
        break
      case 'editCell':
        if (context.row && context.rowIndex != null && context.column?.prop)
          options.startEditing({ rowIndex: context.rowIndex, prop: context.column.prop, columnKey: context.column.key, value: context.row[context.column.prop as keyof T] })
        break
      case 'autoSizeThisColumn':
        // <zh/> colId 口径必须与 useColumnState.getColumnState() 一致（getColumnKey 多级回退），
        // <zh/> 否则仅声明 prop 的列会传入 undefined，被 applyColumnState 的字段级校验整体拒绝。
        // <en/> colId must match useColumnState.getColumnState()'s caliber (getColumnKey multi-level
        // <en/> fallback); otherwise prop-only columns pass undefined and the field-level validation
        // <en/> inside applyColumnState rejects the whole payload.
        if (context.column)
          options.applyColumnState([{ colId: getColumnKey(context.column) }], { applyOrder: false })
        break
      case 'autoSizeAllColumns':
        options.applyColumnState(options.effectiveColumns().map(c => ({ colId: getColumnKey(c) })), { applyOrder: false })
        break
      case 'resetColumns':
        options.resetColumnState()
        break
      case 'clearSort':
        options.clearSort()
        break
      case 'clearFilter':
        if (context.column)
          options.resetColumnFilter(context.column.key)
        break
      case 'clearAllFilters':
        options.resetAllFilters()
        break
      case 'exportCsv':
        options.exportCsv()
        break
      case 'exportExcel':
        options.exportExcel()
        break
      case 'importExcel':
        options.triggerImport()
        break
      case 'print':
        options.print()
        break
      case 'hideThisColumn':
        // <zh/> 同 autoSizeThisColumn——colId 统一走 getColumnKey
        // <en/> Same as autoSizeThisColumn — colId goes through getColumnKey
        if (context.column)
          options.applyColumnState([{ colId: getColumnKey(context.column), hidden: true }])
        break
      case 'showAllColumns':
        options.applyColumnState(options.effectiveColumns().map(c => ({ colId: getColumnKey(c), hidden: false })))
        break
      default: {
        // <zh/> 穷尽检查：ImplementedBuiltinMenuCode 新增成员而此处漏加 case 时编译失败
        // <en/> Exhaustiveness check: fails compilation when a new ImplementedBuiltinMenuCode lacks a case here
        const _exhaustive: never = code
        if (isDev)
          devWarn(`[AdvTable] builtin menu code "${_exhaustive}" has no action handler`)
      }
    }
  }

  return { handleBuiltinAction }
}
