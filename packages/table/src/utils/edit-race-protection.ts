/**
 * <zh/> 编辑竞态保护配置
 * <en/> Edit race protection configuration
 */
export interface EditRaceProtectionOptions<T> {
  /** <zh/> 数据引用，用于异步操作后检测数据是否已变更 | <en/> Data reference, used to detect if data has changed after an async operation */
  dataRef: { value: T[] }
  /**
   * <zh/> 数据引用变化时调用（如排序/筛选/分页导致索引移位）
   * <zh/> 对应原 use-cell-edit.ts 中 isEditStale → cancelDueToDataChanged 的副作用
   * <en/> Called when data reference changes (e.g. sort/filter/pagination causes index shift)
   * <en/> Corresponds to the isEditStale → cancelDueToDataChanged side-effect in the original use-cell-edit.ts
   */
  onDataChanged?: () => void
}

/**
 * <zh/> 编辑竞态保护工具——管理编辑版本号、组件卸载标志与 pending Promise 串行化
 *
 * <zh/> 从 use-cell-edit.ts 抽取，职责单一化：
 * <zh/> - editVersion 递增标记每次编辑开始/取消，用于异步操作后判断是否过期
 * <zh/> - isUnmounted 防止组件卸载后 pendingCommit 异步回调写入数据
 * <zh/> - pendingCommit/pendingStart Promise 串行化避免 stopEditing→startEditing 竞态
 * <zh/> - isStale 统一三项过期检查（卸载、版本变化、数据引用变化）
 *
 * <en/> Edit race protection utility — manages edit version, component unmount flag, and pending Promise serialization
 *
 * <en/> Extracted from use-cell-edit.ts, single responsibility:
 * <en/> - editVersion increments to mark each edit start/cancel, used to detect staleness after async operations
 * <en/> - isUnmounted prevents pendingCommit async callbacks from writing data after unmount
 * <en/> - pendingCommit/pendingStart Promise serialization avoids stopEditing→startEditing races
 * <en/> - isStale unifies three staleness checks (unmount, version change, data reference change)
 *
 * @param options - <zh/> 竞态保护配置 | <en/> race protection configuration
 * @returns <zh/> 竞态保护控制器 | <en/> race protection controller
 */
export function createEditRaceProtection<T>(options: EditRaceProtectionOptions<T>) {
  const { dataRef, onDataChanged } = options

  /** 编辑版本号——每次 startEditing/cancelEditing 递增，用于异步操作后判断编辑会话是否过期 */
  let editVersion = 0

  /** 组件卸载标志——防止 pendingCommit 异步回调在 unmount 后写入数据 */
  let isUnmounted = false

  /** 正在进行的 commit Promise */
  let pendingCommit: Promise<unknown> | null = null

  /**
   * <zh/> 重提交请求——在途提交尚未落地时又有 stopEditing 到达，记录其原因；
   * <zh/> 在途提交落定后若会话仍活跃，用最新会话值再跑一次提交。多次到达合并为一次。
   * <en/> Restop request — when another stopEditing arrives while a commit is in flight,
   * <en/> record its reason; after the in-flight commit settles, re-run the commit with the
   * <en/> latest session value if the session is still active. Multiple arrivals coalesce.
   */
  let restopRequested: string | null = null

  /** startEditing 串行化链：所有调用按序执行 */
  let pendingStart: Promise<void> | null = null

  return {
    /** <zh/> 递增版本号（新编辑开始/取消时调用） | <en/> Increment version (called on new edit start/cancel) */
    bumpVersion(): void {
      editVersion++
    },

    /** <zh/> 获取当前版本号 | <en/> Get current version */
    get version(): number {
      return editVersion
    },

    /**
     * <zh/> 标记组件已卸载，并递增版本号使所有 pending 的 await 后版本号检查失败
     * <en/> Mark component as unmounted, and increment version to fail all pending post-await version checks
     */
    markUnmounted(): void {
      isUnmounted = true
      editVersion++
    },

    /** <zh/> 是否已卸载 | <en/> Whether unmounted */
    get unmounted(): boolean {
      return isUnmounted
    },

    /** <zh/> 获取/设置 pending commit Promise | <en/> Get/set pending commit Promise */
    get pendingCommit(): Promise<unknown> | null {
      return pendingCommit
    },
    set pendingCommit(v: Promise<unknown> | null) {
      pendingCommit = v
    },

    /** <zh/> 获取/设置重提交请求 | <en/> Get/set restop request */
    get restopRequested(): string | null {
      return restopRequested
    },
    set restopRequested(v: string | null) {
      restopRequested = v
    },

    /** <zh/> 获取/设置 pending start Promise | <en/> Get/set pending start Promise */
    get pendingStart(): Promise<void> | null {
      return pendingStart
    },
    set pendingStart(v: Promise<void> | null) {
      pendingStart = v
    },

    /**
     * <zh/> 异步操作后检查编辑会话是否已过期
     *
     * <zh/> 三种过期条件：组件卸载、editVersion 变化（新编辑开始/取消）、数据引用变化。
     * <zh/> 数据引用变化时自动调用 onDataChanged 回调取消编辑。
     *
     * <en/> Check if the edit session is stale after an async operation
     *
     * <en/> Three staleness conditions: component unmounted, editVersion changed (new edit started/cancelled), data reference changed.
     * <en/> When data reference changes, automatically calls onDataChanged callback to cancel the edit.
     *
     * @param versionBeforeAwait - <zh/> await 前捕获的 editVersion | <en/> editVersion captured before the await
     * @param currentData - <zh/> await 前捕获的数据引用 | <en/> data reference captured before the await
     * @returns <zh/> true 表示已过期，调用方应中止后续操作 | <en/> true if stale, caller should abort
     */
    isStale(versionBeforeAwait: number, currentData: T[]): boolean {
      if (isUnmounted || versionBeforeAwait !== editVersion)
        return true
      if (dataRef.value !== currentData) {
        onDataChanged?.()
        return true
      }
      return false
    },
  }
}

/**
 * <zh/> 编辑竞态保护控制器类型
 * <en/> Edit race protection controller type
 */
export type EditRaceProtection<T> = ReturnType<typeof createEditRaceProtection<T>>
