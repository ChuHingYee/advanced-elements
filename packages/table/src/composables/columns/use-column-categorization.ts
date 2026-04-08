import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type { ProcessedColumn } from '../../types'
import { computed, toValue } from 'vue'
import { getColumnKey } from '../../utils/shared'

/**
 * <zh/> 列分类选项
 * <en/> Options for column categorization
 */
export interface UseColumnCategorizationOptions {
  /** <zh/> 已选中的列（用于生成同步 key） | <en/> Selected columns (for generating sync key) */
  selectionColumns: MaybeRefOrGetter<ProcessedColumn[]>
  /** <zh/> hover 操作列的原始数据源 | <en/> Raw data source for hover option columns */
  hoverOptionColumns: MaybeRefOrGetter<ProcessedColumn[]>
  /** <zh/> 普通显示列的原始数据源 | <en/> Raw data source for display normal columns */
  displayNormalColumns: MaybeRefOrGetter<ProcessedColumn[]>
  /** <zh/> 是否启用 Teleport（hover 操作列在右侧表头的 teleport） | <en/> Whether to enable Teleport (hover option columns teleport in right header) */
  hasTeleport: MaybeRefOrGetter<boolean>
  /** <zh/> 是否存在 fixed 列（'left' | 'right'），用于 hoverActions.teleport = 'auto' 时自动判断渲染模式 | <en/> Whether there are fixed columns ('left' | 'right'), used for auto-detecting render mode when hoverActions.teleport = 'auto' */
  hasFixed: MaybeRefOrGetter<boolean>
  /** <zh/> 是否全部列保持 keepAlive | <en/> Whether all columns keep keepAlive */
  allKeepAlive: MaybeRefOrGetter<boolean>
}

/**
 * <zh/> 列分类结果
 * <en/> Result of column categorization
 */
export interface ColumnCategorization {
  /** <zh/> hover 操作列响应式列表 | <en/> Reactive list of hover option columns */
  hoverOptionColumns: ComputedRef<ProcessedColumn[]>
  /** <zh/> 是否存在 hover 操作列（列表非空） | <en/> Whether hover option columns exist (non-empty) */
  hasHoverOptionColumns: ComputedRef<boolean>
  /** <zh/> 是否启用 hover 操作列 Teleport | <en/> Whether to enable hover option column Teleport */
  hoverOptionTeleport: ComputedRef<boolean>
  /** <zh/> 普通显示列响应式列表 | <en/> Reactive list of display normal columns */
  displayNormalColumns: ComputedRef<ProcessedColumn[]>
  /** <zh/> 选择列同步 key——将选择列 key 拼接为字符串，用于 v-for 重新渲染 | <en/> Selection column sync key — concatenates selection column keys into a string for v-for re-rendering */
  selectionColumnSyncKey: ComputedRef<string>
  /** <zh/> 是否所有列保持 keepAlive | <en/> Whether all columns keep keepAlive */
  keepAlive: ComputedRef<boolean>
  /** <zh/> 是否存在 fixed 列，响应式追踪列配置变化 | <en/> Whether there are fixed columns, reactively tracks column config changes */
  hasFixed: ComputedRef<boolean>
}

/**
 * 列分类 Composable——将列分类信息（hover、selection、teleport 等）转为响应式 computed，
 * 避免下游每次使用时重复计算。
 *
 * <zh/> 与 `classifyColumns`（data/use-column-classification）的分工：上游做单次 DFS 产出
 * <zh/> `ColumnClassification` 明细值，本函数只做下游 computed 包装 + 派生（syncKey/teleport 判定），不重复遍历。
 * <en/> Relation to `classifyColumns` (data/use-column-classification): upstream runs a single DFS
 * <en/> producing the `ColumnClassification` detail values; this function only adds the downstream
 * <en/> computed wrapper + derivations (syncKey/teleport decision) without re-traversing.
 *
 * @param options - 源分类数据
 * @returns 各类列的响应式 computed
 * `hoverOptionTeleport` 会解析 `hoverActions.teleport` 配置：
 *   - `false`: 强制行内渲染（绝对定位），每行独立渲染，等同于 'auto' 无 fixed 列的效果
 *   - `'auto'`: 存在 fixed 列时返回 true（Teleport），否则返回 false（行内渲染）
 *   - 非 `false`/`'auto'` 配置维持原 `hasTeleport` 逻辑
 */
export function useColumnCategorization(options: UseColumnCategorizationOptions): ColumnCategorization {
  const {
    selectionColumns,
    hoverOptionColumns: hoverSource,
    displayNormalColumns: displaySource,
    hasTeleport: teleportSource,
    hasFixed: hasFixedSource,
    allKeepAlive: keepAliveSource,
  } = options

  const hoverOptionColumns = computed(() => toValue(hoverSource))

  const hasHoverOptionColumns = computed(() => hoverOptionColumns.value.length > 0)

  const displayNormalColumns = computed(() => toValue(displaySource))

  const hasFixed = computed(() => toValue(hasFixedSource))

  const keepAlive = computed(() => toValue(keepAliveSource))

  // 解析 hoverActions.teleport：
  // - false: 强制行内渲染（绝对定位），无视 fixed 列
  // - 'auto': 有 fixed 列时使用 Teleport，无 fixed 列时行内渲染
  // Resolve hoverActions.teleport:
  // - false: force inline rendering (absolute positioning), ignore fixed columns
  // - 'auto': use Teleport when fixed columns exist, inline rendering otherwise
  const hoverOptionTeleport = computed(() => {
    const cols = hoverOptionColumns.value
    const fixed = hasFixed.value
    for (const col of cols) {
      const hoverActions = col.hoverActions
      if (typeof hoverActions === 'object') {
        if (hoverActions.teleport === false) {
          return false
        }
        if (hoverActions.teleport === 'auto') {
          return fixed
        }
      }
    }
    return toValue(teleportSource)
  })

  const selectionColumnSyncKey = computed(() =>
    toValue(selectionColumns)
      .map((col: ProcessedColumn, index: number) => getColumnKey(col) || `selection-${index}`)
      .join('|'),
  )

  return {
    hoverOptionColumns,
    hasHoverOptionColumns,
    hoverOptionTeleport,
    displayNormalColumns,
    selectionColumnSyncKey,
    keepAlive,
    hasFixed,
  }
}
