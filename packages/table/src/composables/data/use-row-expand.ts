import type { ComputedRef, MaybeRefOrGetter, ShallowRef } from 'vue'
import type { DetailRow, RowExpandApi, RowExpandConfig } from '../../types/config'
import { computed, onScopeDispose, shallowRef, toValue, watch } from 'vue'
import { useStableComputed } from '../../utils/composable-helpers'
import { createConcurrencyPool } from '../../utils/concurrency-pool'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { AUTO_KEY_NAME } from '../../utils/normalize-row-key'
import { localStorageAdapter, sessionStorageAdapter } from '../../utils/storage'
import { isDetailRow as isSharedDetailRow, isSyntheticRow } from '../../utils/synthetic-row'

export interface UseRowExpandOptions<T = any> {
  /** <zh/> 行展开配置 | <en/> Row expand config */
  rowExpandConfig: MaybeRefOrGetter<RowExpandConfig | undefined>
  /** <zh/> 数据源 | <en/> Data source */
  data: MaybeRefOrGetter<T[]>
  /** <zh/> 行键函数 | <en/> Row key function */
  rowKeyFn: MaybeRefOrGetter<(row: T) => string>
  /** <zh/> 外部受控的展开集合（用于 includeSynthetic=false 共享） | <en/> External expanded set for includeSynthetic=false sharing */
  expandedRowKeys?: ShallowRef<Set<string | number>>
  /**
   * <zh/> 持久化存储读/写失败时的回调（生产环境降级通知）
   * <zh/> 触发场景：storage 满或不可用、JSON 解析失败、配置异常等
   *
   * <en/> Callback invoked when persistence storage read/write fails (production degradation notification).
   * <en/> Triggered when: storage full or unavailable, JSON parse failure, config exception, etc.
   */
  onStorageError?: (info: RowExpandStorageError) => void
  /**
   * <zh/> 行展开时回调（expanded=true）
   * <en/> Callback when a row is expanded (expanded=true)
   */
  onRowExpand?: (row: T, rowKey: string | number) => void
  /**
   * <zh/> 行折叠时回调（expanded=false）
   * <en/> Callback when a row is collapsed (expanded=false)
   */
  onRowCollapse?: (row: T, rowKey: string | number) => void
}

export interface RowExpandStorageError {
  /** <zh/> 触发阶段：'read' 或 'write' | <en/> Trigger stage: 'read' or 'write' */
  phase: 'read' | 'write'
  /** <zh/> 持久化 key（如有） | <en/> Persistence key (if available) */
  persistenceKey?: string
  /** <zh/> 原始错误对象 | <en/> Original error object */
  cause: unknown
}

export interface UseRowExpandReturn<T = any> {
  /** <zh/> 插入 DetailRow 后的数据 | <en/> Data after inserting DetailRow */
  expandedData: ComputedRef<T[]>
  /** <zh/> 展开行 API | <en/> Row expand API */
  rowExpandApi: RowExpandApi
}

/**
 * <zh/> 在数据管线中为已展开行插入 DetailRow
 * <en/> Insert DetailRow for expanded rows in the data pipeline
 *
 * @remarks
 * <zh/> 遍历数据数组，当某行的 key 在 expandedRowKeys 中时，在该行后面插入一条 DetailRow。渲染器识别 DetailRow 后合并所有列渲染 #expandRow slot 内容
 * <en/> Iterates through the data array, when a row's key is in expandedRowKeys, inserts a DetailRow after that row. Renderer recognizes DetailRow and merges all columns to render the #expandRow slot content
 *
 * @param options - <zh/> 展开行配置和数据源 | <en/> row expand config and data source
 * @returns <zh/> 插入 DetailRow 后的数据和展开行 API | <en/> data after inserting DetailRow and row expand API
 */
export function useRowExpand<T = any>(options: UseRowExpandOptions<T>): UseRowExpandReturn<T> {
  const { rowExpandConfig, data, rowKeyFn, onStorageError, onRowExpand, onRowCollapse } = options

  const expandEnabled = computed(() => toValue(rowExpandConfig)?.enabled ?? false)
  const accordionMode = computed(() => toValue(rowExpandConfig)?.accordion ?? false)
  const loadFn = computed(() => toValue(rowExpandConfig)?.load)

  const expandedRowKeys = options.expandedRowKeys ?? shallowRef<Set<string | number>>(new Set())
  /** 已加载过的行 keys 缓存（load 回调仅首次展开时调用） */
  const loadedRowKeys = shallowRef<Set<string | number>>(new Set())
  /** 正在异步加载的行 keys */
  const loadingRowKeys = shallowRef<Set<string | number>>(new Set())
  /** scope 释放标记：异步 load 完成后不再写状态、不派发事件 */
  let expandDisposed = false
  onScopeDispose(() => {
    expandDisposed = true
  })
  /**
   * load 等待期间用户显式折叠的 keys：await 完成后不再重新展开，
   * 用户最新意图（折叠）优先于旧的展开请求。
   */
  const loadCancelledKeys = new Set<string | number>()
  /** 公开 key 入口归一化：内部状态只存 string（rowKeyFn 恒返回 string，见） */
  function normalizeExpandKey(key: string | number): string {
    return String(key)
  }
  function isSyntheticExpandRow(row: unknown): boolean {
    return isSyntheticRow(row)
  }

  /** 持久化存储辅助——经统一适配器网关，避免直连 Web Storage */
  function getPersistenceAdapter(): import('../../types/column-state').AdvTableStorageAdapter | null {
    const config = toValue(rowExpandConfig)?.persistence
    if (!config)
      return null
    return config.storage === 'sessionStorage' ? sessionStorageAdapter : localStorageAdapter
  }

  function saveToPersistence(keys: Set<string | number>) {
    const config = toValue(rowExpandConfig)?.persistence
    const adapter = getPersistenceAdapter()
    if (!config || !adapter)
      return
    try {
      const result = adapter.set(config.key, JSON.stringify([...keys]))
      if (result instanceof Promise)
        void result.catch(() => {})
    }
    catch (err) {
      // storage 满或不可用：dev 模式 warn，并通过 onStorageError 回调派发结构化错误
      // storage full or unavailable: dev warn + emit structured error via onStorageError callback
      if (isDev && typeof console !== 'undefined') {
        devWarn(`[AdvTable] Failed to persist expanded row keys to storage (key="${config.key}")`, err)
      }
      onStorageError?.({
        phase: 'write',
        persistenceKey: config.key,
        cause: err,
      })
    }
  }

  function loadFromPersistence(): Set<string | number> | null {
    const config = toValue(rowExpandConfig)?.persistence
    const adapter = getPersistenceAdapter()
    if (!config || !adapter)
      return null
    try {
      const storedValueOrPromise = adapter.get(config.key)
      if (storedValueOrPromise instanceof Promise)
        return null
      const storedValue = storedValueOrPromise
      if (!storedValue)
        return null
      const parsed = JSON.parse(storedValue)
      // 持久化数据里的 key 同样归一化（历史数据可能是 number）
      if (Array.isArray(parsed))
        return new Set(parsed.map(k => normalizeExpandKey(k)))
    }
    catch (err) {
      // 解析失败或 storage 不可读：dev 模式 warn，并通过 onStorageError 回调派发结构化错误
      // Parse failure or storage unreadable: dev warn + emit structured error via onStorageError callback
      if (isDev && typeof console !== 'undefined') {
        devWarn(`[AdvTable] Failed to load persisted expanded row keys from storage (key="${config.key}")`, err)
      }
      onStorageError?.({
        phase: 'read',
        persistenceKey: config.key,
        cause: err,
      })
    }
    return null
  }

  /**
   * <zh/> 稳定化的配置属性快照——使用 useStableComputed 做浅相等短路，
   * <zh/> 避免父组件传递全新同值内联对象时触发不必要的 watcher 重置。
   * <en/> Stabilized config-property snapshot — uses useStableComputed for shallow-equality short-circuit,
   * <en/> preventing unnecessary watcher resets when parent passes a new inline object with same values.
   */
  const trackedConfig = useStableComputed(() => {
    const config = toValue(rowExpandConfig)
    if (!config)
      return null
    return { enabled: config.enabled, defaultExpanded: config.defaultExpandedRowKeys, accordion: config.accordion, persistenceKey: config.persistence?.key }
  })

  watch(
    trackedConfig,
    (tracked) => {
      if (!tracked)
        return
      // 优先从持久化存储恢复，其次使用 defaultExpandedRowKeys
      const persisted = loadFromPersistence()
      if (persisted) {
        expandedRowKeys.value = persisted
      }
      else {
        const config = toValue(rowExpandConfig)!
        expandedRowKeys.value = new Set((config.defaultExpandedRowKeys ?? []).map(normalizeExpandKey))
      }
    },
    { immediate: true },
  )

  /** expandedRowKeys 变更时自动持久化 */
  // <zh/> 点燃链：trackedConfig 变化 → 回填 expandedRowKeys → 本 watcher 写存储 → expandedData 向下游派生（配置抖动时依次点燃）
  // <en/> Ignition chain: trackedConfig change → refill expandedRowKeys → this watcher persists → expandedData derives downstream
  watch(expandedRowKeys, (keys) => {
    saveToPersistence(keys)
  })

  /**
   * <zh/> 根据 rowKey 查找对应的行数据
   * <en/> Find the row data by rowKey
   */
  function findRowByKey(rowKey: string | number): T | undefined {
    const normalized = normalizeExpandKey(rowKey)
    const keyFn = toValue(rowKeyFn)
    return toValue(data).find((r) => {
      if (isSharedDetailRow(r))
        return false
      // 两侧都归一化——rowKeyFn 可能返回 number
      return normalizeExpandKey(keyFn(r)) === normalized
    })
  }

  /**
   * <zh/> 统一的展开/折叠事件派发辅助函数
   * <zh/> 消除 toggleRowExpand / expandDetailRow / collapseDetailRow 中的重复 findRowByKey + onRowExpand/onRowCollapse 调用
   *
   * <en/> Unified expand/collapse event dispatch helper
   * <en/> Eliminates duplicated findRowByKey + onRowExpand/onRowCollapse calls across toggleRowExpand / expandDetailRow / collapseDetailRow
   *
   * @param rowKey - <zh/> 行 key | <en/> row key
   * @param expanded - <zh/> true=展开事件, false=折叠事件 | <en/> true=expand event, false=collapse event
   */
  function emitExpandEvent(rowKey: string | number, expanded: boolean): void {
    const row = findRowByKey(rowKey)
    if (!row)
      return
    if (expanded)
      onRowExpand?.(row, rowKey)
    else
      onRowCollapse?.(row, rowKey)
  }

  async function toggleRowExpand(rowKey: string | number) {
    const normalizedKey = normalizeExpandKey(rowKey)
    if (expandedRowKeys.value.has(normalizedKey)) {
      const keys = new Set(expandedRowKeys.value)
      keys.delete(normalizedKey)
      if (loadingRowKeys.value.has(normalizedKey))
        loadCancelledKeys.add(normalizedKey)
      expandedRowKeys.value = keys
      emitExpandEvent(normalizedKey, false)
      return
    }

    // 异步加载：首次展开时调用 load 回调
    const load = loadFn.value
    /**
     * <zh/> 加载中闸门——loadingRowKeys 仅供 UI 展示不足以拦截，
     * <zh/> 双击展开箭头会对同一行并发触发两次 load（重复请求 + 竞态写 loadedRowKeys）。
     * <en/> Loading gate — exporting loadingRowKeys for UI spinners alone cannot intercept;
     * <en/> double-clicking the expander runs `load` twice concurrently (duplicate request +
     * <en/> racing writes into loadedRowKeys).
     */
    if (load && !loadedRowKeys.value.has(normalizedKey)) {
      if (loadingRowKeys.value.has(normalizedKey))
        return
      const row = findRowByKey(normalizedKey)
      if (row) {
        const loadingKeys = new Set(loadingRowKeys.value)
        loadingKeys.add(normalizedKey)
        loadingRowKeys.value = loadingKeys

        // 对外 load 回调拿到**原始类型**的 key（rowKeyFn 返回什么就是什么），
        // 内部状态仍只存归一化 string
        const rawKey = toValue(rowKeyFn)(row)
        try {
          await load(row, rawKey)
        }
        finally {
          if (!expandDisposed) {
            const updatedLoadingKeys = new Set(loadingRowKeys.value)
            updatedLoadingKeys.delete(normalizedKey)
            loadingRowKeys.value = updatedLoadingKeys
          }
        }

        // 卸载后不再写状态、不派发事件；等待期间用户已折叠则尊重最新意图，不再展开
        if (expandDisposed)
          return
        if (loadCancelledKeys.has(normalizedKey)) {
          loadCancelledKeys.delete(normalizedKey)
          return
        }

        const updatedLoadedKeys = new Set(loadedRowKeys.value)
        updatedLoadedKeys.add(normalizedKey)
        loadedRowKeys.value = updatedLoadedKeys
      }
    }

    if (expandDisposed)
      return
    if (loadCancelledKeys.has(normalizedKey)) {
      loadCancelledKeys.delete(normalizedKey)
      return
    }
    // await 后重读最新 Set：不用 await 前的快照，避免旧请求覆盖用户中途的折叠/全收
    if (accordionMode.value) {
      expandedRowKeys.value = new Set([normalizedKey])
      emitExpandEvent(normalizedKey, true)
      return
    }
    const latestKeys = new Set(expandedRowKeys.value)
    latestKeys.add(normalizedKey)
    expandedRowKeys.value = latestKeys
    emitExpandEvent(normalizedKey, true)
  }

  /**
   * <zh/> 同步展开指定行——不调用异步 load、不查 loadedRowKeys。
   * <zh/> 与 toggleRowExpand（懒加载全路径）的语义分叉是刻意的：编程式预置展开（如从 URL 恢复）
   * <zh/> 不应触发网络请求；需懒加载请调用 toggleRowExpand。
   * <en/> Synchronously expand the given row — never calls async load, never consults loadedRowKeys.
   * <en/> The semantic split from toggleRowExpand (the full lazy path) is deliberate: programmatic
   * <en/> preset expansion (e.g. restoring from URL) must not fire network requests; use
   * <en/> toggleRowExpand when lazy loading is wanted.
   */
  function expandDetailRow(rowKey: string | number) {
    const normalizedKey = normalizeExpandKey(rowKey)
    if (expandedRowKeys.value.has(normalizedKey))
      return
    loadCancelledKeys.delete(normalizedKey)
    if (accordionMode.value) {
      expandedRowKeys.value = new Set([normalizedKey])
    }
    else {
      const keys = new Set(expandedRowKeys.value)
      keys.add(normalizedKey)
      expandedRowKeys.value = keys
    }
    emitExpandEvent(normalizedKey, true)
  }

  function collapseDetailRow(rowKey: string | number) {
    const normalizedKey = normalizeExpandKey(rowKey)
    if (loadingRowKeys.value.has(normalizedKey))
      loadCancelledKeys.add(normalizedKey)
    if (!expandedRowKeys.value.has(normalizedKey))
      return
    const keys = new Set(expandedRowKeys.value)
    keys.delete(normalizedKey)
    expandedRowKeys.value = keys
    emitExpandEvent(normalizedKey, false)
  }

  function expandAllDetailRows() {
    if (expandDisposed)
      return
    const rowKeyResolver = toValue(rowKeyFn)
    const rows = toValue(data)
    const keys = new Set<string | number>()
    for (const row of rows) {
      // 只处理业务数据行：跳过全部 synthetic 行（detail/group/total），避免业务 load(groupHeader)
      // 且不在组头后插入空 DetailRow（最小修复）
      if (isSyntheticExpandRow(row))
        continue
      keys.add(normalizeExpandKey(rowKeyResolver(row)))
    }
    expandedRowKeys.value = keys

    /**
     * <zh/> 懒加载行逐个触发 load 回调——仅加 key 而不触发 load 会让 UI 显示"已展开的空内容"。
     * <zh/> 仅对未加载过的行（不在 loadedRowKeys 中）调用 load，避免重复加载。
     * <en/> Trigger load callback for lazy-loaded rows — adding keys alone would render
     * <en/> "expanded empty content". Only call load for rows not yet loaded (not in loadedRowKeys).
     */
    const load = loadFn.value
    if (load) {
      /**
       * <zh/> 并发池化批量懒加载（limit=4）——逐行 fire-and-forget
       * <zh/> 在大数据集时形成对后端的雷群冲击；池化同时保持"失败移除展开 key"语义。
       * <en/> Pooled batch lazy-loading (limit=4) — per-row fire-and-forget
       * <en/> causes thundering-herd bursts on large datasets; pooling keeps the
       * <en/> "remove expanded key on failure" semantics intact.
       */
      const { runAll } = createConcurrencyPool({ limit: 4 })
      const keysArray = [...keys]
      // 任务与 key 一一绑定：失败回调直接用 tasks[index].key，不再用 keysArray[index] 反推
      const tasks: Array<{ key: string | number, run: () => Promise<void> }> = []
      for (const key of keysArray) {
        if (loadedRowKeys.value.has(key))
          continue
        const row = findRowByKey(key)
        if (!row)
          continue
        const taskKey = key
        const taskRow = row
        tasks.push({
          key: taskKey,
          run: async () => {
            if (expandDisposed)
              return
            await load(taskRow, taskKey)
            if (expandDisposed)
              return
            const updatedLoadedKeys = new Set(loadedRowKeys.value)
            updatedLoadedKeys.add(taskKey)
            loadedRowKeys.value = updatedLoadedKeys
          },
        })
      }
      void runAll(tasks.map(t => t.run), (_error, index) => {
        if (expandDisposed)
          return
        // 加载失败：从 expandedRowKeys 中移除该 key，避免显示空展开行（保持原有语义）
        // On failure: remove the key from expandedRowKeys to avoid empty expanded rows (original semantics)
        const failedKey = tasks[index]?.key
        if (failedKey != null && expandedRowKeys.value.has(failedKey)) {
          const updatedKeys = new Set(expandedRowKeys.value)
          updatedKeys.delete(failedKey)
          expandedRowKeys.value = updatedKeys
        }
      })
    }
  }

  function collapseAllDetailRows() {
    // 等待中的 load 完成后不再重新展开（用户意图优先）
    for (const key of loadingRowKeys.value)
      loadCancelledKeys.add(key)
    expandedRowKeys.value = new Set()
  }

  // 逻辑索引 Map——避免在 computed 中直接修改用户行对象（违反 Vue 最佳实践）
  // Logical index Map — avoids mutating user row objects inside computed (violates Vue best practices)
  const logicalIndexMap = new WeakMap<object, number>()

  const expandedData = computed<T[]>((prev) => {
    if (!expandEnabled.value) {
      const result = toValue(data)
      if (prev && prev === result)
        return prev
      return result
    }

    const rows = toValue(data)
    const rowKeyResolver = toValue(rowKeyFn)
    const expanded = expandedRowKeys.value
    const result: T[] = []
    let logicalIndex = 0

    for (const row of rows) {
      if (isSharedDetailRow(row)) {
        continue
      }
      // synthetic 行（group header/total）直接透传：不分配业务逻辑索引、不插入 DetailRow
      if (isSyntheticExpandRow(row)) {
        result.push(row)
        continue
      }

      // 将逻辑索引存入 WeakMap，不再直接写用户行对象
      // Store logical index in WeakMap instead of writing to user row object
      if (row && typeof row === 'object') {
        logicalIndexMap.set(row, logicalIndex++)
      }
      result.push(row)

      // 行键统一归一为 string——rowKeyFn 可能返回 number，与归一化后的展开集合比对。
      // rowKeyResolver 抛错时跳过（不插 DetailRow）：整条 renderData computed 不应被单行坏 key 炸掉。
      // Keys are normalized to string (rowKeyFn may return number) before comparing to the expanded
      // set. A throwing resolver skips the row (no DetailRow) so one bad key can't break renderData.
      let rowKey: string
      try {
        rowKey = normalizeExpandKey(rowKeyResolver(row))
      }
      catch (err) {
        devWarn('[AdvTable] expand rowKeyFn(row) threw, row treated as not expandable:', err)
        continue
      }
      if (expanded.has(rowKey)) {
        /**
         * <zh/> 【内部合成行——受众标注】DetailRow 仅存在于渲染数据（renderData）层，
         * <zh/> 供虚拟/默认渲染器与 RowViewModel 识别并提前返回；不写入用户数据，
         * <zh/> 不参与持久化、导入导出与 undo 定位。消费方请通过 `__isDetailRow` 判别后短路处理。
         * <en/> [Internal synthetic row — audience note] DetailRow exists only in the render-data
         * <en/> layer for renderer & RowViewModel recognition with early-return; never written to
         * <en/> user data, and excluded from persistence/import-export/undo targeting.
         * <en/> Consumers must short-circuit on `__isDetailRow`.
         */
        const detailRow: DetailRow<T> = {
          __isDetailRow: true,
          __detailRowData: row,
          __detailRowKey: rowKey,
          [AUTO_KEY_NAME]: `__detail__${rowKey}`,
        }
        result.push(detailRow as unknown as T)
      }
    }

    if (prev && prev.length === result.length && prev.every((item, i) => item === result[i]))
      return prev
    return result
  })

  /**
   * <zh/> 查询行的逻辑索引（排除 DetailRow 后的索引）
   * <zh/> 由 index/indexBorder valueType 通过 ctx 调用，避免读取用户行对象上的 `__advLogicalIndex` 字段
   *
   * <en/> Look up a row's logical index (excluding DetailRows)
   * <en/> Called by index/indexBorder valueType via ctx, avoids reading `__advLogicalIndex` from the user row object
   */
  function getLogicalIndex(row: any): number | undefined {
    if (row != null && typeof row === 'object') {
      return logicalIndexMap.get(row as object)
    }
    return undefined
  }

  const rowExpandApi: RowExpandApi = {
    expandEnabled,
    expandedRowKeys,
    toggleRowExpand,
    expandDetailRow,
    collapseDetailRow,
    expandAllDetailRows,
    collapseAllDetailRows,
    accordion: accordionMode,
    // <zh/> 判别逻辑收敛至 synthetic-row 唯一实现；此处仅保留 API 要求的类型谓词形态
    // <en/> Predicate logic converges in synthetic-row; only the API-required type-guard shape stays here
    isDetailRow: (row: unknown): row is DetailRow => isSharedDetailRow(row),
    loadingRowKeys,
    getLogicalIndex,
  }

  return {
    expandedData,
    rowExpandApi,
  }
}
