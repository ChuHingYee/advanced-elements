import type { ComputedRef, ShallowRef } from 'vue'
import type { AdvTableStorageError, ColumnStatePersistence } from '../../types/column-state'
import { computed, shallowRef } from 'vue'
import { createTrailingDebounce } from '../../utils/debounce'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { localStorageAdapter } from '../../utils/storage'

/**
 * <zh/> 列状态持久化胶水依赖 | <en/> Column-state persistence-glue deps
 */
export interface UseColumnStateStorageDeps {
  persistence: ComputedRef<ColumnStatePersistence | undefined>
  /** <zh/> 表格唯一标识 getter（推导 storageKey） | <en/> unique table ID getter (derives the storageKey) */
  tableId: () => string
  /** <zh/> 读取当前快照（saveState 用，由宿主编排器注入 getColumnState） | <en/> snapshot reader (for saveState; the host injects getColumnState) */
  getColumnState: () => unknown[]
}

/**
 * <zh/> 列状态持久化胶水——storage 适配器解析、storageKey 推导、错误策略派发、
 * <zh/> 自动保存开关、防抖落盘与「恢复期间跳过自动保存」共享标志。
 *
 * <zh/> 自 use-column-state.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C）；
 * <zh/> 唯一语义级改动：`_skipWatchSave` 由 `let` 布尔改为 shallowRef（跨模块共享可变标志）。
 * <en/> Column-state persistence glue — storage adapter resolution, storageKey derivation,
 * <en/> error-strategy dispatch, auto-save toggles, debounced saving and the shared
 * <en/> "skip autosave during restore" flag.
 *
 * <en/> Migrated verbatim from use-column-state.ts (COMPLEXITY-PLAN battle line 3, knife C);
 * <en/> sole semantic change: `_skipWatchSave` moves from a `let` boolean to a shallowRef
 * <en/> (a mutable flag shared across modules).
 */
export function useColumnStateStorage(deps: UseColumnStateStorageDeps) {
  const { persistence, tableId, getColumnState } = deps

  const storage = computed(() => persistence.value?.storage ?? localStorageAdapter)
  const storageKey = computed(() =>
    persistence.value?.storageKey ?? `adv-table-cols-${tableId()}`,
  )

  /**
   * 处理持久化操作过程中的错误
   *
   * Handle errors during persistence operations
   */
  function handleError(phase: 'save' | 'restore' | 'remove', error: unknown): void {
    const config = persistence.value
    const strategy = config?.errorStrategy ?? 'silent'

    const detail: AdvTableStorageError = {
      phase,
      error,
      key: storageKey.value,
      domain: 'columnState',
    }

    config?.onStorageError?.(detail)

    switch (strategy) {
      case 'throw':
        throw error
      case 'warn':
        devWarn(`[AdvTable] Column state ${phase} failed for key "${storageKey.value}":`, error)
        break
      case 'silent':
      default:
        if (isDev) {
          devWarn(`[AdvTable] Column state ${phase} failed:`, error)
        }
        break
    }
  }

  const autoSaveEnabled = computed(() =>
    persistence.value?.enabled && persistence.value?.autoSave !== false,
  )

  const debounceMs = computed(() => persistence.value?.debounce ?? 300)

  /** <zh/> applyColumnState / resetColumnState 执行期间跳过 deep watch 触发的冗余保存 | <en/> Skip deep-watch saves while applyColumnState / resetColumnState run */
  const skipWatchSave: ShallowRef<boolean> = shallowRef(false)

  async function saveState(): Promise<void> {
    try {
      const state = getColumnState()
      await storage.value.set(storageKey.value, JSON.stringify(state))
    }
    catch (err) {
      handleError('save', err)
    }
  }

  /**
   * <zh/> 落盘防抖经 utils/debounce 唯一出口（尾随 + cancel + flush，ms 运行时读取）
   * <en/> persist debounce via the single utils/debounce outlet (trailing + cancel + flush, ms read at call time).
   */
  const _saveDebounce = createTrailingDebounce(
    () => {
      /**
       * <zh/> errorStrategy:'throw' 在 setTimeout 内抛出会逃逸 Vue 错误处理（unhandled），
       * <zh/> 此处 catch 兜底将 throw 降级为 warn，保证 onStorageError 回调仍被正常调用。
       * <en/> errorStrategy:'throw' inside setTimeout escapes Vue's error handling (unhandled);
       * <en/> this catch downgrades throw to warn, ensuring onStorageError is still called.
       */
      saveState().catch((err) => {
        if (isDev) {
          devWarn(`[AdvTable] Column state save failed (debounced):`, err)
        }
      })
    },
    () => debounceMs.value,
  )

  const debouncedSave = Object.assign(
    () => {
      _saveDebounce.call()
    },
    {
      cancel: () => {
        _saveDebounce.cancel()
      },
      /**
       * <zh/> 立即执行待保存的变更并清空定时器——用于 KeepAlive 停用前落盘。
       * <en/> Execute the pending save immediately and clear the timer — for flushing before
       * <en/> KeepAlive deactivation.
       */
      flush: () => {
        _saveDebounce.flush()
      },
    },
  )

  return {
    storage,
    storageKey,
    handleError,
    autoSaveEnabled,
    skipWatchSave,
    saveState,
    debouncedSave,
  }
}
