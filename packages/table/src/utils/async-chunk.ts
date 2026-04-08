/**
 * <zh/> 异步 chunk 加载失败处理——`defineAsyncComponent` 的 onError / errorComponent 共享装配。
 * <zh/> chunk 加载失败（发版后 hash 变更而用户持有旧页面、CDN 抖动、拦截插件）时，
 * <zh/> Vue 默认行为是静默渲染空节点且缓存已拒绝的 promise（重渲染不重试）。
 * <en/> Shared onError / errorComponent assembly for async chunk loading.
 * <en/> Vue silently renders nothing and caches the rejection on chunk load failure — this module
 * <en/> adds bounded retry, console diagnostics and a visible fallback instead.
 */
import type { FunctionalComponent } from 'vue'
import { h } from 'vue'

/** <zh/> chunk 加载失败最大重试次数（不含首次尝试） | <en/> Max retries for chunk load failure (excluding the first attempt) */
export const ASYNC_CHUNK_MAX_RETRIES = 2

/**
 * <zh/> 生成 chunk 加载的 onError 回调：预算内重试，用尽后记 console.error、调 onFinalFail 并 fail。
 * <en/> Build a chunk-load onError callback: retry within budget, then console.error, onFinalFail and fail.
 */
export function createChunkLoadOnError(
  source: string,
  onFinalFail?: (error: unknown) => void,
): (error: Error, retry: () => void, fail: () => void, attempts: number) => void {
  return (error, retry, fail, attempts) => {
    if (attempts <= ASYNC_CHUNK_MAX_RETRIES) {
      retry()
      return
    }
    console.error(`[AdvTable] async chunk load failed (${source}):`, error)
    onFinalFail?.(error)
    fail()
  }
}

/**
 * <zh/> chunk 加载失败兜底 UI——`role="alert"` 可访问，直显技术错误信息供排查；
 * <zh/> 本地化消息经 TABLE_RENDER_ERROR 事件通道（调用方接 handleError），此处不硬编码文案。
 * <en/> Chunk-load failure fallback UI — accessible via `role="alert"`, shows the technical error
 * <en/> for diagnosis; localized copy flows through the TABLE_RENDER_ERROR event channel instead.
 */
export const AsyncChunkLoadError: FunctionalComponent<{ error?: unknown }> = (props) => {
  const message = props.error instanceof Error ? props.error.message : String(props.error ?? '')
  return h('div', { class: 'adv-table__async-load-error', role: 'alert' }, message)
}
