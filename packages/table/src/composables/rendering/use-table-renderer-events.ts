import type { Ref } from 'vue'
import type { AdvTableEventName, ProcessedColumn } from '../../types'
import type { CellEditStopReason, EditConfig } from '../../types/edit'
import type { InterceptorCellClickParams, InterceptorHeaderClickParams, InterceptorKeydownParams, InterceptorRowClickParams } from '../../types/interceptor'
import type { UseInterceptorReturn } from '../editing/use-interceptor'
import type { UseClipboardHandlerReturn } from '../interaction/use-clipboard-handler'
import type { UseSelectionStateReturn } from '../selection/use-selection-state'
import { onBeforeUnmount, onDeactivated } from 'vue'
import { EP_ANY_CHECKABLE_SELECTOR } from '../../utils/ep-selectors'
import { getColumnKey, markRawTyped, resolveColumnProp } from '../../utils/shared'
import { isSyntheticRow } from '../../utils/synthetic-row'

/**
 * <zh/> 本组合式负责转发的渲染器事件名联合类型 — AdvTableEventName 的子集
 * <en/> Union type of renderer event names forwarded by this composable — a subset of AdvTableEventName
 * @remarks
 * <zh/> 通过 Extract<AdvTableEventName, ...> 派生，确保事件名始终是全局全集的合法成员
 * <en/> Derived via Extract<AdvTableEventName, ...> to ensure event names are always valid members of the global union
 * <zh/> 仅列出本文件 forward(event) 实际使用的事件，便于本地静态校验转发范围
 * <en/> Only lists events actually used by this file's forward(event), for local static validation of the forwarding scope
 */
export type AdvTableForwardedEvent = Extract<
  AdvTableEventName,
  | 'rowContextmenu'
  | 'rowDblclick'
  | 'currentChange'
  | 'cellMouseEnter'
  | 'cellMouseLeave'
  | 'cellContextmenu'
  | 'headerContextmenu'
  | 'headerDragend'
  | 'scroll'
  | 'cellFocused'
  | 'cellKeyPress'
  | 'cellKeyUp'
  | 'headerClick'
  | 'cellKeyDown'
  | 'rowClick'
  | 'cellClick'
  | 'cellDblclick'
  // <zh/> rowExpand/rowCollapse 不再由渲染器 emit，改由 useRowExpand 回调统一触发
  // <en/> rowExpand/rowCollapse are no longer emitted by renderers, unified via useRowExpand callbacks
>

/**
 * 转发专用 emit 函数类型
 * - 事件名收敛到 AdvTableForwardedEvent（AdvTableEventName 子集），避免上游传错事件名时静默失败
 * - 参数列表使用 unknown[] 而非 any[]，强制消费方在使用前做类型收窄
 * - 与 table.vue 中 defineEmits 返回的 emit 函数在参数边界上兼容（动态拼接参数场景无法使用逐事件元组签名，
 *   见 forward/throttledScrollForward 的 ...args 拼接）
 * (Emit function type dedicated for forwarding — the event name is constrained to
 *  AdvTableForwardedEvent (subset of AdvTableEventName) and args use unknown[] to force narrowing at use sites;
 *  per-event tuple signatures are infeasible here because forward/throttledScrollForward splice args dynamically).
 */
export type AdvTableForwardEmitFn = <E extends AdvTableForwardedEvent>(event: E, ...args: unknown[]) => void

/** 选择功能域接口（Selection domain interface） */
export interface RendererEventsSelectionApi<T> {
  selectionState: UseSelectionStateReturn<T>
  hasSelection: () => boolean
  suppressRowClickSelection: () => boolean
  rowClickSelect: () => boolean
}

/** 编辑功能域接口（Editing domain interface） */
export interface RendererEventsEditApi {
  editConfig: () => EditConfig | undefined
  isColumnEditable: (col: ProcessedColumn) => boolean
  isCellEditing: (rowIndex: number, columnKey: string) => boolean
  startEditing: (params: { rowIndex: number, prop: string, columnKey: string, value: any }) => void
  updateCellEditingValue: (columnKey: string, val: unknown) => void
  commitEditing: (reason?: CellEditStopReason) => Promise<import('../../types/edit').CommitResult>
  batchCommitCells: (cells: Array<{ rowIndex: number, prop: string, columnKey: string, value: any }>, reason?: CellEditStopReason) => Promise<import('../../types/edit').CommitResult>
  /** <zh/> 撤销上一次编辑 | <en/> Undo the last edit */
  undo?: () => boolean
  /** <zh/> 重做上一次撤销的编辑 | <en/> Redo the last undone edit */
  redo?: () => boolean
  /** <zh/> 是否可撤销 | <en/> Whether undo is available */
  canUndo?: () => boolean
  /** <zh/> 是否可重做 | <en/> Whether redo is available */
  canRedo?: () => boolean
}

/** 数据管线功能域接口（Data pipeline domain interface） */
export interface RendererEventsDataPipelineApi<T> {
  effectiveColumns: () => ProcessedColumn[]
  columnByKey: () => Map<string, ProcessedColumn>
  visibleData: () => T[]
  rowKeyFn: () => (row: T) => string
  rowKeyMeta: () => { keyToRow: Map<string, T>, keyToIndex: Map<string, number> }
  toggleSort: (key: string, options?: { shiftKey?: boolean }) => void
  shiftKeyPressed: Ref<boolean>
  toggleCollapse: (columnKey: string) => void
}

export interface UseTableRendererEventsOptions<T> {
  selection: RendererEventsSelectionApi<T>
  edit: RendererEventsEditApi
  pipeline: RendererEventsDataPipelineApi<T>
  clipboard: UseClipboardHandlerReturn
  emit: AdvTableForwardEmitFn
  interceptor: UseInterceptorReturn
  onCellContextmenu?: (params: any) => void
  onHeaderContextmenu?: (params: any) => void
  /** <zh/> 表格实例 ID，附加到所有转发事件的末位参数，便于多表场景区分事件来源 | <en/> Table instance ID, appended as the trailing arg of all forwarded events to disambiguate event source in multi-table scenarios */
  tableId: () => string
}

export interface UseTableRendererEventsReturn {
  rendererEvents: Record<string, (...args: any[]) => void>
}

/**
 * 渲染器事件转发 composable — 将渲染器内部事件统一转发为组件级 emit，支持拦截器拦截。
 *
 * @param options - 事件配置
 * @returns 渲染器事件对象
 */
export function useTableRendererEvents<T>(options: UseTableRendererEventsOptions<T>): UseTableRendererEventsReturn {
  const {
    selection,
    edit,
    pipeline,
    clipboard,
    emit,
    interceptor,
    onCellContextmenu,
    onHeaderContextmenu,
    tableId,
  } = options

  /**
   * <zh/> 转发渲染器事件，自动在末位附加 tableId，便于多表场景区分事件来源
   * <en/> Forward renderer events, automatically appending tableId as the trailing arg for multi-table event source disambiguation
   */
  function forward(event: AdvTableForwardedEvent) {
    return (...args: unknown[]) => emit(event, ...args, tableId())
  }

  /**
   * <zh/> 解析行在可见数据中的索引。
   * <zh/> useCellEdit 接收 visibleData，所以索引必须是可见数据内的索引。
   * @param params - <zh/> 渲染器事件参数（rowIndex 为可见索引） | <en/> renderer event params (rowIndex is visible index)
   * @param row - <zh/> 行数据 | <en/> row data
   * @returns <zh/> 可见数据索引，未找到时返回 -1 | <en/> visible data index, -1 if not found
   */
  function resolveRowIndex(params: any, row: T): number {
    // default 模式 params.rowIndex 是 pinnedDisplayData 域（含顶部 pinned/Grand 交错），
    // 而 pipeline.visibleData() 实为 renderData 域（已剔 pinned）。直接透传会导致顶部有
    // pinned 时整体前移错行。故优先按行对象身份在编辑域内定位，仅当身份命中失败且
    // 序号经校验一致时才回退序号；合成行/未命中一律返回 -1（禁止编辑，避免错行写入）。
    const editData = pipeline.visibleData()
    if (row != null && typeof row === 'object') {
      // <zh/> 合成行（组头/详情/总计）一律不可编辑，判别收敛至单一源 | <en/> Synthetic rows are never editable, predicate converged to the single source
      if (isSyntheticRow(row)) {
        return -1
      }
      const byIdentity = editData.indexOf(row)
      if (byIdentity >= 0)
        return byIdentity
      // pinned 行是真实数据但不在 renderData 内：按 rowKey 在编辑域中二次查找，
      // 仍找不到则拒绝（-1），绝不回退裸序号，避免落到相邻行。
      try {
        const keyFn = pipeline.rowKeyFn?.()
        if (typeof keyFn === 'function') {
          const key = (keyFn as (row: T) => string)(row)
          if (key != null) {
            const meta = pipeline.rowKeyMeta?.()
            const mapped = meta?.keyToIndex?.get?.(String(key))
            if (typeof mapped === 'number' && mapped >= 0 && mapped < editData.length
              && (editData[mapped] === row || String((keyFn as (row: T) => string)(editData[mapped])) === String(key))) {
              return mapped
            }
          }
        }
      }
      catch {
        // rowKey 解析异常时直接拒绝，不回退序号
      }
      return -1
    }
    // 无行对象时不信任裸序号：仅当序号落在编辑域内才接受，否则 -1
    if (params?.rowIndex != null) {
      const idx = params.rowIndex as number
      if (Number.isInteger(idx) && idx >= 0 && idx < editData.length)
        return idx
      return -1
    }
    return editData.indexOf(row)
  }

  /**
   * <zh/> scroll 事件节流 — 50ms throttle（leading + trailing），
   * <zh/> 将消费者收到的 scroll 事件从 60fps 降至 ~20fps，避免消费者回调中的重计算阻塞主线程。
   * <zh/> 仅节流对消费者的 emit，不影响渲染器内部的 trackScrollVelocity / hover 层 / summary 同步逻辑。
   *
   * <en/> scroll event throttle — 50ms throttle (leading + trailing),
   * <en/> reduces consumer-facing scroll events from 60fps to ~20fps, preventing consumer callbacks
   * <en/> from blocking the main thread. Only throttles the consumer emit; internal renderer logic
   * <en/> (trackScrollVelocity / hover layer / summary sync) is NOT affected.
   */
  let scrollThrottleTimer: ReturnType<typeof setTimeout> | null = null
  let pendingScrollArgs: unknown[] | null = null

  function throttledScrollForward(...args: unknown[]) {
    if (scrollThrottleTimer !== null) {
      // <zh/> 节流窗口内：暂存最新参数，等待 trailing edge | <en/> Within throttle window: store latest args for trailing edge
      pendingScrollArgs = args
      return
    }
    // <zh/> Leading edge：立即转发 | <en/> Leading edge: forward immediately
    emit('scroll', ...args, tableId())
    scrollThrottleTimer = setTimeout(() => {
      scrollThrottleTimer = null
      if (pendingScrollArgs) {
        // <zh/> Trailing edge：转发窗口内最新的参数 | <en/> Trailing edge: forward the latest args from the window
        const trailingArgs = pendingScrollArgs
        pendingScrollArgs = null
        emit('scroll', ...trailingArgs, tableId())
      }
    }, 50)
  }

  /**
   * <zh/> cellMouseEnter 事件 rAF 合并 — 同一帧内多次 cellMouseEnter 仅 emit 最后一次，
   * <zh/> 避免多列场景下鼠标跨行时每列一次 emit 造成的频繁 payload 构造 + 消费者回调。
   * <zh/> 滚动期间的抑制仍由渲染器 SFC 中的 isScrolling 守卫处理。
   *
   * <en/> cellMouseEnter rAF batching — multiple cellMouseEnter within the same frame are merged into a single emit
   * <en/> (only the latest), avoiding per-column payload construction + consumer callback when the mouse
   * <en/> crosses rows in multi-column scenarios. Scroll suppression is still handled by the isScrolling
   * <en/> guard in the renderer SFCs.
   */
  let mouseEnterRafId: number | null = null
  let latestMouseEnterArgs: unknown[] | null = null

  function rafBatchedMouseEnterForward(...args: unknown[]) {
    latestMouseEnterArgs = args
    if (mouseEnterRafId === null) {
      mouseEnterRafId = requestAnimationFrame(() => {
        mouseEnterRafId = null
        if (latestMouseEnterArgs) {
          emit('cellMouseEnter', ...latestMouseEnterArgs, tableId())
        }
      })
    }
  }

  /**
   * <zh/> 清理节流/RAF 资源——onBeforeUnmount 和 onDeactivated 均调用 | <en/> Cleanup throttle/RAF resources — called by both onBeforeUnmount and onDeactivated
   *
   * <zh/> KeepAlive 场景下 onDeactivated 不触发 onBeforeUnmount，若不在此清理，
   * <zh/> 组件重新激活后 timer/rAF 仍指向已失效的 emit 闭包，导致内存泄漏或静默失败。
   * <en/> Under KeepAlive, onDeactivated does NOT trigger onBeforeUnmount; without cleanup here,
   * <en/> timer/rAF would reference stale emit closures after reactivation, causing leaks or silent failures.
   */
  function cleanupTimers(): void {
    if (scrollThrottleTimer !== null) {
      clearTimeout(scrollThrottleTimer)
      scrollThrottleTimer = null
    }
    pendingScrollArgs = null
    if (mouseEnterRafId !== null) {
      cancelAnimationFrame(mouseEnterRafId)
      mouseEnterRafId = null
    }
    latestMouseEnterArgs = null
  }

  onBeforeUnmount(cleanupTimers)
  onDeactivated(cleanupTimers)

  const rendererEventForwarders = {
    rowContextmenu: forward('rowContextmenu'),
    rowDblclick: forward('rowDblclick'),
    currentChange: forward('currentChange'),
    cellMouseEnter: rafBatchedMouseEnterForward,
    cellMouseLeave: forward('cellMouseLeave'),
    cellContextmenu: onCellContextmenu ?? forward('cellContextmenu'),
    headerContextmenu: onHeaderContextmenu ?? forward('headerContextmenu'),
    headerDragend: forward('headerDragend'),
    scroll: throttledScrollForward,
    cellFocused: forward('cellFocused'),
    cellKeyPress: forward('cellKeyPress'),
    cellKeyUp: forward('cellKeyUp'),
  }

  function forwardHeaderClick(params: any) {
    if (interceptor.trigger('event.headerClick', params as InterceptorHeaderClickParams))
      return
    forward('headerClick')(params)
  }

  /** 剪贴板逻辑由 table.vue 通过 options.clipboard 注入 */
  const { handleClipboardCopy, handleClipboardCut, handleClipboardPaste } = clipboard

  /**
   * <zh/> 键盘快捷键处理器表——新增快捷键只需在此添加一条，符合开闭原则 | <en/> Keyboard shortcut handler table — adding a shortcut only requires one entry here, following open-closed principle
   */
  interface KeyHandler {
    /** 返回 true 表示该处理器匹配当前按键 | <en/> Return true if this handler matches the current key */
    match: (e: KeyboardEvent) => boolean
    /** 处理按键，返回 true 表示已消费（不再 forward） | <en/> Handle key, return true if consumed (no forward) */
    handle: (params: any, e: KeyboardEvent) => boolean
  }

  const keyHandlers: KeyHandler[] = [
    {
      match: e => (e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey,
      handle: () => {
        if (!edit.editConfig?.()?.enableUndo)
          return false
        edit.undo?.()
        return true
      },
    },
    {
      match: e => (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && e.shiftKey,
      handle: () => {
        if (!edit.editConfig?.()?.enableUndo)
          return false
        edit.redo?.()
        return true
      },
    },
    {
      match: e => e.key === 'F2',
      handle: (params) => {
        if (!edit.editConfig?.()?.enableCellEditingOnF2)
          return false
        return tryStartEditing(params)
      },
    },
    {
      match: e => e.key === 'Backspace',
      handle: (params) => {
        if (!edit.editConfig?.()?.enableCellEditingOnBackspace)
          return false
        if (!tryStartEditing(params))
          return false
        const column = params?.column
        // <zh/> 身份域：经 columnByKeyMap（prop 主键 + key 别名）查询，统一走 getColumnKey
        // <en/> Identity domain: queried via columnByKeyMap (prop primary + key alias), unified via getColumnKey
        const colKey = column ? getColumnKey(column) : ''
        if (colKey) {
          // 列级 emptyValue 配置——数字列可设为 null/undefined，默认 '' | Column-level emptyValue config — numeric columns can set null/undefined, defaults to ''
          const emptyVal = (column as Record<string, unknown>)?.emptyValue ?? ''
          edit.updateCellEditingValue(colKey, emptyVal)
        }
        return true
      },
    },
    {
      match: e => (e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C'),
      handle: (params) => {
        if (!edit.editConfig?.()?.enableClipboard)
          return false
        if (isCellEditingByParams(params))
          return false
        handleClipboardCopy(params)
        return true
      },
    },
    {
      match: e => (e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X'),
      handle: (params) => {
        if (!edit.editConfig?.()?.enableClipboard)
          return false
        if (isCellEditingByParams(params))
          return false
        handleClipboardCut(params)
        return true
      },
    },
    {
      match: e => (e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V'),
      handle: (params) => {
        if (!edit.editConfig?.()?.enableClipboard)
          return false
        if (isCellEditingByParams(params))
          return false
        handleClipboardPaste(params)
        return true
      },
    },
  ]

  /**
   * <zh/> 编辑态守卫——目标单元格处于编辑中时放行原生剪贴板操作，
   * <zh/> 避免表格级 Ctrl+C/X/V 劫持输入框内的复制/粘贴。
   * <en/> Editing-state guard — when the target cell is being edited, let native
   * <en/> clipboard actions pass through, so table-level Ctrl+C/X/V never hijacks
   * <en/> copy/paste inside the editor input.
   */
  function isCellEditingByParams(params: any): boolean {
    const rowIndex = params?.rowIndex ?? params?.rowIndexProp
    const column = params?.column
    // <zh/> 身份域：统一走 getColumnKey，与 columnByKeyMap 口径一致
    // <en/> Identity domain: unified via getColumnKey, consistent with columnByKeyMap
    const colKey = column ? getColumnKey(column) : ''
    if (rowIndex == null || !colKey)
      return false
    return edit.isCellEditing(rowIndex, colKey)
  }

  function forwardCellKeyDown(params: any) {
    if (interceptor.trigger('event.keydown', params as InterceptorKeydownParams<T>))
      return

    const keyboardEvent = params?.event as KeyboardEvent | undefined
    if (keyboardEvent) {
      for (const handler of keyHandlers) {
        if (handler.match(keyboardEvent) && handler.handle(params, keyboardEvent))
          return
      }
    }

    forward('cellKeyDown')(params)
  }

  function tryStartEditing(params: any): boolean {
    const row = params?.rowData
    const column = params?.column
    if (!column || !row)
      return false
    // <zh/> 身份域与数据域分离：身份走 getColumnKey（key → prop → property）查列，
    // <zh/> 数据字段走 resolveColumnProp（prop → property），key!==prop 时禁止把 key 当 prop 写。
    // <en/> Split identity vs data domain: identity via getColumnKey for lookup,
    // <en/> data field via resolveColumnProp; never write key as prop when key!==prop.
    const colKey = getColumnKey(column)
    if (!colKey)
      return false
    const rowIndex = resolveRowIndex(params, row)
    if (rowIndex < 0)
      return false
    const col = pipeline.columnByKey().get(colKey)
    if (!col || !edit.isColumnEditable(col))
      return false
    const dataProp = resolveColumnProp(col as unknown as Record<string, any>) ?? colKey
    const canonicalKey = getColumnKey(col as unknown as Record<string, any>) || colKey
    edit.startEditing({ rowIndex, prop: dataProp, columnKey: (col as ProcessedColumn).key ?? canonicalKey, value: (row as Record<string, unknown>)[dataProp] })
    return true
  }

  /**
   * <zh/> 检测鼠标事件是否发生在 checkbox/radio 上——从 rowClick handler 提取，降低其圈复杂度
   * <en/> Detect whether a mouse event originated from a checkbox/radio rowClick handler to reduce its cyclomatic complexity
   */
  function isCheckboxOrRadioInput(event: MouseEvent | undefined): boolean {
    const target = event?.target as HTMLElement | undefined
    if (!target)
      return false
    return (target.tagName === 'INPUT'
      && ((target as HTMLInputElement).type === 'checkbox' || (target as HTMLInputElement).type === 'radio'))
    // <zh/> 命名空间无关的子串匹配（见 ep-selectors.ts 注记） | <en/> Namespace-agnostic substring matching (see the ep-selectors.ts note)
    || !!target.closest(EP_ANY_CHECKABLE_SELECTOR)
  }

  /**
   * <zh/> 解析渲染器列对象为 ProcessedColumn —— ElTable 内部将 prop 重命名为 property，需统一解析。
   * <zh/> `property` 优先（渲染时身份），未命中再回退 `getColumnKey`（key → prop）；columnByKeyMap 已三注册（prop 主键 + key/property 别名）。
   * <en/> Resolve renderer column object to ProcessedColumn — ElTable internally renames prop to property, requires unified resolution.
   * <en/> `property` first (render-time identity), falling back to `getColumnKey` (key → prop); columnByKeyMap triple-registers (prop primary + key/property aliases).
   */
  function resolveColumnFromParams(params: any): ProcessedColumn | undefined {
    const eventColumn = params.column
    if (!eventColumn)
      return undefined
    const byProperty = typeof eventColumn.property === 'string' && eventColumn.property !== ''
      ? pipeline.columnByKey().get(eventColumn.property)
      : undefined
    if (byProperty)
      return byProperty
    const colKey = getColumnKey(eventColumn)
    return colKey ? pipeline.columnByKey().get(colKey) : undefined
  }

  const rendererEventHandlers = {
    rowClick(params: any) {
      if (interceptor.trigger('event.rowClick', params as InterceptorRowClickParams<T>))
        return
      // <zh/> 行选中逻辑——与事件转发分离，先处理选择再转发 | <en/> Row selection logic — separated from event forwarding, handle selection first then forward
      if (selection.selectionState && selection.hasSelection() && !selection.suppressRowClickSelection()) {
        const row = params?.rowData
        const event = params?.event as MouseEvent | undefined
        // 合成行（组头/详情/总计）不可选中，与 checkbox 单元格守卫对齐（单一源）
        const isSynthetic = isSyntheticRow(row)
        if (row && !isSynthetic && !isCheckboxOrRadioInput(event) && selection.rowClickSelect()) {
          selection.selectionState.toggleRowSelection(row, undefined, false, {
            shiftKey: event?.shiftKey || false,
            ctrlKey: event?.ctrlKey || event?.metaKey || false,
          })
        }
      }
      forward('rowClick')(params)
    },
    cellClick(params: any) {
      if (interceptor.trigger('event.cellClick', params as InterceptorCellClickParams<T>))
        return
      const col = resolveColumnFromParams(params)
      if (col?.onCellClick) {
        col.onCellClick({ row: params.rowData, rowIndex: params.rowIndex, column: col, event: params.event })
      }
      if (edit.editConfig()?.singleClickEdit) {
        tryStartEditing(params)
      }
      forward('cellClick')(params)
    },
    cellDblclick(params: any) {
      if (interceptor.trigger('event.cellDblclick', params as InterceptorCellClickParams<T>))
        return
      const col = resolveColumnFromParams(params)
      if (col?.onCellDoubleClick) {
        col.onCellDoubleClick({ row: params.rowData, rowIndex: params.rowIndex, column: col, event: params.event })
      }
      if (!edit.editConfig()?.singleClickEdit) {
        tryStartEditing(params)
      }
      forward('cellDblclick')(params)
    },
    toggleColumnGroupCollapse: pipeline.toggleCollapse,
  }

  const rendererEvents = markRawTyped({
    ...rendererEventForwarders,
    headerClick: forwardHeaderClick,
    cellKeyDown: forwardCellKeyDown,
    ...rendererEventHandlers,
  })

  return {
    rendererEvents,
  }
}
