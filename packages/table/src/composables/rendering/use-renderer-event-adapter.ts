import type { ComputedRef, Ref } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { CellLocator } from '../../types/cell-locator'
import type { TableHoverLayerApi } from '../../types/config-api'
import type {
  CellFocusedEventPayload,
  CellKeyboardEventPayload,
  CellMouseEventPayload,
  UseCellEventsOptions,
} from './use-cell-events'
import { provide } from 'vue'
import { advTableHoverLayerKey } from '../../types/injection-keys'
import { useCellEvents } from './use-cell-events'

/**
 * <zh/> 渲染器单元格事件转发回调集合
 *
 * <zh/> 两种渲染器（default / virtual）需转发的事件名一致，差异仅在是否启用鼠标事件。
 * <zh/> 通过此接口收敛事件名，避免拼写漂移。
 *
 * <en/> Renderer cell-event forward callbacks
 *
 * <en/> Both renderers (default / virtual) forward the same event names; the only difference is whether mouse events are enabled.
 * <en/> This interface consolidates event names to prevent spelling drift.
 */
export interface RendererCellEventEmit {
  (event: 'cellFocused', payload: CellFocusedEventPayload): void
  (event: 'cellKeyDown', payload: CellKeyboardEventPayload): void
  (event: 'cellKeyPress', payload: CellKeyboardEventPayload): void
  (event: 'cellKeyUp', payload: CellKeyboardEventPayload): void
  (event: 'cellClick', payload: CellMouseEventPayload): void
  (event: 'cellDblclick', payload: CellMouseEventPayload): void
  (event: 'cellContextmenu', payload: CellMouseEventPayload): void
}

export interface UseRendererCellEventsOptions<T> {
  /** <zh/> 表格容器 DOM 引用 | <en/> Table container DOM ref */
  containerRef: Ref<HTMLElement | null>
  /** <zh/> 合并后的叶子列（selection + normal） | <en/> Merged leaf columns (selection + normal) */
  columns: ComputedRef<ProcessedColumn[]>
  /** <zh/> 表格数据 | <en/> Table data */
  data: ComputedRef<T[]>
  /** <zh/> 单元格定位器（由渲染器各自提供） | <en/> Cell locator (provided by each renderer) */
  locator: CellLocator
  /** <zh/> 事件转发函数（通常为渲染器组件的 emit） | <en/> Event forwarder (typically the renderer component's emit) */
  emit: RendererCellEventEmit
  /**
   * <zh/> 是否转发鼠标事件（click / dblclick / contextmenu）
   * <zh/> - default 渲染器：ElTable 原生事件已覆盖，关闭以避免重复触发
   * <zh/> - virtual 渲染器：ElTableV2 不分发单元格级鼠标事件，需开启以补齐
   *
   * <en/> Whether to forward mouse events (click / dblclick / contextmenu)
   * <en/> - default renderer: ElTable native events already cover them, disabled to avoid duplicate triggers
   * <en/> - virtual renderer: ElTableV2 does not dispatch cell-level mouse events, enabled to fill the gap
   * @default false
   */
  enableMouseEvents?: boolean
  /** <zh/> 是否启用单元格事件监听，透传至 useCellEvents | <en/> Whether to enable cell event listeners, passed through to useCellEvents */
  enabled?: UseCellEventsOptions<T>['enabled']
}

/**
 * <zh/> 渲染器单元格事件适配器——收敛 default/virtual 渲染器中重复的 cellFocused/cellKeyDown/cellKeyPress/cellKeyUp 转发逻辑
 * <en/> Renderer cell-events adapter — consolidates duplicated cellFocused/cellKeyDown/cellKeyPress/cellKeyUp forwarders across default/virtual renderers
 *
 * @remarks
 * <zh/> 四回调均为纯转发 `payload => emit('xxx', payload)`，此 composable 收敛为单点定义，`enableMouseEvents` 开关控制鼠标事件转发。
 * <en/> All four callbacks are pure forwarders `payload => emit('xxx', payload)`; this composable unifies them, with `enableMouseEvents` toggling mouse-event forwarding.
 *
 * @example
 * ```ts
 * // default / virtual 仅 containerRef / columns / data / locator 不同；virtual 加 enableMouseEvents: true
 * useRendererCellEvents({ containerRef, columns, data, locator, emit, enableMouseEvents: isVirtual })
 * ```
 */
export function useRendererCellEvents<T>(options: UseRendererCellEventsOptions<T>): void {
  const {
    containerRef,
    columns,
    data,
    locator,
    emit,
    enableMouseEvents = false,
    enabled,
  } = options

  const baseOptions: UseCellEventsOptions<T> = {
    containerRef,
    columns,
    data,
    locator,
    enabled,
    onCellFocused: payload => emit('cellFocused', payload),
    onCellKeyDown: payload => emit('cellKeyDown', payload),
    onCellKeyPress: payload => emit('cellKeyPress', payload),
    onCellKeyUp: payload => emit('cellKeyUp', payload),
  }

  if (enableMouseEvents) {
    baseOptions.onCellClick = payload => emit('cellClick', payload)
    baseOptions.onCellDblclick = payload => emit('cellDblclick', payload)
    baseOptions.onCellContextmenu = payload => emit('cellContextmenu', payload)
  }

  useCellEvents<T>(baseOptions)
}

export interface UseHoverLayerProviderOptions {
  /** <zh/> hover 层 API 对象（与 provide 的内容一致） | <en/> Hover layer API object (identical to what is provided) */
  api: TableHoverLayerApi
}

/**
 * <zh/> Hover 层 provider 适配器——收敛 default / virtual 渲染器中完全重复的 provide 逻辑。
 *
 * <zh/> 提取后渲染器只需声明 api 对象，由本 composable 统一发布。
 *
 * <en/> Hover-layer provider adapter — consolidates the duplicated provide logic across default / virtual renderers.
 *
 * <en/> After extraction, renderers only declare the api object, and this composable handles publishing.
 */
export function useHoverLayerProvider(options: UseHoverLayerProviderOptions): void {
  const { api } = options

  provide(advTableHoverLayerKey, api)
}
