import type { MaybeRefOrGetter, ShallowRef } from 'vue'
import type { TreeConfig, TreeRowMeta } from '../../types/config'
import { onDeactivated, onUnmounted, toValue } from 'vue'
import { createConcurrencyPool } from '../../utils/concurrency-pool'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { findRowByKey } from './use-tree-data-flatten'
import { collectKeys, devTreeWarn, isAbortError, normalizeTreeKey, rowMetaKey } from './use-tree-data-utils'

/**
 * <zh/> 懒加载引擎依赖 | <en/> Lazy-load engine deps
 */
export interface UseTreeDataLoadDeps<T> {
  treeConfig: MaybeRefOrGetter<TreeConfig | undefined>
  data: MaybeRefOrGetter<T[]>
  rowKeyFn: MaybeRefOrGetter<(row: T) => string>
  expandedRowKeys: ShallowRef<Set<string | number>>
  /** <zh/> 树状态版本递增（触发展平重算/渲染重绘） | <en/> tree revision bump (drives flatten recompute / renderer redraw) */
  bumpTreeRevision: () => void
  metaMap: WeakMap<object, TreeRowMeta>
  /** <zh/> 正在懒加载的行对象集合 | <en/> row objects currently lazy-loading */
  loadingRows: Set<object>
  /** <zh/> key → 行对象映射（含折叠子树） | <en/> key→row map (incl. collapsed subtrees) */
  keyToRow: Map<string | number, T>
}

/**
 * <zh/> 懒加载引擎——loadChildren（AbortController 竞态守卫 + 只读数据回滚）、
 * <zh/> toggleRowExpand/expandRow/collapseRow、expandAll（并发池化批量懒加载）/collapseAll，
 * <zh/> 及卸载/KeepAlive 停靠时的请求取消与 loading 清理。
 *
 * <zh/> 自 use-tree-data.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C），函数体逐字未改。
 * <en/> Lazy-load engine — loadChildren (AbortController race guard + read-only-data rollback),
 * <en/> toggleRowExpand/expandRow/collapseRow, expandAll (pooled batch lazy-load)/collapseAll,
 * <en/> plus request cancellation and loading cleanup on unmount / KeepAlive deactivation.
 *
 * <en/> Migrated verbatim from use-tree-data.ts (COMPLEXITY-PLAN battle line 3, knife C),
 * <en/> function bodies unchanged.
 */
export function useTreeDataLoad<T>(deps: UseTreeDataLoadDeps<T>) {
  const {
    treeConfig,
    data,
    rowKeyFn,
    expandedRowKeys,
    bumpTreeRevision,
    metaMap,
    loadingRows,
    keyToRow,
  } = deps

  /**
   * 组件卸载标志——防止 loadChildren 异步回调在 unmount/deactivated 后写入数据。
   * Component unmount flag — prevents loadChildren async callbacks from writing data after unmount/deactivated.
   */
  let isUnmounted = false
  /** loadChildren 的 AbortController 映射，按 rowKey 维度取消未完成的懒加载请求 */
  const loadChildrenAbortControllers = new Map<string | number, AbortController>()

  onUnmounted(() => {
    isUnmounted = true
    loadChildrenAbortControllers.forEach(controller => controller.abort())
    loadChildrenAbortControllers.clear()
  })

  onDeactivated(() => {
    /**
     * KeepAlive 切换时取消未完成的懒加载请求，防止数据写入 deactivated 组件。
     * 不重置 isUnmounted——reactivated 后允许新的 loadChildren 调用。
     * 同时清除所有 loading 标志并 bump——否则 abort 后 loading 图标永久卡死
     * （loadChildren 的 finally 只清理当前请求的 meta，此处 abort 了全部请求）。
     * Cancel in-flight lazy-load requests on KeepAlive switch, preventing data
     * writes into a deactivated component. isUnmounted is NOT reset — new
     * loadChildren calls are allowed after reactivation. Also clears every
     * loading flag and bumps the revision — otherwise aborted requests leave
     * the loading icon permanently stuck (loadChildren's finally only clears
     * the meta of the request it started).
     */
    loadChildrenAbortControllers.forEach(controller => controller.abort())
    loadChildrenAbortControllers.clear()
    if (loadingRows.size > 0) {
      for (const row of loadingRows) {
        const meta = metaMap.get(row)
        if (meta)
          meta.loading = false
      }
      loadingRows.clear()
      bumpTreeRevision()
    }
  })

  async function loadChildren(rowKey: string | number): Promise<boolean> {
    const normalizedKey = normalizeTreeKey(rowKey)
    const config = toValue(treeConfig)
    if (!config?.loadData)
      return true

    /** <zh/> 卸载后直接返回，防止异步回调写入已销毁组件状态 | <en/> Return early after unmount to prevent async callbacks from writing state of a destroyed component */
    if (isUnmounted)
      return false

    const keyFn = toValue(rowKeyFn)
    const childrenKey = config.children ?? 'children'
    const row = keyToRow.get(normalizedKey) ?? keyToRow.get(rowKey) ?? findRowByKey(toValue(data), normalizedKey, keyFn, childrenKey)
    if (!row)
      return false

    const meta = metaMap.get(rowMetaKey(row))
    if (!meta || meta.loaded || meta.loading || !meta.hasChildren)
      return true

    /** 取消同一 rowKey 的前一次未完成请求 */
    const prevController = loadChildrenAbortControllers.get(normalizedKey) ?? loadChildrenAbortControllers.get(rowKey)
    prevController?.abort()

    const controller = new AbortController()
    loadChildrenAbortControllers.set(normalizedKey, controller)

    meta.loading = true
    loadingRows.add(rowMetaKey(row))
    // 触发 treeRevision 递增，使渲染器感知 loading 状态变化并重绘 loading 图标
    // Bump treeRevision so renderers pick up the loading state change and redraw the loading icon
    bumpTreeRevision()

    try {
      // 对外 loadData 回调拿到**原始类型**的 key（rowKeyFn 返回什么就是什么），
      // 内部状态仍只存归一化 string
      const children = await config.loadData(row, keyFn(row), { signal: controller.signal })
      /** 卸载、deactivated 或被新请求取消：丢弃结果，不写入数据 */
      if (isUnmounted || controller.signal.aborted)
        return false
      if (Array.isArray(children)) {
        /**
         * 直接 mutation row[childrenKey]——树形懒加载语义需要：
         * row 是 finalDisplayData 中的元素引用，与 pipelineData 中的元素共享同一引用。
         * mutation 后 expandedRowKeys 变化会触发 flattenedData computed 重算，
         * 重新遍历时读取到新的 children。
         *
         * 用户数据不可变场景（Object.freeze/Pinia readonly）：catch TypeError 并回滚
         * expandedRowKeys，不标记 loaded，允许用户处理不可变数据后重新展开。
         */
        try {
          (row as Record<string, unknown>)[childrenKey] = children
        }
        catch (error) {
          if (isDev) {
            devWarn('[useTreeData] loadChildren 写入 children 失败，数据可能为只读对象：', error)
          }
          // 回滚：从 expandedRowKeys 中移除该 key | Rollback: remove key from expandedRowKeys
          if (expandedRowKeys.value.has(normalizedKey)) {
            const keys = new Set(expandedRowKeys.value)
            keys.delete(normalizedKey)
            expandedRowKeys.value = keys
          }
          // 不标记 loaded，允许用户处理不可变数据后重新展开 | Don't mark loaded, allow user to process immutable data and re-expand
          return false
        }
        /**
         * <zh/> 写入成功后标记 loaded——必须取 metaMap 中的当前 meta（loading bump 触发重算会替换 meta 对象，函数起始捕获的 meta 引用可能已过期）
         * <en/> After successful write mark loaded — must read the current meta from metaMap (the loading bump triggers a recompute that replaces the meta object, so the meta reference captured at function start may be stale)
         */
        const currentMeta = metaMap.get(rowMetaKey(row))
        if (currentMeta)
          currentMeta.loaded = true
        /** 将新加载的 children 加入 keyToRow 缓存，减少后续 findRowByKey fallback */
        for (const child of children) {
          keyToRow.set(normalizeTreeKey(keyFn(child)), child)
        }
      }
    }
    catch (error) {
      /**
       * <zh/> 取消类错误（被同 key 新请求取代 / 卸载 / deactivate）静默返回 false。
       * <zh/> 非取消错误继续上抛，保留调用方 await 感知真实失败的能力。
       * <en/> Cancellation-shaped errors (superseded by a newer request / unmounted /
       * <en/> deactivated) resolve to `false` silently. Genuine errors still propagate
       * <en/> so awaiting callers can observe real failures.
       */
      if (isUnmounted || controller.signal.aborted || isAbortError(error))
        return false
      throw error
    }
    finally {
      /**
       * <zh/> 清除 loading——取 metaMap 中的当前 meta，避免写入已过期对象导致 loading 永不清除
       * <en/> Clear loading — read the current meta from metaMap to avoid writing to a stale object leaving loading stuck
       */
      const currentMeta = metaMap.get(rowMetaKey(row))
      if (currentMeta)
        currentMeta.loading = false
      loadingRows.delete(rowMetaKey(row))
      /**
       * <zh/> 仅当映射仍指向本次控制器时删除——无条件 delete 会误删同 key 后续请求的控制器记录，
       * <zh/> 使其在 deactivate/unmount 时漏取消。
       * <en/> Only delete when the map still points at this controller — an unconditional
       * <en/> delete would drop the record of a newer same-key request, leaking it past
       * <en/> deactivate/unmount cancellation.
       */
      if (loadChildrenAbortControllers.get(normalizedKey) === controller)
        loadChildrenAbortControllers.delete(normalizedKey)
      if (loadChildrenAbortControllers.get(rowKey) === controller)
        loadChildrenAbortControllers.delete(rowKey)
      // loading 结束后再次 bump，使渲染器清除 loading 图标
      // Bump again after loading ends so renderers clear the loading icon
      bumpTreeRevision()
    }
    return true
  }

  async function toggleRowExpand(rowKey: string | number): Promise<void> {
    const normalizedKey = normalizeTreeKey(rowKey)
    if (expandedRowKeys.value.has(normalizedKey)) {
      const keys = new Set(expandedRowKeys.value)
      keys.delete(normalizedKey)
      expandedRowKeys.value = keys
      return
    }
    const success = await loadChildren(normalizedKey)
    if (!success)
      return
    /**
     * <zh/> 不变量：await 之后必须重读最新 Set 再合并。
     * <zh/> await 前快照、await 后直接写回会使加载期间用户收起的兄弟节点
     * <zh/> 或 collapseAll 被旧快照静默撤销（陈旧快照覆写）。
     * <en/> Invariant: after the await, re-read the LATEST set before merging.
     * <en/> Writing back a pre-await snapshot verbatim silently reverts sibling
     * <en/> collapses / collapseAll that happened during loading (stale-snapshot clobber).
     */
    const keys = new Set(expandedRowKeys.value)
    keys.add(normalizedKey)
    expandedRowKeys.value = keys
  }

  async function expandRow(rowKey: string | number): Promise<void> {
    const normalizedKey = normalizeTreeKey(rowKey)
    if (expandedRowKeys.value.has(normalizedKey))
      return
    const success = await loadChildren(normalizedKey)
    if (!success)
      return
    const keys = new Set(expandedRowKeys.value)
    keys.add(normalizedKey)
    expandedRowKeys.value = keys
  }

  function collapseRow(rowKey: string | number): void {
    const normalizedKey = normalizeTreeKey(rowKey)
    if (!expandedRowKeys.value.has(normalizedKey))
      return
    const keys = new Set(expandedRowKeys.value)
    keys.delete(normalizedKey)
    expandedRowKeys.value = keys
  }

  function expandAll(): void {
    const config = toValue(treeConfig)
    if (!config)
      return
    expandedRowKeys.value = collectKeys(toValue(data), config.children ?? 'children', toValue(rowKeyFn))
    /**
     * <zh/> 懒加载节点逐个触发 loadChildren——仅加 key 会让 UI 显示"已展开的空节点"。
     * <zh/> loadChildren 内部按 meta.loaded/loading/hasChildren 门控，重复调用无副作用。
     * <en/> Trigger loadChildren for lazy-loaded nodes — adding keys alone would render
     * "expanded empty nodes". loadChildren gates on meta.loaded/loading/hasChildren,
     * <en/> so repeated calls are harmless.
     */
    if (config.loadData) {
      /**
       * <zh/> 并发池化批量懒加载（limit=4 平衡吞吐与压力）——逐键 fire-and-forget
       * <zh/> 在大量懒加载节点时形成对后端的雷群冲击，约束经由并发池收敛。
       * <en/> Pooled batch lazy-loading (limit=4 balances throughput and load) — per-key
       * <en/> fire-and-forget causes thundering-herd bursts with many lazy nodes; constrain via pool.
       */
      const { runAll } = createConcurrencyPool({ limit: 4 })
      void runAll(
        Array.from(expandedRowKeys.value, key => () => loadChildren(key)),
        error => devTreeWarn(error),
      )
    }
  }

  function collapseAll(): void {
    expandedRowKeys.value = new Set()
  }

  return {
    loadChildren,
    toggleRowExpand,
    expandRow,
    collapseRow,
    expandAll,
    collapseAll,
  }
}
