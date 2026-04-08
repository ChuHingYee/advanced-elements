import type { MaybeRefOrGetter, Ref } from 'vue'
import type { ProcessedColumn } from '../../types'
import { computed, ref, shallowRef, toValue, watch } from 'vue'
import { buildFilteredTree } from '../../utils/column-tree'
import { getColumnKey, isGroupColumn } from '../../utils/shared'

/**
 * <zh/> useColumnCollapse 选项
 * <en/> Options for useColumnCollapse composable
 */
export interface UseColumnCollapseOptions {
  /**
   * <zh/> 列树引用，用于 canCollapse 检查与 effectiveColumns 计算
   * <en/> Column tree reference, used for both canCollapse checks and effectiveColumns computation
   */
  columns: MaybeRefOrGetter<ProcessedColumn[]>
}

/**
 * <zh/> useColumnCollapse 返回值
 * <en/> Return type of useColumnCollapse composable
 */
export interface UseColumnCollapseReturn {
  /** <zh/> 判断列是否可折叠（含有设置了 columnGroupShow 的子列） | <en/> Check if a column can be collapsed (has child columns with columnGroupShow set) */
  canCollapse: (col: ProcessedColumn) => boolean
  /** <zh/> 判断列是否处于折叠状态 | <en/> Check if a column is collapsed */
  isCollapsed: (columnKey: string) => boolean
  /** <zh/> 切换列的折叠/展开状态 | <en/> Toggle column collapse/expand state */
  toggleCollapse: (columnKey: string) => void
  /**
   * <zh/> 根据折叠状态过滤子列后的有效列列表。仅供数据管道使用——渲染器不应使用此值
   * <en/> Effective column list after filtering children by collapse state. For data pipeline only — renderer should not use this
   */
  effectiveColumns: Ref<ProcessedColumn[]>
  /**
   * <zh/> 折叠状态的响应式引用，用于依赖追踪。渲染器通过此对象在折叠状态变化时重新计算
   * <en/> Reactive ref for collapse state, used for dependency tracking. Renderer uses this to recompute on collapse state change
   */
  collapsedState: Ref<Record<string, boolean>>
  /**
   * <zh/> 版本计数器，用于强制依赖追踪。每次折叠状态变化时递增
   * <en/> Version counter for forced dependency tracking. Increments on each collapse state change
   */
  collapsedVersion: Ref<number>
}

/**
 * 列折叠/展开逻辑 Composable。
 * Manage collapse/expand state for group columns.
 *
 * 架构说明：
 * - `effectiveColumns`：数据管道使用的过滤后列列表（隐藏/显示子列）
 * - `canCollapse` / `isCollapsed`：渲染器使用，用于显示折叠按钮
 * - 渲染器使用原始列（来自 localColumns）判断可折叠性，而非 effectiveColumns
 */
export function useColumnCollapse(options: UseColumnCollapseOptions): UseColumnCollapseReturn {
  const { columns } = options

  // 折叠状态映射表（columnKey -> boolean）—— shallowRef 避免深层劫持，手动 triggerRef 触发更新 | Collapse state map (columnKey -> boolean) — shallowRef avoids deep hijacking, manual triggerRef for updates
  const collapsedState = shallowRef<Record<string, boolean>>({})
  // 版本计数器，每次折叠状态变化时递增，用于渲染器依赖追踪 | Version counter, increments on each collapse state change, used for renderer dependency tracking
  const collapsedVersion = ref(0)

  /**
   * <zh/> 判断列是否可折叠。
   * <zh/> 条件：分组列、未被 `collapsible: false` 显式禁用，且至少有一个子列的
   * <zh/> columnGroupShow 不为 null/undefined。
   * <en/> Determine if a column is collapsible.
   * <en/> Condition: group column, NOT explicitly disabled via `collapsible: false`, and with at
   * <en/> least one child whose columnGroupShow is not null/undefined.
   */
  function canCollapse(col: ProcessedColumn): boolean {
    if (!isGroupColumn(col) || !col.children?.length)
      return false
    // <zh/> collapsible: false 显式退出折叠能力（声明式 API 的能力开关）
    // <en/> collapsible: false explicitly opts out of collapsing (capability switch of the declarative API)
    if (col.collapsible === false)
      return false
    return col.children.some(
      child => child.columnGroupShow !== null && child.columnGroupShow !== undefined,
    )
  }

  /**
   * <zh/> 判断列是否处于折叠状态。
   * @param columnKey - <zh/> 列标识 | <en/> column key
   * @returns <zh/> 是否折叠 | <en/> whether collapsed
   */
  function isCollapsed(columnKey: string): boolean {
    return collapsedState.value[columnKey] === true
  }

  /**
   * <zh/> 已显式切换过的列 key——保证数据刷新重新播种时不会覆盖用户操作
   * <en/> Keys explicitly toggled by users — guarantees re-seeding after data refresh
   * <en/> never clobbers user actions
   */
  const toggledKeys = new Set<string>()
  /**
   * <zh/> 已播种的 key → 上一次参与播种的**声明式** `collapsed` 取值。
   * <zh/> 记录取值（而非仅记录"已播种"），父组件后续把 `collapsed` 改为 `true` 才能再次生效。
   *
   * <en/> Seeded key → the **declarative** `collapsed` value used for the last seeding. The value (not
   * <en/> just "already seeded") is recorded so a later `collapsed: true` from the parent takes effect.
   */
  const seededKeys = new Map<string, boolean>()

  function toggleCollapse(columnKey: string) {
    const state = { ...collapsedState.value }
    const current = state[columnKey]
    state[columnKey] = current === undefined ? true : !current
    collapsedState.value = state
    collapsedVersion.value++
    toggledKeys.add(columnKey)
  }

  // ── collapsed?: boolean 默认态播种（声明式 API 的默认折叠能力）──
  // ── Seed default-collapsed state from `collapsed?: boolean` (default-collapse capability of the declarative API) ──

  function seedDefaultCollapsed(cols: ProcessedColumn[]): void {
    let mutated = false
    const state = { ...collapsedState.value }
    /** <zh/> 本轮遍历到的 key，用于剪除已移除列的播种记录 | <en/> Keys seen this pass, used to prune records of removed columns */
    const liveKeys = new Set<string>()
    const walk = (list: ProcessedColumn[]): void => {
      for (const col of list) {
        if (!isGroupColumn(col) || !col.children?.length)
          continue
        // <zh/> 与 buildFilteredTree/canCollapse 同口径：统一用 getColumnKey，避免无 key 多组共用 '' 互相污染。
        // <en/> Same caliber as buildFilteredTree/canCollapse: always getColumnKey, so key-less groups
        // <en/> never share the '' bucket and pollute each other.
        const key = getColumnKey(col)
        liveKeys.add(key)
        const declarativeCollapsed = col.collapsed === true
        // <zh/> 仅当"未播种过"或"声明式取值发生变化"时才重新播种，避免覆盖用户操作
        // <en/> Re-seed only when never seeded or when the declarative value changed, so user actions survive
        if (!seededKeys.has(key) || seededKeys.get(key) !== declarativeCollapsed) {
          seededKeys.set(key, declarativeCollapsed)
          if (col.collapsible !== false && declarativeCollapsed && !toggledKeys.has(key) && state[key] !== true) {
            state[key] = true
            mutated = true
          }
        }
        if (col.children.length)
          walk(col.children)
      }
    }
    walk(cols)
    for (const key of seededKeys.keys()) {
      if (!liveKeys.has(key))
        seededKeys.delete(key)
    }
    if (mutated) {
      collapsedState.value = state
      collapsedVersion.value++
    }
  }

  watch(
    () => toValue(columns),
    cols => seedDefaultCollapsed(cols),
    { immediate: true },
  )

  function buildEffectiveColumns(cols: ProcessedColumn[]): ProcessedColumn[] {
    const result = buildFilteredTree(cols, isCollapsed)

    if (result.length === cols.length) {
      let same = true
      for (let i = 0; i < result.length; i++) {
        if (result[i] !== cols[i]) {
          same = false
          break
        }
      }
      if (same)
        return cols
    }
    return result
  }

  const effectiveColumns = computed<ProcessedColumn[]>((prev) => {
    const cols = toValue(columns)
    const result = buildEffectiveColumns(cols)
    if (prev && result === prev)
      return prev
    return result
  })

  return {
    canCollapse,
    isCollapsed,
    toggleCollapse,
    effectiveColumns,
    collapsedState,
    collapsedVersion,
  }
}
