import type { Ref } from 'vue'
import type { TableError } from '../../types/error'
import { onErrorCaptured, ref } from 'vue'

export interface UseRenderErrorBoundaryOptions {
  /** <zh/> 是否启用捕获，禁用时错误继续向上冒泡。默认 true | <en/> Whether to enable capture, when disabled errors continue to bubble up. Default true */
  enabled?: boolean
  /** <zh/> 捕获到渲染错误时的回调，由调用方统一走 emit 派发（避免 composable 直接触碰 emits） | <en/> Callback when a render error is caught, dispatched via emit by the caller (avoids composable directly touching emits) */
  onError?: (error: TableError) => void
}

export interface UseRenderErrorBoundaryReturn {
  /** <zh/> 是否已进入错误兜底态 | <en/> Whether the error fallback state has been entered */
  hasError: Ref<boolean>
  /** <zh/> 首错的结构化错误（首错胜出，reset 前保持同一引用，供兜底 UI 展示） | <en/> First-caught structured error (first wins, referentially stable until reset; shown by fallback UI) */
  errorInfo: Ref<TableError | null>
  /** <zh/> 父级重试时手动重置状态 | <en/> Manually reset state when parent retries */
  reset: () => void
}

/**
 * 渲染错误边界：捕获调用方组件【全体后代】在渲染/生命周期中抛出的错误，
 * 转为结构化 {@link TableError}（code: TABLE_RENDER_ERROR），避免自定义插槽或列渲染器
 * 抛错导致整页崩溃或静默渲染错乱 DOM。
 *
 * 响应式：hasError/errorInfo 为普通 ref，仅在错误发生时翻转一次；
 * 副作用：仅注册 onErrorCaptured 生命周期钩子，无全局监听、无定时器，组件卸载自动解绑。
 * 注意：仅捕获【后代渲染/生命周期】错误，事件回调/异步（setTimeout/fetch）抛错不在此范围——
 * 后者由 use-table-request 的 try/catch 覆盖，二者互不重叠。
 *
 * @example
 * ```ts
 * const { hasError, errorInfo } = useRenderErrorBoundary({
 *   onError: (e) => emit('error', e),
 * })
 * ```
 */
export function useRenderErrorBoundary(
  options: UseRenderErrorBoundaryOptions = {},
): UseRenderErrorBoundaryReturn {
  const { enabled = true, onError } = options
  const hasError = ref(false)
  const errorInfo = ref<TableError | null>(null)

  onErrorCaptured((err, _instance, info) => {
    if (!enabled)
      return true

    // <zh/> 3：首错胜出——已进入兜底态后不再重复捕获（否则兜底区外的抛错源每拍重抛、
    // <zh/> errorInfo 换新对象 identity，触发"捕获→重渲染→再抛→再捕获"渲染循环，仅靠 Vue 百次 cap 兜住）。
    // <zh/> reset 后恢复捕获。返回 false 照常阻断冒泡。
    // <en/> 3: first error wins — skip re-capture once in fallback (otherwise a throwing source
    // <en/> outside the fallback rethrows every render with a fresh errorInfo identity, looping
    // <en/> capture→rerender→rethrow→recapture until Vue's update cap). Recapture resumes after reset.
    // <en/> Still returns false to stop propagation.
    if (hasError.value)
      return false

    const payload: TableError = {
      code: 'TABLE_RENDER_ERROR',
      severity: 'error',
      field: info,
      cause: err instanceof Error ? err : new Error(String(err)),
    }
    errorInfo.value = payload
    hasError.value = true
    onError?.(payload)
    return false
  })

  function reset() {
    hasError.value = false
    errorInfo.value = null
  }

  return { hasError, errorInfo, reset }
}
