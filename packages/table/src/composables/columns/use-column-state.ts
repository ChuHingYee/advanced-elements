/**
 * <zh/> 列状态管理 Composable
 * <en/> Column state composable
 *
 * @remarks
 * <zh/> 管理列的宽度、隐藏、固定和排序状态的持久化。支持自动保存到 localStorage 或自定义存储适配器，并提供防抖、错误策略和选择性恢复能力
 * <en/> Manages column width, hidden, fixed, and sort state persistence. Supports auto-saving to localStorage or a custom storage adapter, with debounce, error strategy, and selective restore capabilities
 */
import type { ComputedRef, Ref } from 'vue'
import type { ProcessedColumn } from '../../types'
import type {
  AdvTableStorageError,
  ApplyColumnStateOptions,
  ColumnState,
  ColumnStatePersistence,
} from '../../types/column-state'
import type { RendererModeName } from '../../types/renderer-caps'
import type { SortState } from '../../types/sort'
import { computed, nextTick, onActivated, onDeactivated, onMounted, onScopeDispose, watch } from 'vue'
import { findColumnByKey, stableReorderByKey, traverseColumnTree } from '../../utils/column-tree'
import { createTrailingDebounce } from '../../utils/debounce'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { getColumnKey } from '../../utils/shared'
import { localStorageAdapter } from '../../utils/storage'

/** <zh/> 当前列状态序列化 schema 版本，结构变更时递增并在 restoreState 中做不匹配重置 | <en/> Current column state serialization schema version, incremented on structure change and used for mismatch reset in restoreState */
const COLUMN_STATE_SCHEMA_VERSION = 1

/**
 * <zh/> useColumnState 配置选项
 * <en/> UseColumnState configuration options
 */
export interface UseColumnStateOptions {
  /** <zh/> 响应式列定义 | <en/> Reactive column definitions */
  localColumns: Ref<ProcessedColumn[]>
  /** <zh/> 当前排序状态 | <en/> Current sort state */
  sortState: Ref<SortState[]>
  /** <zh/> 重置列到初始状态的回调 | <en/> Callback to reset columns to initial state */
  resetColumns: () => void
  /**
   * <zh/> 设置列配置的回调（来自 useColumns.setColumns），同步 originColumns 并 emit 更新
   * <en/> Callback to set columns (from useColumns.setColumns), syncs originColumns and emits update
   */
  setColumns: (cols: ProcessedColumn[]) => void
  /**
   * <zh/> 触发 localColumns 重渲染的回调（来自 useColumns.touchColumns），
   * <zh/> 在列对象属性突变后调用以刷新渲染，但不同步 originColumns 也不 emit。
   * <zh/> 可选：缺省时回退到 `localColumns.value = [...localColumns.value]` 重赋值。
   * <en/> Re-render trigger callback (from useColumns.touchColumns),
   * <en/> called after mutating column properties to refresh rendering without
   * <en/> syncing originColumns or emitting updates. Optional — falls back to a
   * <en/> `localColumns.value = [...localColumns.value]` reassign when omitted.
   */
  touchColumns?: () => void
  /**
   * 设置排序状态的回调
   * Callback for setting sort state
   */
  setSorts: (sorts: SortState[]) => void
  /**
   * 持久化配置
   * Persistence config
   */
  persistence: ComputedRef<ColumnStatePersistence | undefined>
  /**
   * <zh/> 表格唯一标识 getter——用于推导持久化 storageKey。
   * <zh/> 以 getter 传入（而非字符串快照）使 `uiConfig.tableId` 运行时变更后 `storageKey` 随之更新，
   * <zh/> 与本文件 `mode` 的 getter 约定一致。
   * <en/> Unique table ID getter — used to derive the persistence storageKey.
   * <en/> Passed as a getter (rather than a string snapshot) so `storageKey` follows runtime
   * <en/> `uiConfig.tableId` changes, consistent with this file's `mode` getter convention.
   */
  tableId: () => string
  /**
   * <zh/> 当前渲染模式 getter——用于在 columnState 中记录 mode 字段，
   * <zh/> apply 时若 mode 不一致则跳过 width 应用，避免 default/virtual 跨模式列宽语义不一致导致的视觉跳变
   * <en/> Current render mode getter — used to record the mode field in columnState,
   * <en/> on apply, if mode mismatches, width application is skipped to avoid visual jump from default/virtual cross-mode width semantics mismatch
   */
  mode?: () => 'default' | 'virtual'
  /**
   * <zh/> 重置列宽拖拽缓存的回调——applyColumnState 恢复列宽前调用，清空 useColumnResize.columnWidths 中的陈旧拖拽值
   * <zh/> 避免 columnWidths[key] 遮蔽 applyColumnState 写入 col.width 的新值
   * <en/> Callback to reset column resize cache — called before applying column widths in applyColumnState,
   * <en/> clearing stale drag widths from useColumnResize.columnWidths
   * <en/> prevents columnWidths[key] from shadowing the new col.width written by applyColumnState
   */
  onResetColumnWidths?: () => void
}

/**
 * useColumnState 返回值
 *
 * UseColumnState return value
 */
export interface UseColumnStateReturn {
  /**
   * 获取当前列状态（宽度/隐藏/固定/排序）
   * Get current column state (width/hidden/fixed/sort)
   */
  getColumnState: () => ColumnState[]
  /**
   * 应用列状态，支持选择性恢复宽度/排序/顺序
   * Apply column state, supports selectively restoring width/sort/order
   */
  applyColumnState: (state: ColumnState[] | null | undefined, options?: ApplyColumnStateOptions) => void
  /**
   * 重置列状态为初始值，同时清除持久化存储
   * Reset column state to initial values and clear persisted storage
   */
  resetColumnState: () => void
}

/**
 * <zh/> 合法的 fixed 取值集合 | <en/> Valid fixed value set
 */
/**
 * <zh/> 合法的 fixed 取值集合——除 `'left' | 'right' | false` 外还必须接受 `true`：
 * <zh/> `true` 是列定义与 Element Plus 语义中"左侧固定"的等价写法，本库多处使用
 * <zh/> （列分类 / 汇总单元格 / 渲染器都按"左固定"处理）。旧集合漏收 `true`，
 * <zh/> 导致含此类列的表格在 `restoreState` 中被整体判为非法而丢弃存档。
 * <en/> Valid `fixed` value set — besides `'left' | 'right' | false` it must also accept `true`:
 * <en/> `true` is the equivalent spelling of "pinned left" in column definitions and Element Plus
 * <en/> semantics and is used across this library (column classification / summary cells / renderers
 * <en/> all treat it as left-pinned). The old set omitted `true`, so tables with such columns were
 * <en/> judged invalid wholesale by `restoreState` and had their stored state discarded.
 */
const VALID_FIXED_VALUES = new Set<string | boolean>(['left', 'right', false, true])

/**
 * <zh/> 合法的 sort 取值集合 | <en/> Valid sort value set
 */
const VALID_SORT_VALUES = new Set<string | null>(['ascending', 'descending', null])

/**
 * <zh/> 合法的 mode 取值集合 | <en/> Valid mode value set
 */
const VALID_MODE_VALUES = new Set<RendererModeName>(['default', 'virtual'])

/**
 * <zh/> 校验值是否为有限正数（用于 width） | <en/> Check if value is a finite positive number (for width)
 */
function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/**
 * <zh/> 校验值是否为有限非负整数（用于 sortIndex/schemaVersion） | <en/> Check if value is a finite non-negative integer (for sortIndex/schemaVersion)
 */
function isFiniteNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0
}

/**
 * 校验反序列化的数据是否为合法的 ColumnState[] 结构
 *
 * <zh/> 字段级 schema 校验：除基本数组+对象结构外，还校验每个字段类型，
 * <zh/> 避免异常数据（如 width 为字符串/负数、fixed 为任意字符串、sort 为非法值）
 * <zh/> 进入 applyColumnState 后导致渲染异常或 sortState 类型不匹配
 *
 * <en/> Field-level schema validation: in addition to basic array+object structure,
 * <en/> also validates each field's type to prevent abnormal data
 * <en/> (e.g., width as string/negative, fixed as arbitrary string, sort as invalid value)
 * <en/> from entering applyColumnState and causing rendering issues or sortState type mismatch
 */
export function isValidColumnStateData(data: unknown): data is ColumnState[] {
  if (!Array.isArray(data))
    return false
  return data.every((item): item is ColumnState => {
    if (item == null || typeof item !== 'object' || Array.isArray(item))
      return false
    const s = item as Record<string, unknown>
    // colId 必须是 string | colId must be string
    if (typeof s.colId !== 'string' || s.colId.length === 0)
      return false
    // width 若存在必须是有限正数 | width, if present, must be a finite positive number
    if (s.width !== undefined && !isFinitePositiveNumber(s.width))
      return false
    // hidden 若存在必须是 boolean | hidden, if present, must be boolean
    if (s.hidden !== undefined && typeof s.hidden !== 'boolean')
      return false
    // fixed 若存在必须是 'left' | 'right' | false | fixed, if present, must be 'left' | 'right' | false
    if (s.fixed !== undefined && !VALID_FIXED_VALUES.has(s.fixed as string | boolean))
      return false
    // sort 若存在必须是 'ascending' | 'descending' | null | sort, if present, must be 'ascending' | 'descending' | null
    if (s.sort !== undefined && !VALID_SORT_VALUES.has(s.sort as string | null))
      return false
    // sortIndex 若存在必须是有限非负整数 | sortIndex, if present, must be a finite non-negative integer
    if (s.sortIndex !== undefined && !isFiniteNonNegativeInt(s.sortIndex))
      return false
    // schemaVersion 若存在必须是整数 | schemaVersion, if present, must be an integer
    if (s.schemaVersion !== undefined && !Number.isInteger(s.schemaVersion))
      return false
    // mode 若存在必须是 'default' | 'virtual' | mode, if present, must be 'default' | 'virtual'
    // <zh/> 非受信持久化数据的成员检查：cast 仅为通过 Set 泛型约束，真值校验由 has() 在运行时完成
    // <en/> Membership check on untrusted persisted data: the cast only satisfies the Set generic; has() validates at runtime
    if (s.mode !== undefined && !VALID_MODE_VALUES.has(s.mode as RendererModeName))
      return false
    return true
  })
}

/**
 * 列状态管理组合式函数
 *
 * 管理列的宽度、隐藏、固定和排序状态的持久化。
 * 支持自动保存到 localStorage 或自定义存储适配器，提供防抖、错误策略和选择性恢复能力。
 *
 * Column state management composable
 *
 * Manages column width, hidden, fixed, and sort state persistence.
 * Supports auto-saving to localStorage or a custom storage adapter,
 * with debounce, error strategy, and selective restore capabilities.
 *
 * @param options - 配置选项
 * @returns 列状态管理接口
 */
export function useColumnState(options: UseColumnStateOptions): UseColumnStateReturn {
  const {
    localColumns,
    sortState,
    resetColumns,
    setColumns,
    touchColumns,
    setSorts,
    persistence,
    tableId,
    mode: modeGetter,
    onResetColumnWidths,
  } = options

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

  /**
   * 获取当前列的宽度、隐藏、固定和排序状态
   *
   * Get current column width, hidden, fixed, and sort states
   */
  function getColumnState(): ColumnState[] {
    const states: ColumnState[] = []
    const include = persistence.value?.include
    /**
     * <zh/> 记录当前渲染模式，apply 时用于跨模式一致性校验。
     * <zh/> default 模式 width 基于 <table> 模型，virtual 模式基于 Grid 模型，单位语义不同，
     * <zh/> 跨模式应用 width 会导致视觉跳变
     * <en/> Record current render mode for cross-mode consistency check on apply.
     * <en/> default mode width is based on <table> layout, virtual mode on Grid layout, semantics differ,
     * <en/> cross-mode width application causes visual jump
     */
    const currentMode = modeGetter?.()

    traverseColumnTree(localColumns.value, (col) => {
      const key = getColumnKey(col)
      const sortEntry = sortState.value.find(s => (s.columnKey ?? s.prop) === key)

      const entry: ColumnState = { colId: key, schemaVersion: COLUMN_STATE_SCHEMA_VERSION }

      if (!include || include.includes('width'))
        entry.width = col.width
      if (!include || include.includes('hidden'))
        entry.hidden = col.hidden
      if (!include || include.includes('fixed'))
        entry.fixed = col.fixed
      if (!include || include.includes('sort'))
        entry.sort = sortEntry?.order ?? null
      if (!include || include.includes('sortIndex'))
        entry.sortIndex = sortEntry ? sortState.value.indexOf(sortEntry) : undefined
      if ((!include || include.includes('mode')) && currentMode !== undefined)
        entry.mode = currentMode

      states.push(entry)
    })

    return states
  }

  const autoSaveEnabled = computed(() =>
    persistence.value?.enabled && persistence.value?.autoSave !== false,
  )

  const debounceMs = computed(() => persistence.value?.debounce ?? 300)

  async function saveState(): Promise<void> {
    try {
      const state = getColumnState()
      await storage.value.set(storageKey.value, JSON.stringify(state))
    }
    catch (err) {
      handleError('save', err)
    }
  }

  /** applyColumnState 执行期间跳过 deep watch 触发的冗余保存 */
  let _skipWatchSave = false

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

  /**
   * 应用列状态：恢复宽度、隐藏、固定、排序和列顺序
   *
   * Apply column state: restore width, hidden, fixed, sort, and column order
   */
  /** 未知 colId 的 dev 告警（早退守卫替代 try→if→for→if 四层嵌套） */
  function warnOnUnknownColumnIds(state: ColumnState[]): void {
    if (!isDev)
      return
    for (const saved of state) {
      if (findColumnByKey(localColumns.value, saved.colId))
        continue
      devWarn(`[AdvTable] Column state references unknown colId "${saved.colId}", skipping.`)
    }
  }

  function applyColumnState(
    state: ColumnState[] | null | undefined,
    applyOptions?: ApplyColumnStateOptions,
  ): void {
    if (!state || !Array.isArray(state)) {
      if (isDev && state !== undefined) {
        devWarn('[AdvTable] applyColumnState: expected ColumnState[], got', typeof state)
      }
      return
    }

    if (state.length === 0)
      return

    /**
     * <zh/> 字段级 schema 校验（与 restoreState 同源）——`applyColumnState` 是公开 API，
     * <zh/> 且命名视图（applyView）会把存储中的原始 JSON 直接喂入，非法项（`width: -5` /
     * <zh/> `width: "100"` / `fixed: "middle"`）会写出渲染死列或列宽累加失真。
     * <zh/> 采**整体拒绝**而非逐项丢弃：顺序 / 显隐 / 固定构成一致性快照，部分应用会让
     * <zh/> 列布局停在半迁移态（且 `reorderColumns` 的入参集合会被无声裁剪）。
     * <en/> Field-level schema validation (same source as restoreState) — `applyColumnState` is a
     * <en/> public API and named views (`applyView`) feed raw stored JSON straight in; invalid items
     * <en/> (`width: -5` / `width: "100"` / `fixed: "middle"`) would produce broken columns or
     * <en/> corrupt width accumulation. The whole payload is **rejected** instead of dropping items:
     * <en/> order/visibility/pinning form a consistency snapshot, and partial application leaves the
     * <en/> layout half-migrated (and would silently shrink the set handed to `reorderColumns`).
     */
    if (!isValidColumnStateData(state)) {
      if (isDev) {
        devWarn(
          '[AdvTable] applyColumnState: state failed field-level validation and was ignored. '
          + 'Expected ColumnState[] with a non-empty string colId, finite positive width, boolean hidden, '
          + 'fixed ∈ {\'left\', \'right\', true, false}, sort ∈ {\'ascending\', \'descending\', null}.',
        )
      }
      return
    }

    /** <zh/> 恢复状态期间跳过 deep watch 触发的冗余保存（即 isRestoring 守卫），恢复完成后手动触发一次 | <en/> Skip deep-watch save during restore (isRestoring guard), trigger once after restore */
    _skipWatchSave = true
    try {
      const {
        applyOrder = true,
        applyWidth = true,
        applySort = true,
        applyHidden = true,
        applyFixed = true,
      } = applyOptions ?? {}

      /**
       * <zh/> 跨模式列宽语义一致性校验
       * <zh/> default 模式 width 基于 <table> 模型，virtual 模式基于 Grid 模型，
       * <zh/> 两者单位语义不同。若存储时的 mode 与当前 mode 不一致，则跳过 width 应用，
       * <zh/> 避免跨模式应用导致视觉跳变。无 mode 字段的数据照常应用。
       * <en/> Cross-mode width semantic consistency check.
       * <en/> default mode width is based on <table> layout, virtual mode on Grid layout,
       * <en/> the unit semantics differ. If the stored mode mismatches the current mode,
       * <en/> width application is skipped to avoid visual jump. Historical data (no mode field) is applied as usual.
       */
      const currentMode = modeGetter?.()
      const storedMode = state.find(s => s.mode !== undefined)?.mode
      let effectiveApplyWidth = applyWidth
      if (applyWidth && storedMode !== undefined && currentMode !== undefined && storedMode !== currentMode) {
        if (isDev) {
          devWarn(
            `[AdvTable] Column state mode mismatch: stored="${storedMode}", current="${currentMode}". Width application skipped to avoid visual jump.`,
          )
        }
        effectiveApplyWidth = false
      }

      const stateMap = new Map(state.map(s => [s.colId, s]))

      /**
       * <zh/> 恢复列宽前清空 useColumnResize.columnWidths 缓存——
       * <zh/> 否则 columnWidths[key] 中的旧拖拽值会遮蔽 applyColumnState 写入 col.width 的新值
       * <zh/> （getColumnWidth 优先读 columnWidths[key]）。
       * <zh/> 不变量：只要应用宽度就必须先清覆盖层。回调缺失时仅 dev 告警（行为不变），
       * <zh/> 使接线断裂（如新增渲染模式未接 onResetColumnWidths）在开发期可见，
       * <zh/> 而非以"设置没保存"的静默形式漏到生产。
       * <en/> Clear useColumnResize.columnWidths cache before restoring widths
       * <en/> otherwise stale drag values in columnWidths[key] shadow the new col.width
       * <en/> written by applyColumnState (getColumnWidth reads columnWidths[key] first).
       * <en/> Invariant: the overlay must be cleared whenever widths are applied. A missing
       * <en/> callback only warns in dev (behavior unchanged) so broken wiring surfaces
       * <en/> during development instead of leaking to production as "settings not saved".
       */
      if (effectiveApplyWidth) {
        if (onResetColumnWidths) {
          onResetColumnWidths()
        }
        else if (isDev) {
          devWarn(
            '[AdvTable] applyColumnState: restoring widths without onResetColumnWidths wired — '
            + 'stale drag widths in useColumnResize.columnWidths may shadow the restored col.width. '
            + 'Wire options.onResetColumnWidths (see use-adv-table-data-columns).',
          )
        }
      }

      traverseColumnTree(localColumns.value, (col) => {
        const key = getColumnKey(col)
        const saved = stateMap.get(key)
        if (!saved) {
          return
        }

        if (effectiveApplyWidth && typeof saved.width === 'number' && Number.isFinite(saved.width) && saved.width > 0)
          col.width = saved.width
        if (applyHidden && saved.hidden != null)
          col.hidden = saved.hidden
        if (applyFixed && saved.fixed != null)
          col.fixed = saved.fixed as ProcessedColumn['fixed']
      })

      if (touchColumns) {
        touchColumns()
      }
      else {
        localColumns.value = [...localColumns.value]
      }

      if (applySort) {
        const sortEntries = state
          .filter(s => s.sort != null)
          .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
          .map(s => ({ prop: s.colId, order: s.sort! }))

        if (sortEntries.length > 0) {
          setSorts(sortEntries)
        }
      }

      if (applyOrder) {
        const orderedIds = state.map(s => s.colId)
        reorderColumns(orderedIds)
      }

      warnOnUnknownColumnIds(state)
    }
    finally {
      /**
       * <zh/> 下一个微任务释放守卫——自动保存 watcher 为默认 flush:'pre'（微任务内执行），
       * <zh/> 同步复位会使本轮 restore 触发的 watcher 看到已复位的标志，冗余保存漏跳过。
       * <en/> Release the guard on the next microtask — the auto-save watcher runs with
       * <en/> default flush:'pre' (inside a microtask); a synchronous reset makes this
       * <en/> restore-triggered watcher see the flag already cleared and leak the redundant save.
       */
      void nextTick().then(() => {
        _skipWatchSave = false
      })
      /**
       * 恢复完成后触发一次保存，确保存储与当前状态同步
       * Trigger one save after restore to keep storage in sync with current state
       */
      if (autoSaveEnabled.value) {
        debouncedSave()
      }
    }
  }

  /**
   * 根据给定的列 ID 顺序重排列
   *
   * 通过 setColumns API 走正规更新流程，同步 originColumns 并通知父组件。
   * Reorder columns according to the given column ID order.
   *
   * Uses the setColumns API to go through the standard update flow,
   * syncing originColumns and notifying the parent component.
   */
  function reorderColumns(orderedIds: string[]): void {
    const orderIndex = new Map(orderedIds.map((id, i) => [id, i]))
    const reordered = stableReorderByKey(localColumns.value, orderIndex)

    /**
     * 通过 setColumns 走正规更新流程而非直接修改 localColumns.value，
     * 确保 originColumns 同步更新、emitUpdate 通知父组件。
     * Use setColumns instead of directly mutating localColumns.value
     * to ensure originColumns is synced and emitUpdate notifies the parent.
     */
    setColumns(reordered)
  }

  /**
   * 重置列状态到初始值，并清除持久化存储
   *
   * Reset column state to initial values and clear persisted storage
   */
  function resetColumnState(): void {
    // <zh/> 一并清空排序——覆盖列显隐/顺序/宽度与 sortState，防止残留 sort 经 autoSave
    // <zh/> watcher 重新写回存储：resetColumns 触发快照变化 → watcher 触发 → 残留 sort
    // <zh/> 持久化回去。_skipWatchSave 覆盖整个重置过程，nextTick 后解除（watcher 在本 flush 周期内触发）。
    // <en/> Clear sorts too — covers visibility/order/width and sortState, preventing residual
    // <en/> sortState from being re-persisted by the autoSave watcher (resetColumns changes the
    // <en/> snapshot → watcher fires → residual sort written back). _skipWatchSave covers the whole
    // <en/> reset and is released after nextTick (the watcher fires within this flush cycle).
    _skipWatchSave = true
    try {
      setSorts([])
      /**
       * <zh/> 先清列宽覆盖层再重置列——否则 useColumnResize.columnWidths 中的拖拽值会继续
       * <zh/> 经 getColumnWidth 生效，使"重置列"在虚拟模式下宽不生效（列对象虽已换新，
       * <zh/> 覆盖层仍按 key 命中）。必须在 resetColumns() **之前**调用：重置后 columns
       * <zh/> 已是新对象，此处无需（也不应）再回写 col.width。
       * <zh/> 回调缺失时仅 dev 告警（行为不变），理由同 applyColumnState 处的不变量注释。
       * <en/> Clear the width overlay before resetting columns — otherwise drag widths still in
       * <en/> useColumnResize.columnWidths keep winning through getColumnWidth, so "reset columns"
       * <en/> does not reset widths in virtual mode (the overlay matches by key even after the
       * <en/> column objects are replaced). Must run **before** resetColumns(): afterwards the
       * <en/> columns are already new objects and no col.width write-back is needed.
       * <en/> A missing callback only warns in dev (behavior unchanged), same invariant rationale
       * <en/> as in applyColumnState.
       */
      if (onResetColumnWidths) {
        onResetColumnWidths()
      }
      else if (isDev) {
        devWarn(
          '[AdvTable] resetColumnState: resetting columns without onResetColumnWidths wired — '
          + 'stale drag widths in useColumnResize.columnWidths may survive the reset. '
          + 'Wire options.onResetColumnWidths (see use-adv-table-data-columns).',
        )
      }
      resetColumns()
      if (persistence.value?.enabled) {
        try {
          storage.value.remove(storageKey.value)
        }
        catch (err) {
          handleError('remove', err)
        }
      }
    }
    finally {
      void nextTick().then(() => {
        _skipWatchSave = false
      })
    }
  }

  /**
   * <zh/> 仅监听需要持久化的列属性快照，替代 deep: true 全量遍历。
   * <zh/> **注意**：localColumns 是 shallowRef，computed 仅在数组引用变化时重算，
   * <zh/> 直接修改 col.width / col.hidden / col.fixed 属性不会触发 computed（需调用 touchColumns 刷新引用）。
   * <zh/> computed 内部的 prev 内容比较确保引用相同时返回旧引用，避免不必要 watch 触发。
   * <zh/> 防抖（300ms）进一步缓解高频变更。_skipWatchSave 用于跳过
   * <zh/> applyColumnState 自身修改触发的冗余保存。
   * <en/> Only watch snapshots of persistable column properties, replacing deep: true full traversal.
   * <en/> **Note**: localColumns is shallowRef, computed only re-evaluates when the array reference changes;
   * <en/> directly mutating col.width / col.hidden / col.fixed does NOT trigger computed (call touchColumns to refresh the reference).
   * <en/> The internal prev content comparison ensures the old reference is returned when unchanged, avoiding unnecessary watch triggers.
   * <en/> Debounce (300ms) further mitigates high-frequency changes. _skipWatchSave skips
   * <en/> redundant saves triggered by applyColumnState's own modifications.
   */
  const columnStateSnapshot = computed((prev: Array<Record<string, unknown>> | undefined) => {
    const include = persistence.value?.include
    // 使用 traverseColumnTree 遍历全树（含子列），与 getColumnState 保持一致
    // Use traverseColumnTree to traverse the full tree (including sub-columns), consistent with getColumnState
    const next: Array<Record<string, unknown>> = []
    traverseColumnTree(localColumns.value, (col) => {
      const key = getColumnKey(col)
      const snap: Record<string, unknown> = { key }
      if (!include || include.includes('width'))
        snap.width = col.width
      if (!include || include.includes('hidden'))
        snap.hidden = col.hidden
      if (!include || include.includes('fixed'))
        snap.fixed = col.fixed
      next.push(snap)
    })
    // 内容比较：仅当 key/width/hidden/fixed 变更时返回新引用，避免每次重算触发 watch | Content comparison: only return new reference when key/width/hidden/fixed change, avoiding watch trigger on every recompute
    if (prev && prev.length === next.length) {
      let same = true
      for (let i = 0; i < next.length; i++) {
        if (prev[i]?.key !== next[i]?.key
          || prev[i]?.width !== next[i]?.width
          || prev[i]?.hidden !== next[i]?.hidden
          || prev[i]?.fixed !== next[i]?.fixed) {
          same = false
          break
        }
      }
      if (same)
        return prev
    }
    return next
  })
  watch(
    [columnStateSnapshot, sortState],
    () => {
      if (_skipWatchSave)
        return
      if (autoSaveEnabled.value) {
        debouncedSave()
      }
    },
  )

  // 异步恢复代际：scope 释放/deactivate 时推进，过期结果直接丢弃。
  // 声明在 restoreState 之前——它捕获/比对该值，前向引用会触发 TDZ。
  // Restore generation: bumped on scope dispose/deactivate so stale results are dropped .
  // Declared before restoreState, which captures and compares it (forward reference would TDZ).
  let columnStateGeneration = 0

  /**
   * <zh/> 异步恢复失败的统一承接点——`handleError` 已派发 `onStorageError` 并遵守 errorStrategy；
   * <zh/> 本函数只负责阻止 Promise 拒绝从 onMounted / watch 这类**无调用方**的路径逃逸为
   * <zh/> unhandledrejection（与 `debouncedSave` 的 `.catch` 处理同构）。
   *
   * <en/> Unified sink for async-restore failures — `handleError` already dispatched `onStorageError`
   * <en/> and honoured errorStrategy; this only stops the rejection escaping as an unhandledrejection
   * <en/> from caller-less paths (onMounted / watch), mirroring `debouncedSave`'s `.catch` treatment.
   *
   * @param err - <zh/> 存储层抛出的原始错误 | <en/> raw error thrown by the storage layer
   */
  function sinkRestoreFailure(err: unknown): void {
    // <zh/> 仅 'throw' 策略下补可见性告警：'warn' / 'silent' 已由 handleError 内部告警，避免重复
    // <en/> Warn only under the 'throw' strategy: 'warn' / 'silent' already warned inside handleError
    if (isDev && (persistence.value?.errorStrategy ?? 'silent') === 'throw') {
      devWarn('[AdvTable] Column state restore failed (errorStrategy="throw" is not propagated on async restore):', err)
    }
  }

  async function restoreState(): Promise<void> {
    // 捕获 await 前的身份：key/adapter/generation。await 后逐项比对，
    // key 切换、adapter 切换、scope 释放后旧结果不再应用。
    const restoreKey = storageKey.value
    const restoreAdapter = storage.value
    const restoreGeneration = columnStateGeneration
    try {
      const raw = await restoreAdapter.get(restoreKey)
      if (restoreGeneration !== columnStateGeneration)
        return
      if (storageKey.value !== restoreKey || storage.value !== restoreAdapter)
        return
      if (raw == null)
        return

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      }
      catch {
        // <zh/> 损坏 JSON 不应在存储中永留——否则每次挂载/激活都重复解析失败。
        // <zh/> 与 invalid-structure / schema 分支同路径清理。
        // <en/> Corrupted JSON must not stay in storage forever — it would re-fail on every
        // <en/> mount/activate. Same cleanup path as the invalid-structure / schema branches.
        if (isDev) {
          devWarn('[AdvTable] Stored column state is not valid JSON, discarding.')
        }
        try {
          await storage.value.remove(storageKey.value)
        }
        catch (err) {
          handleError('remove', err)
        }
        return
      }
      if (!isValidColumnStateData(parsed)) {
        if (isDev) {
          devWarn('[AdvTable] Stored column state has invalid structure, discarding.')
        }
        try {
          await storage.value.remove(storageKey.value)
        }
        catch (err) {
          handleError('remove', err)
        }
        return
      }

      // schema 版本校验：缺失字段按默认策略加载，存在且不匹配则重置 | Schema version validation: missing field treated as historical data (migration load), reset if present and mismatched
      const versionMismatch = parsed.some(
        s => s.schemaVersion !== undefined && s.schemaVersion !== COLUMN_STATE_SCHEMA_VERSION,
      )
      if (versionMismatch) {
        if (isDev) {
          devWarn('[AdvTable] Column state schema version mismatch, resetting to current layout.')
        }
        try {
          await storage.value.remove(storageKey.value)
        }
        catch (err) {
          handleError('remove', err)
        }
        return
      }

      // 应用前二次校验：解析/remove 等待期间 key/adapter/generation 可能已变化
      if (restoreGeneration !== columnStateGeneration)
        return
      if (storageKey.value !== restoreKey || storage.value !== restoreAdapter)
        return
      applyColumnState(parsed)
    }
    catch (err) {
      /**
       * <zh/> 不在此处 rethrow：`handleError` 已按 errorStrategy 派发 `onStorageError`
       * <zh/> （'throw' 时其内部抛出的异常也在此被接住），异步路径没有调用方承接拒绝，
       * <zh/> 继续向外抛会变成 unhandledrejection。
       * <en/> No rethrow here: `handleError` already dispatched `onStorageError` per errorStrategy
       * <en/> (including the throw it performs under 'throw'), and async paths have no caller to
       * <en/> receive the rejection — propagating it would surface as an unhandledrejection.
       */
      sinkRestoreFailure(err)
    }
  }

  /** <zh/> 等待列就绪的 once watcher 句柄（onMounted / onActivated 共用，见 restoreWhenColumnsReady） | <en/> Handle for the once watcher awaiting columns (shared by onMounted/onActivated, see restoreWhenColumnsReady) */
  let pendingWatchStop: (() => void) | null = null
  let _hasRestored = false

  /**
   * <zh/> 列未就绪时注册 once watcher 等列到达后恢复——onMounted 与 onActivated 共用。
   * <zh/> 两份拷贝曾各自漂移（KeepAlive 下 onMounted 先跑、onActivated 再跑同一分支）。
   * <en/> Registers a once watcher awaiting column arrival when columns aren't ready yet —
   * <en/> shared by onMounted and onActivated. The two copies used to drift independently
   * <en/> (under KeepAlive onMounted runs first, then onActivated re-enters the same branch).
   */
  function restoreWhenColumnsReady(): void {
    // <zh/> 注册前先停掉可能存在的旧 once watcher——KeepAlive 下 onMounted 与 onActivated
    // <zh/> 会先后进入本分支，不停旧的会让句柄被覆盖而丢失（stop1 只能靠 once 自停）。
    // <en/> Stop any existing once watcher first — under KeepAlive both onMounted and onActivated
    // <en/> reach this branch, and not stopping leaves the handle overwritten and lost.
    pendingWatchStop?.()
    const stop = watch(localColumns, (cols) => {
      if (cols.length > 0) {
        // <zh/> await 异步恢复完成后再标记，避免后续入口在 restore 未完成时跳过重复恢复
        // <en/> Await async restore completion before marking, so later entries don't skip a re-restore while in flight
        void restoreState().then(() => {
          _hasRestored = true
          pendingWatchStop = null
        })
      }
    }, { once: true })
    pendingWatchStop = stop
  }

  onMounted(async () => {
    if (!persistence.value?.enabled || persistence.value?.autoRestore === false)
      return

    await nextTick()

    if (localColumns.value.length > 0) {
      // <zh/> await restoreState 确保异步恢复完成后再标记 _hasRestored，
      // <zh/> 避免 onActivated 在 restore 未完成时跳过重复恢复逻辑
      // <en/> await restoreState to ensure async restore completes before marking _hasRestored,
      // <en/> preventing onActivated from skipping re-restore logic while restore is in-flight
      await restoreState()
      _hasRestored = true
      return
    }

    restoreWhenColumnsReady()
  })

  function cleanupColumnStateResources() {
    pendingWatchStop?.()
    pendingWatchStop = null
    // 推进代际：进行中的异步 restore 在 await 后会被丢弃，不再覆盖新布局
    columnStateGeneration++
    // <zh/> flush 而非 cancel——KeepAlive 停用/卸载前把防抖窗口内（≤300ms）的未落盘
    // <zh/> 变更立即写入存储，cancel 会直接丢弃这些变更（静默丢失用户的最后调整）。
    // <en/> flush instead of cancel — persist changes still inside the debounce window (≤300ms)
    // <en/> before KeepAlive deactivation/unmount; cancel silently dropped the user's latest
    // <en/> adjustments.
    debouncedSave.flush()
  }

  onScopeDispose(cleanupColumnStateResources)

  onDeactivated(() => {
    cleanupColumnStateResources()
  })

  /**
   * <zh/> KeepAlive 重新激活时恢复列状态 watcher 与持久化保存逻辑
   * <zh/> onDeactivated 清理了 pendingWatchStop 和 debouncedSave，
   * <zh/> onActivated 需要在条件满足时重新启动恢复流程
   * <en/> Restore column-state watcher and persistence save logic on KeepAlive reactivation.
   * <en/> onDeactivated cleaned up pendingWatchStop and debouncedSave;
   * <en/> onActivated needs to re-initiate the restore flow when conditions are met.
   */
  onActivated(async () => {
    if (!persistence.value?.enabled || persistence.value?.autoRestore === false)
      return

    // 已恢复过且列已加载——无需重复恢复
    // Already restored and columns loaded — no need to re-restore
    if (_hasRestored && localColumns.value.length > 0)
      return

    await nextTick()

    if (localColumns.value.length > 0) {
      if (!_hasRestored) {
        await restoreState()
        _hasRestored = true
      }
      return
    }

    // 列尚未加载，重新注册 once watcher 等待列加载后恢复
    // Columns not yet loaded, re-register once watcher to wait for columns
    // <zh/> 与 onMounted 分支共用 restoreWhenColumnsReady（单一实现，内部先停旧句柄）
    // <en/> Shared with the onMounted branch via restoreWhenColumnsReady (single implementation; stops the old handle internally)
    restoreWhenColumnsReady()
  })

  return {
    getColumnState,
    applyColumnState,
    resetColumnState,
  }
}
