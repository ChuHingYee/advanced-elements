/**
 * <zh/> 命名视图预设 composable——列配置快照的保存 / 应用 / 列举 / 删除。
 * <en/> Named view presets composable — save / apply / list / delete column-config snapshots.
 *
 * @remarks
 * <zh/> 从 `use-table-api.ts` 抽出的独立功能域（纯搬移，行为不变）。
 *
 * <zh/> **为何值得独立成文件**：本模块持有自己的状态与生命周期（`viewsCache` Map、
 * <zh/> `viewsCacheGeneration` 代际号、`watch` 重取水合、`onScopeDispose` 清理），
 * <zh/> 符合仓库判据"owns state + lifecycle → 抽 composable；仅 relay → 不抽"中的前者。
 * <zh/> 它与"把 15 个域装配为 expose"这一关注点无耦合：只吃 4 个入参、吐 4 个函数。
 * <zh/> 混放时读 expose 契约要翻过约 430 行缓存/代际逻辑，故拆出。
 *
 * <zh/> 设计要点：
 * <zh/> - 存储键按 tableId 隔离（前缀 `adv-table-views:`，与 ColumnState 键不互踩）；
 * <zh/> - 视图内容即 `getColumnState()` 的 JSON 快照，`applyView` 复用既有 applyColumnState，
 * <zh/>   不引入第二套状态通道；
 * <zh/> - 读写经统一适配器（`persistence?.storage ?? 默认 localStorage`），与 ColumnState
 * <zh/>   共享同一条注入链（两者从同一源解析，恒得同一实例）；
 * <zh/> - 读路径兜底：注入自定义适配器读取未命中时回退默认 localStorage（仅读，写恒走注入适配器）；
 * <zh/> - 存储中的视图属**外部输入**（可手改、可能残留旧 schema），apply 前经
 * <zh/>   `isValidColumnStateData` 校验，非法即返回 false 而非"true 但什么都没应用"。
 *
 * <en/> Extracted from `use-table-api.ts` as an independent feature domain (pure code motion,
 * <en/> behavior unchanged).
 *
 * <en/> **Why it deserves its own file**: it owns state + lifecycle (`viewsCache`,
 * <en/> `viewsCacheGeneration`, the re-hydrate `watch`, `onScopeDispose` cleanup) — the "extract"
 * <en/> side of the repo's "owns state + lifecycle → extract; merely relays → don't" rule.
 * <en/> It is uncoupled from assembling 15 domains into one expose: 4 inputs in, 4 functions out.
 * <en/> While colocated, reading the expose contract meant scrolling past ~430 lines of
 * <en/> cache/generation logic, hence the split.
 *
 * <en/> Design notes:
 * <en/> - Storage keys are isolated per tableId (`adv-table-views:` prefix, no collision with ColumnState);
 * <en/> - A view is the JSON of `getColumnState()`; `applyView` reuses the existing
 * <en/>   applyColumnState — no second state channel;
 * <en/> - Reads/writes go through the unified adapter (`persistence?.storage ?? default
 * <en/>   localStorage`), sharing one injection chain with column state (both resolve from the
 * <en/>   same source and thus always get the same instance);
 * <en/> - Read-path fallback: on custom-adapter miss, fall back to default localStorage
 * <en/>   (read path only; writes always use the injected adapter);
 * <en/> - Stored views are **external input** (hand-editable, possibly stale schema), so apply
 * <en/>   validates via `isValidColumnStateData` and returns false rather than "true, nothing applied".
 */
import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type {
  AdvTableStorageAdapter,
  AdvTableStorageError,
  ApplyColumnStateOptions,
  ColumnState,
  ColumnStatePersistence,
} from '../../types/column-state'
import { computed, onScopeDispose, toValue, watch } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { localStorageAdapter } from '../../utils/storage'
import { isValidColumnStateData } from '../columns/use-column-state'

/** <zh/> 命名视图入参 | <en/> Named-views options */
export interface UseNamedViewsOptions {
  /** <zh/> 表格实例 ID——存储键按之隔离，跟随运行时变更（缺省时归入 `default` 键） | <en/> Table instance ID — isolates storage keys; follows runtime changes (falls into the `default` key when absent) */
  tableId: MaybeRefOrGetter<string | undefined> /** <zh/> 列状态持久化配置（提供 storage 适配器与 errorStrategy） | <en/> Column-state persistence config (supplies the storage adapter and errorStrategy) */
  persistence: ComputedRef<ColumnStatePersistence | undefined>
  /** <zh/> 当前列配置快照读取器 | <en/> Reads the current column-config snapshot */
  getColumnState: () => ColumnState[]
  /** <zh/> 列配置快照应用器（applyView 复用，顺序/宽度/排序全量应用） | <en/> Applies a column-config snapshot (reused by applyView: order/width/sort) */
  applyColumnState: (state: ColumnState[], options?: ApplyColumnStateOptions) => void
}

/** <zh/> 命名视图返回 | <en/> Named-views return */
export interface ViewPresetsApi {
  /** <zh/> 保存当前列配置为命名视图 | <en/> Save the current column config as a named view */
  saveView: (name: string) => void
  /** <zh/> 应用命名视图——不存在或校验失败时返回 false | <en/> Apply a named view — false when missing or invalid */
  applyView: (name: string) => boolean
  /** <zh/> 列出已保存视图名 | <en/> List saved view names */
  getSavedViews: () => string[]
  /** <zh/> 删除命名视图——返回是否存在 | <en/> Delete a named view — returns whether it existed */
  deleteView: (name: string) => boolean
}

/**
 * <zh/> 创建命名视图域
 * <en/> Create the named-views domain.
 *
 * @param options - <zh/> 入参（存储键来源 + 持久化配置 + 列状态读写） | <en/> options (storage-key source + persistence config + column-state read/write)
 * @returns <zh/> 命名视图 API | <en/> named-views API
 */
export function useNamedViews(options: UseNamedViewsOptions): ViewPresetsApi {
  const { tableId, persistence, getColumnState, applyColumnState } = options

  /**
   * <zh/> 命名视图存储键——按 tableId 隔离，与 ColumnState 键前缀不同不互踩；跟随 tableId 运行时变更。
   * <en/> Named view storage key — isolated per tableId; distinct prefix from ColumnState key; follows runtime tableId changes.
   */
  const viewsStorageKey = computed(() => `adv-table-views:${toValue(tableId) ?? 'default'}`)

  /**
   * <zh/> 解析有效适配器：`persistence?.storage ?? 默认 localStorage 适配器`。
   * <zh/> 与 ColumnState 侧解析同一适配器实例（两者从同一个 persistence 源读取）。
   * <en/> Resolve effective adapter: `persistence?.storage ?? default localStorage adapter`.
   * <en/> Resolves to the same adapter instance as the column-state side (both read the same source).
   */
  const EffectivePersistence = computed(() => persistence?.value)
  const effectiveAdapter = computed<AdvTableStorageAdapter>(
    () => EffectivePersistence.value?.storage ?? localStorageAdapter,
  )

  /**
   * <zh/> 命名视图持久化错误处理——统一通道，domain 标记为 `namedView`。
   * <zh/> `errorStrategy: 'throw'` 上抛，`'warn'` 降级 warn，`'silent'` 仅 dev。
   * <en/> Named-view persistence error handler — unified channel, domain tagged `namedView`.
   * <en/> `errorStrategy: 'throw'` rethrows, `'warn'` degrades to warn, `'silent'` only in dev.
   */
  function handleStorageError(phase: 'save' | 'restore' | 'remove', error: unknown): void {
    const config = persistence?.value
    const strategy = config?.errorStrategy ?? 'silent'

    const detail: AdvTableStorageError = {
      phase,
      error,
      key: viewsStorageKey.value,
      domain: 'namedView',
    }

    config?.onStorageError?.(detail)

    switch (strategy) {
      case 'throw':
        throw error
      case 'warn':
        devWarn(`Named view ${phase} failed for key "${viewsStorageKey.value}":`, error)
        break
      case 'silent':
      default:
        if (isDev) {
          devWarn(`Named view ${phase} failed:`, error)
        }
        break
    }
  }

  const viewsCache = new Map<string, Record<string, ColumnState[]>>()
  let viewsCacheGeneration = 0

  function hydrateViewsCacheAsync(): void {
    const key = viewsStorageKey.value
    const generation = viewsCacheGeneration
    let result: unknown = null
    try {
      result = effectiveAdapter.value.get(key)
    }
    catch {
      return
    }
    if (result instanceof Promise) {
      ;(result as Promise<unknown>).then((raw) => {
        // <zh/> 异步回填守卫：等待期间 storageKey 或 generation 已变说明有更新的 hydrate 在途，丢弃本次过期回填 | <en/> Async backfill guard: changed key/generation means a newer hydrate is in flight, drop this stale backfill
        if (viewsStorageKey.value !== key || viewsCacheGeneration !== generation)
          return
        try {
          if (typeof raw === 'string')
            viewsCache.set(key, JSON.parse(raw) as Record<string, ColumnState[]>)
          else if (raw != null && typeof raw === 'object')
            viewsCache.set(key, raw as Record<string, ColumnState[]>)
        }
        catch (err) {
          handleStorageError('restore', err)
        }
      }).catch((err: unknown) => handleStorageError('restore', err))
    }
  }

  watch([viewsStorageKey, effectiveAdapter], () => {
    viewsCache.clear()
    viewsCacheGeneration++
    hydrateViewsCacheAsync()
  }, { flush: 'sync' })
  hydrateViewsCacheAsync()

  /**
   * <zh/> 作用域销毁时清空视图缓存——缓存以 tableId 为键持有列状态快照，
   * <zh/> 而 `defineExpose({ ...api })` 会把实例 ref 交给消费方；若不清理，
   * <zh/> 卸载后仍被父级持有 ref 时会连带保活这些快照（无意义的内存驻留）。
   * <en/> Drop the views cache when the scope is disposed — the cache holds column-state snapshots keyed
   * <en/> by tableId, and `defineExpose({ ...api })` hands the instance ref to consumers; without this,
   * <en/> a parent still holding the ref keeps those snapshots alive after unmount (pointless residency).
   */
  onScopeDispose(() => {
    viewsCache.clear()
  })

  function readViewsMapSync(): Record<string, ColumnState[]> {
    const key = viewsStorageKey.value
    try {
      const result = effectiveAdapter.value.get(key)
      // <zh/> 同步返回（默认适配器与自定义同步适配器） | <en/> Sync return (default + custom sync adapters)
      if (result == null) {
        // <zh/> 读路径兜底：注入自定义同步适配器读取未命中时回退默认 localStorage
        // <en/> Read-path fallback: a miss on the injected custom sync adapter falls back to the default localStorage
        const injected = persistence?.value?.storage
        if (injected) {
          const fallback = localStorageAdapter.get(viewsStorageKey.value)
          if (fallback != null && typeof fallback === 'string') {
            return JSON.parse(fallback) as Record<string, ColumnState[]>
          }
        }
        return viewsCache.get(key) ?? {}
      }
      if (typeof result === 'string') {
        const parsed = JSON.parse(result) as Record<string, ColumnState[]>
        viewsCache.set(key, parsed)
        return parsed
      }
      // <zh/> Promise 返回值——无法同步读取，回退缓存
      // <en/> Promise return — cannot read synchronously, fall back to cache
      return viewsCache.get(key) ?? {}
    }
    catch (err) {
      handleStorageError('restore', err)
      return viewsCache.get(key) ?? {}
    }
  }

  return {
    saveView: (name: string): void => {
      const key = viewsStorageKey.value
      const generation = viewsCacheGeneration
      const snapshot = getColumnState()
      // 异步适配器后台对账：远端已有视图到达后合并进当前 key 缓存，避免基于空缓存的
      // 后续 save 覆盖删除旧视图；只在同代同 key 时碰缓存，远端写入恒走捕获 key。
      try {
        const probed = effectiveAdapter.value.get(key)
        if (probed instanceof Promise) {
          ;(probed as Promise<unknown>).then((raw) => {
            let remote: Record<string, ColumnState[]> | null = null
            try {
              if (typeof raw === 'string')
                remote = JSON.parse(raw) as Record<string, ColumnState[]>
              else if (raw != null && typeof raw === 'object')
                remote = raw as Record<string, ColumnState[]>
            }
            catch (err) {
              handleStorageError('restore', err)
              return
            }
            if (!remote || typeof remote !== 'object')
              return
            // 有远端视图且本地缓存缺失时才合并；本地已有写入（含本次 snapshot）优先，不覆盖。
            // 若合并产生新键，需补写一次到捕获 key（同步主路径的 SET 已基于空快照先行，
            // 补写恢复被覆盖的远端视图，最终一致；缓存变更仍只在同代同 key 时执行）。
            const cachedAtResolve = viewsCache.get(key) ?? {}
            let merged: Record<string, ColumnState[]> | null = null
            // 以同步写入后的 map 为基（含本次 snapshot），避免补写丢掉本次保存
            const base: Record<string, ColumnState[]> = { ...cachedAtResolve }
            if (!(name in base))
              base[name] = snapshot
            for (const k of Object.keys(remote)) {
              if (!(k in base)) {
                merged ??= { ...base }
                merged[k] = remote[k]
              }
            }
            if (merged) {
              if (viewsStorageKey.value === key && viewsCacheGeneration === generation)
                viewsCache.set(key, merged)
              try {
                const r = effectiveAdapter.value.set(key, JSON.stringify(merged))
                if (r instanceof Promise)
                  r.catch((err: unknown) => handleStorageError('save', err))
              }
              catch (err) {
                handleStorageError('save', err)
              }
            }
            else if (viewsStorageKey.value === key && viewsCacheGeneration === generation) {
              // 远端无新键但本地缺 snapshot 时补齐（防御）
              const cached = viewsCache.get(key) ?? {}
              if (!(name in cached))
                viewsCache.set(key, { ...cached, [name]: snapshot })
            }
          }).catch((err: unknown) => handleStorageError('restore', err))
        }
      }
      catch {
        // 探测失败不影响同步主路径
      }
      const current = readViewsMapSync()
      const map = { ...current, [name]: snapshot }
      const prev = viewsCache.get(key)
      viewsCache.set(key, map)
      try {
        const result = effectiveAdapter.value.set(key, JSON.stringify(map))
        if (result instanceof Promise) {
          result.catch((err: unknown) => {
            if (viewsStorageKey.value === key && viewsCacheGeneration === generation)
              viewsCache.set(key, prev ?? {})
            handleStorageError('save', err)
          })
        }
      }
      catch (err) {
        if (viewsCache.get(key) === map)
          viewsCache.set(key, prev ?? {})
        handleStorageError('save', err)
        if (persistence?.value?.errorStrategy === 'throw')
          throw err
      }
    },

    applyView: (name: string): boolean => {
      const map = readViewsMapSync()
      const state = map[name]
      if (!state)
        return false
      /**
       * <zh/> 存储中的命名视图属**外部输入**（可被手动篡改、可能残留旧版本结构），
       * <zh/> 校验后再委托：非法视图返回 `false` 而不是"返回 true 但什么都没应用"。
       * <en/> Named views read from storage are **external input** (hand-editable, possibly stale schema);
       * <en/> validate before delegating so an invalid view returns `false` instead of
       * <en/> "true while nothing was applied".
       */
      if (!isValidColumnStateData(state)) {
        if (isDev) {
          devWarn(`[AdvTable] Named view "${name}" failed column-state validation and was not applied.`)
        }
        return false
      }
      applyColumnState(state, { applyOrder: true, applyWidth: true, applySort: true })
      return true
    },

    getSavedViews: (): string[] => Object.keys(readViewsMapSync()),

    deleteView: (name: string): boolean => {
      const map = readViewsMapSync()
      if (!(name in map))
        return false
      const key = viewsStorageKey.value
      const generation = viewsCacheGeneration
      const updated = { ...map }
      delete updated[name]
      const prev = viewsCache.get(key)
      viewsCache.set(key, updated)
      try {
        const result = effectiveAdapter.value.set(key, JSON.stringify(updated))
        if (result instanceof Promise) {
          result.catch((err: unknown) => {
            if (viewsStorageKey.value === key && viewsCacheGeneration === generation)
              viewsCache.set(key, prev ?? {})
            handleStorageError('save', err)
          })
        }
      }
      catch (err) {
        if (viewsCache.get(key) === updated)
          viewsCache.set(key, prev ?? {})
        handleStorageError('save', err)
        if (persistence?.value?.errorStrategy === 'throw')
          throw err
      }
      return true
    },
  }
}
