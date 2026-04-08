import type { AdvTableForwardEmitFn } from '../../composables/rendering/use-table-renderer-events'

/**
 * <zh/> 事件绑定配置——允许在事件转发前注入预处理回调
 *
 * <en/> Event binding configuration — allows injecting pre-emit callbacks before event forwarding
 */
export interface EventBindingOptions {
  /** <zh/> 事件转发函数 | <en/> Event forwarding function */
  emit: AdvTableForwardEmitFn
  /**
   * <zh/> headerDragend 前置回调——在 emit('headerDragend') 之前调用
   * <zh/> 用于触发列状态刷新（如 localColumns shallowRef 引用更新）
   * <en/> Pre-emit callback for headerDragend — called before emit('headerDragend')
   * <en/> Used to trigger column state refresh (e.g. localColumns shallowRef reference update)
   */
  onHeaderDragEnd?: (params: unknown) => void
}

/**
 * <zh/> 将 onHeaderDragEnd 回调注入已有事件对象，返回新的事件对象（不修改原对象）
 *
 * <en/> Inject onHeaderDragEnd callback into existing event object, returns a new event object (does not mutate the original)
 *
 * @param rendererEvents - <zh/> 原始渲染器事件对象 | <en/> original renderer events object
 * @param options - <zh/> 事件绑定配置 | <en/> event binding configuration
 * @returns <zh/> 新的渲染器事件对象 | <en/> new renderer events object
 */
export function withHeaderDragEndHandler(
  rendererEvents: Record<string, (...args: any[]) => void>,
  options: EventBindingOptions,
): Record<string, (...args: any[]) => void> {
  const originalHeaderDragend = rendererEvents.headerDragend
  return {
    ...rendererEvents,
    headerDragend: (...args: any[]) => {
      options.onHeaderDragEnd?.(args[0])
      originalHeaderDragend?.(...args)
    },
  }
}
