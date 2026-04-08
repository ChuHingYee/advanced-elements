import type { RowBeforeDrag } from './use-row-drag'
import { devWarn, devWarnRepeat } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'

/**
 * Drag guard session, owned by the gesture closure (setupDraggable), mutated through
 * runBeforeDragGuard and the gesture handlers. Replaces two closure lets (dragVersion /
 * isDragCommitting) with one explicit object so the guard module never reaches back
 * into its caller. 拖拽守卫会话,归手势闭包所有,消除跨模块反向注入.
 */
export interface DragGuardSession {
  /** Drag gesture version, bumped on every onStart/abort to void pending async guards. 手势版本号. */
  version: number
  /** Whether a beforeDrag guard is awaiting (default/suppressMove paths). 守卫等待中标志. */
  committing: boolean
}

export function createDragGuardSession(): DragGuardSession {
  return { version: 0, committing: false }
}

export interface BeforeDragGuardContext<T> {
  sourceRow: T
  sourceIndex: number
  targetRow: T
  targetIndex: number
  fullData: T[]
}

export interface RunBeforeDragGuardArgs<T> {
  session: DragGuardSession
  beforeDrag?: RowBeforeDrag<T>
  getBeforeDrag?: () => RowBeforeDrag<T> | undefined
  ctx: BeforeDragGuardContext<T>
  /** Latest full data reader for the freshness check (=== against the drop-time snapshot). 最新全量数据读取器. */
  getCurrentData: () => T[]
  onCommit: () => void
  onReject?: () => void
  /** <zh/> 是否置起 committing 标志（default/suppressMove 路径需要，virtual 路径不需要） | <en/> Whether to raise the committing flag (default/suppressMove paths need it, virtual does not) */
  useCommitFlag?: boolean
  onError?: (err: unknown, phase: 'beforeDrag' | 'commit') => void
}

/**
 * Unified beforeDrag async guard, version race protection plus Promise.resolve with
 * reject/commit/error branches. Shared by the row-drag setupDraggable.
 * 统一 beforeDrag 异步守卫。
 */
export function runBeforeDragGuard<T>(args: RunBeforeDragGuardArgs<T>): void {
  const { session, ctx, getCurrentData, onCommit, onReject, useCommitFlag, onError } = args
  const versionAtCall = session.version
  try {
    const beforeDrag = args.getBeforeDrag ? args.getBeforeDrag() : args.beforeDrag
    // 空检查在置位之前——无回调时直接返回，避免 committing 泄漏为 true
    // 使后续所有拖拽被误判为"提交中"而拒绝。
    // Null-check BEFORE setting committing — returning early with no callback must not
    // leak committing=true, which would make every later drag look "in commit".
    if (!beforeDrag)
      return
    if (useCommitFlag)
      session.committing = true
    const shouldContinue = beforeDrag(ctx)
    Promise.resolve(shouldContinue).then((result) => {
      if (versionAtCall !== session.version) {
        if (useCommitFlag)
          session.committing = false
        return
      }
      if (useCommitFlag)
        session.committing = false
      if (result === false) {
        onReject?.()
        return
      }
      /**
       * Data freshness guard: if the full dataset was replaced externally during the
       * async beforeDrag window (refresh/sort/filter/edit commits all produce new array
       * references), the drop-time snapshot is stale, committing would overwrite new
       * data with stale ordering. Abort and take the reject branch.
       * 数据新鲜度守卫,快照过期则中止并走回滚分支.
       */
      if (getCurrentData() !== ctx.fullData) {
        if (isDev)
          devWarn('[useRowDrag] data changed during async beforeDrag validation, reorder aborted')
        onReject?.()
        return
      }
      onCommit()
    }).catch((err: unknown) => {
      if (useCommitFlag)
        session.committing = false
      onReject?.()
      onError?.(err, 'beforeDrag')
    })
  }
  catch (err: unknown) {
    if (useCommitFlag)
      session.committing = false
    // Unified dev channel (instead of raw console.error); structured errors go via onError.
    // 统一走 dev 通道,结构化错误仍经 onError 透出.
    if (isDev) {
      if (err instanceof Error) {
        devWarnRepeat('[useRowDrag] beforeDrag 执行异常:', err.message)
      }
      else {
        devWarnRepeat('[useRowDrag] beforeDrag 执行异常:', err)
      }
    }
    onError?.(err, 'beforeDrag')
  }
}
