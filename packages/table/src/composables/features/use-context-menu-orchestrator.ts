import type { Ref } from 'vue'
import type { AdvTableEmitFn, ProcessedColumn } from '../../types'
import type { CrossCuttingContext } from '../../types/orchestrator-context'
import type { AdvTableProps } from '../../types/table-props'
import type { UseInterceptorReturn } from '../editing/use-interceptor'
import type { UseContextMenuActionsOptions } from '../features/use-context-menu-actions'
import type { UseSelectionStateReturn } from '../selection/use-selection-state'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { createTableEmitter } from '../../utils/table-emitter'
import { useContextMenu } from '../features/use-context-menu'
import { useContextMenuActions } from '../features/use-context-menu-actions'

/** <zh/> 右键菜单编排器输入 | <en/> Context menu orchestrator input */
export interface UseContextMenuOrchestratorOptions<T> {
  /** <zh/> 菜单配置 | <en/> Menu config */
  menuConfig: () => AdvTableProps<T>['menuConfig']
  /** <zh/> 有效列 | <en/> Effective columns */
  effectiveColumns: Ref<ProcessedColumn[]>
  /** <zh/> 选择状态 | <en/> Selection state */
  selectionState: UseSelectionStateReturn<T>
  /**
   * <zh/> 编辑操作——类型与 useContextMenuActions 消费端对齐（Pick 复用，防漂移）
   * <en/> Edit operations — typed via Pick from the useContextMenuActions consumer (no drift)
   */
  startEditing: UseContextMenuActionsOptions<T>['startEditing']
  updateCellEditingValue: UseContextMenuActionsOptions<T>['updateCellEditingValue']
  commitEditing: UseContextMenuActionsOptions<T>['commitEditing']
  /**
   * <zh/> 列状态操作——同上与消费端对齐 | <en/> Column state operations — aligned with the consumer as above
   */
  applyColumnState: UseContextMenuActionsOptions<T>['applyColumnState']
  resetColumnState: () => void
  /** <zh/> 筛选/排序操作 | <en/> Filter/Sort operations */
  clearSort: () => void
  resetColumnFilter: (key: string) => void
  resetAllFilters: () => void
  /** <zh/> 导出/导入/打印操作 | <en/> Export/Import/Print operations */
  exportCsv: () => void
  exportExcel: () => void
  triggerImport: () => void
  doPrint: () => void
  /** <zh/> 拦截器 | <en/> Interceptor */
  interceptor: UseInterceptorReturn
  /** <zh/> 跨切面上下文（tableId/t/handleError/isUnmounted） | <en/> Cross-cutting context (tableId/t/handleError/isUnmounted) */
  crossCutting: CrossCuttingContext
  /** <zh/> 事件发射 | <en/> Event emit */
  emit: AdvTableEmitFn
}

/**
 * <zh/> 右键菜单编排——统一管理右键菜单项解析、内置操作、事件派发。
 *
 * <en/> Context menu orchestration — unified management of
 * <en/> menu item resolution, built-in actions, and event dispatch.
 */
export function useContextMenuOrchestrator<T>(options: UseContextMenuOrchestratorOptions<T>) {
  const {
    menuConfig,
    effectiveColumns,
    selectionState,
    startEditing,
    updateCellEditingValue,
    commitEditing,
    applyColumnState,
    resetColumnState,
    clearSort,
    resetColumnFilter,
    resetAllFilters,
    exportCsv,
    exportExcel,
    triggerImport,
    doPrint,
    interceptor,
    crossCutting,
    emit,
  } = options

  const { t, tableId } = crossCutting
  const tableEmit = createTableEmitter(emit, tableId)

  const { handleBuiltinAction } = useContextMenuActions<T>({
    effectiveColumns: () => effectiveColumns.value,
    getSelectedRows: () => selectionState.getSelectedRows(),
    startEditing,
    updateCellEditingValue,
    commitEditing,
    applyColumnState,
    resetColumnState,
    clearSort,
    resetColumnFilter,
    resetAllFilters,
    exportCsv,
    exportExcel,
    triggerImport,
    print: doPrint,
    onError: (error, code) => {
      tableEmit('error', {
        code,
        severity: 'warn',
        cause: error,
      })
    },
  })

  const {
    menuVisible,
    menuStyle,
    currentItems,
    currentParams,
    menuToken,
    menuElRef,
    setMenuElRef,
    handleContextMenu,
    closeMenu,
    onMenuItemClick,
  } = useContextMenu<T>({
    menuConfig,
    effectiveColumns: () => effectiveColumns.value,
    interceptor,
    t,
    onMenuClick: ({ area, menu, context }) => {
      tableEmit('contextMenuClick', { area, menu, params: context })
    },
    onBuiltinAction: ({ code, context }) => {
      void handleBuiltinAction(code, context).catch((error) => {
        if (isDev)
          devWarn('[AdvTable] handleBuiltinAction failed:', error)
        tableEmit('error', {
          code: 'TABLE_CONTEXT_ACTION_FAILED',
          severity: 'warn',
          cause: error,
          field: code,
        })
      })
    },
  })

  /**
   * <zh/> 右键入口统一兜底——handleContextMenu 内部已处理 visibleMethod 抛错，此处再包一层，
   * <zh/> 防止未来新增的 await 路径漏网导致 unhandledrejection。
   * <en/> Unified fallback for contextmenu entries — handleContextMenu already guards visibleMethod,
   * <en/> this extra layer keeps future await paths from leaking unhandled rejections.
   */
  function reportContextMenuError(error: unknown): void {
    if (isDev)
      devWarn('[AdvTable] handleContextMenu failed:', error)
    tableEmit('error', {
      code: 'TABLE_CONTEXT_ACTION_FAILED',
      severity: 'warn',
      cause: error,
    })
  }

  function handleCellContextmenu(params: { rowData: T, rowIndex: number, column: ProcessedColumn, columnIndex: number, event: Event }) {
    tableEmit('cellContextmenu', params)
    handleContextMenu({
      area: 'body',
      row: params.rowData,
      rowIndex: params.rowIndex,
      column: params.column,
      columnIndex: params.columnIndex,
      event: params.event as MouseEvent,
    }).catch(reportContextMenuError)
  }

  function handleHeaderContextmenu(params: { column: ProcessedColumn, columnIndex: number, event: Event }) {
    tableEmit('headerContextmenu', params)
    handleContextMenu({
      area: 'header',
      column: params.column,
      columnIndex: params.columnIndex,
      event: params.event as MouseEvent,
    }).catch(reportContextMenuError)
  }

  return {
    handleBuiltinAction,
    menuVisible,
    menuStyle,
    currentItems,
    currentParams,
    menuToken,
    menuElRef,
    setMenuElRef,
    handleContextMenu,
    closeMenu,
    onMenuItemClick,
    handleCellContextmenu,
    handleHeaderContextmenu,
  }
}
