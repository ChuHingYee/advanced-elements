import type { TableInstance } from 'element-plus'
import type { ComputedRef, CSSProperties, MaybeRefOrGetter, Ref, ShallowRef, Slots } from 'vue'
import type { CheckStatus } from '../../composables/selection/use-selection-state'
import type { ProcessedColumn as LocalColumn } from '../../types'
import type { RowKeyMeta } from '../../types/row-rect'
import type { Translator } from '../../types/translator'
import type { TableRendererExpose } from '../../utils/table-drag'
import type { IRendererDomAdapter } from '../renderer-core/dom-adapter'
import { useElementSize } from '@vueuse/core'
import { ElTable } from 'element-plus'
import { computed, ref, shallowRef, toValue, watch } from 'vue'

import { useHoverLayerStyle } from '../../composables/rendering/use-hover-layer'
import { useRendererCommon } from '../../composables/rendering/use-renderer-common'
import { shallowEqual } from '../../utils/equality'
import { filterTableProps } from '../../utils/filter-table-props'
import { buildColumnIndexOrder, getColumnKey } from '../../utils/shared'
import { createRendererExpose, useSharedCurrentRow } from '../renderer-core/renderer-expose'

export interface UseTableRendererOptions<T extends Record<string, any> = Record<string, any>> {
  /** <zh/> 低性能档（透传至 useRendererCommon/useHoverLayer） | <en/> Low performance tier (forwarded to useRendererCommon/useHoverLayer) */
  lowPerformance?: MaybeRefOrGetter<boolean>
  /** <zh/> 组件 props | <en/> Component props */
  props: {
    columns: LocalColumn[]
    leafColumns?: LocalColumn[]
    data: T[]
    rowKey: (row: T) => string
    forwardedSlots?: Slots
    t?: Translator
    selectionColumns: LocalColumn[]
    normalColumns: LocalColumn[]
    selectableData: T[]
    selectableFn?: (row: T, index: number) => boolean
    checkStatus: CheckStatus
    hoverOptionColumns?: LocalColumn[]
    hasHoverOptionColumns?: boolean
    hoverOptionTeleport?: boolean
    displayNormalColumns?: LocalColumn[]
    selectionColumnSyncKey?: string
    keepAliveHover?: boolean
    /** <zh/> 当前模式 DOM 适配器（透传至 useRendererCommon/useHoverLayer） | <en/> Current-mode DOM adapter (forwarded to useRendererCommon/useHoverLayer) */
    dom?: MaybeRefOrGetter<IRendererDomAdapter | null | undefined>
  }
  rowKeyMeta?: MaybeRefOrGetter<RowKeyMeta<T>>
  // <zh/> element-plus 2.14.7 起 ElTable 的类型声明改为泛型函数组件（无 construct signature），
  // <zh/> InstanceType<typeof ElTable> 不再成立，改用官方导出的 TableInstance（ElTableV2 仍为构造型，沿用 InstanceType）。
  // <en/> From element-plus 2.14.7 ElTable is declared as a generic function component (no construct
  // <en/> signature), so InstanceType<typeof ElTable> no longer resolves; use the official TableInstance
  // <en/> (ElTableV2 stays constructor-shaped, so InstanceType still applies there).
  tableRef: Ref<TableInstance | null>
}

/**
 * <zh/> ElTable 运行时 props 对象——element-plus 2.14.7 起其类型声明不再暴露静态 props（泛型函数组件），
 * <zh/> 运行时仍是 48 键的 props 对象。仅此处断言一次，其余代码经本常量访问（ep-props guard 测试锚定同一来源）。
 * <en/> ElTable's runtime props object — from element-plus 2.14.7 the type no longer exposes static
 * <en/> props (generic function component) while the runtime object still has 48 keys. Narrowed once
 * <en/> here; other code reads through this constant (the ep-props guard test anchors the same source).
 */
const EL_TABLE_PROPS: Record<string, unknown> = (ElTable as unknown as { props?: Record<string, unknown> }).props ?? {}

/**
 * <zh/> ElTable prop 键集合（懒求值）
 * <en/> ElTable prop key set (lazily evaluated)
 * @remarks
 * <zh/> 模块顶层求值会在 SSR import 阶段执行，延迟到首次调用可避免服务端崩溃；与 virtual 侧对称。
 * <en/> Module-level evaluation runs at SSR import time; deferring to first call avoids server crashes; symmetric with the virtual side.
 */
let cachedElTablePropKeys: Set<string> | null = null
function getElTablePropKeys(): Set<string> {
  if (!cachedElTablePropKeys) {
    // <zh/> SSR 无 window 时返回空集合走透传降级 | <en/> Empty set for passthrough fallback without window in SSR
    if (typeof window === 'undefined')
      cachedElTablePropKeys = new Set()
    else
      cachedElTablePropKeys = new Set(Object.keys(EL_TABLE_PROPS))
  }
  return cachedElTablePropKeys
}

/**
 * <zh/> 模板已显式绑定的键——filterTableProps 排除透传。由 ep-props guard 测试锚定：任一条目必须真实存在于 ElTable.props，否则为幻觉键。
 * <zh/> 注意 `loading` 不在此列：ElTable 本体无 loading prop（加载态走模板 `v-loading` 指令），快照集合本就拦下它，无需重复排除。
 * <en/> Template-bound keys excluded from passthrough. Anchored by the ep-props guard test: every entry must really exist in ElTable.props.
 * <en/> Note `loading` is absent by design: ElTable has no loading prop (loading goes through the template `v-loading` directive); the snapshot set already blocks it.
 */
export const EXPLICITLY_BOUND = new Set([
  'data',
  'rowKey',
  'showSummary',
  'summaryMethod',
  'sumText',
])

// 不依赖 ElTable 内部非公开 ref bodyWidth（含正则解析该字段）：改用 ResizeObserver 直接测量
// body 包装元素宽度，消除 Element Plus 升级导致 hover 层定位静默错乱的风险
// Does not rely on ElTable's private bodyWidth ref (nor a regex parse of it): the body wrapper
// width is measured via ResizeObserver, removing the EP-upgrade misalignment risk

export interface UseTableRendererReturn<T extends Record<string, any> = Record<string, any>> {
  currentRow: ShallowRef<T | null>
  bodyWidth: Ref<number>
  hoverLayerStyle: ComputedRef<CSSProperties>
  rendererExpose: TableRendererExpose
  hoverOptionColumns: ComputedRef<LocalColumn[]>
  hasHoverOptionColumns: ComputedRef<boolean>
  hoverOptionTeleport: ComputedRef<boolean | undefined>
  displayNormalColumns: ComputedRef<LocalColumn[]>
  selectionColumnSyncKey: ComputedRef<string>
  tableProps: ComputedRef<Record<string, unknown>>
  hoverRowKey: Ref<string | null>
  /** <zh/> 悬停行数据（不透明行对象，实现侧恒为 shallowRef，禁止深代理） | <en/> Hovered row data (opaque row object, always a shallowRef impl-side, never deeply proxied) */
  hoverRowData: Ref<any>
  hoverRowIndex: Ref<number>
  hoverLayerVisible: Ref<boolean>
  hoverLayerCollapsed: Ref<boolean>
  toggleHoverLayerCollapse: (event: Event) => void
  handleHoverLayerEnter: () => void
  handleHoverLayerLeave: () => void
  /** <zh/> 滚动停止后重新发现鼠标下方的行 | <en/> Re-discover the row under the cursor after scrolling stops */
  rediscoverHoverAfterScroll: () => void
  hoverTableEvents: ComputedRef<Record<string, ((...args: any[]) => void) | undefined>>
  handleScroll: { (args: { scrollLeft: number }): void, cancel: () => void }
  /**
   * <zh/> 滚动状态标志
   * <en/> Scroll state flag
   * @remarks
   * <zh/> 由 useTeleportRowRect 的 wrappedHandleScroll 维护（滚动中 true / 停止后 false），
   * 传入 useHoverLayer 在滚动期间抑制 handleHoverRowEnter，避免滚动时鼠标跨行
   * 频繁触发 hover 状态重算与 locateHoveredRow 强制布局读取导致卡顿
   * <en/> Maintained by useTeleportRowRect's wrappedHandleScroll (true while scrolling / false after stopping),
   * passed to useHoverLayer to suppress handleHoverRowEnter during scrolling, avoiding frequent
   * hover state recalculation and locateHoveredRow forced layout reads causing jank
   */
  isScrolling: Ref<boolean>
  rowIndexMap: ShallowRef<Map<string, number>>
  columnIndexMap: ShallowRef<Map<string, number>>
  /**
   * <zh/> 统一列索引域顺序的列数组（selection + normal 非 fixed + normal fixed），
   * <zh/> 与虚拟渲染器的 data-adv-cell-col 索引域一致，供 resolveColumn 按索引取列对象
   * <en/> Columns in the unified column index domain order (selection + normal non-fixed + normal fixed),
   * <en/> aligned with the virtual renderer's data-adv-cell-col index domain, for resolveColumn to fetch the column object by index
   */
  columnIndexColumns: ComputedRef<LocalColumn[]>
}

/**
 * <zh/> ElTable 渲染器 composable，管理列渲染、事件绑定与单元格交互
 * <en/> ElTable renderer composable, manages column rendering, event binding, and cell interaction
 */
export function useTableRenderer<T extends Record<string, any> = Record<string, any>>(options: UseTableRendererOptions<T>): UseTableRendererReturn<T> {
  const { props, tableRef, rowKeyMeta, lowPerformance } = options
  // <zh/> currentRow 三源合一——注入共享引用（无 provider 时回退本地 ref），替代本地 shallowRef
  // <en/> currentRow three-sources-unified — inject the shared reference (falls back to a local ref
  // <en/> without a provider) instead of a renderer-local shallowRef
  const currentRow = useSharedCurrentRow<T>()

  const tableEl = computed(() => (tableRef.value?.$el ?? null) as HTMLElement | null)
  const { width: containerWidth } = useElementSize(tableEl)

  // 通过 ResizeObserver 直接测量 body 包装元素宽度；禁止依赖 ElTable 内部非公开 ref bodyWidth
  // 或对该字段做正则解析（脆弱方案）——Element Plus 升级不得因 bodyWidth 类型/格式变化导致
  // hover 层定位静默错乱。
  // <zh/> 选择器经 DOM 适配器解析（命名空间化），缺 dom 时跳过测量（与未命中同等处理）
  // <en/> The selector is resolved through the DOM adapter (namespaced); without `dom` the
  // <en/> measurement is skipped (treated as a miss)
  const bodyWrapperEl = computed<HTMLElement | null>(() => {
    const bodySelector = toValue(props.dom)?.getBodySelector()
    if (!bodySelector)
      return null
    return tableEl.value?.querySelector<HTMLElement>(bodySelector) ?? null
  })
  const { width: bodyWidth } = useElementSize(bodyWrapperEl)

  const { hoverLayerStyle, handleScroll } = useHoverLayerStyle({
    contentWidth: bodyWidth,
    containerWidth,
  })

  /**
   * <zh/> 滚动状态标志
   * <en/> Scroll state flag
   * @remarks
   * <zh/> 在 useTeleportRowRect 之前创建，保证 useRendererCommon → useHoverLayer 能读取到。
   * 滚动期间为 true，抑制 handleHoverRowEnter，避免多列 + teleport 场景下滚动卡顿
   * <en/> Created before useTeleportRowRect to ensure useRendererCommon → useHoverLayer can read it.
   * Set to true during scrolling to suppress handleHoverRowEnter, avoiding scroll jank in multi-column + teleport scenarios
   */
  const isScrolling = ref(false)

  const {
    hoverRowKey,
    hoverRowData,
    hoverRowIndex,
    hoverLayerVisible,
    hoverLayerCollapsed,
    toggleHoverLayerCollapse,
    handleHoverLayerEnter,
    handleHoverLayerLeave,
    rediscoverHoverAfterScroll,
    hoverEvents,
  } = useRendererCommon({
    hoverOptionColumns: () => props.hoverOptionColumns ?? [],
    hasHoverOptionColumns: () => props.hasHoverOptionColumns ?? false,
    hoverOptionTeleport: () => props.hoverOptionTeleport ?? false,
    displayNormalColumns: () => props.displayNormalColumns ?? [],
    selectionColumnSyncKey: () => props.selectionColumnSyncKey ?? '',
    keepAlive: () => props.keepAliveHover ?? false,
    rowKeyMeta,
    // <zh/> 传入渲染数据 + rowKey，使 useRowKeyMetaResolver 优先从渲染数据构建 keyToIndex
    // <en/> Pass render data + rowKey so useRowKeyMetaResolver prefers building keyToIndex from render data
    data: () => props.data,
    rowKey: () => props.rowKey,
    containerRef: tableEl,
    handleScroll,
    isScrolling,
    lowPerformance,
    dom: props.dom,
  })

  const hoverTableEvents = hoverEvents.createElTableHoverEvents()

  // 采用 shallowRef + watch 按需重建——数据引用不变则 Map 引用不变，
  // 避免 computed 每次求值 O(n) 构建+比较的开销，与 use-quick-filter 的增量清理策略对齐
  const rowIndexMap = shallowRef<Map<string, number>>(new Map())
  watch(() => props.data, (rows) => {
    // 行索引域 = 渲染器实际渲染的数据（props.data，页内可见数据），与虚拟渲染器的 params.rowIndex 域一致
    const map = new Map<string, number>()
    for (let i = 0; i < rows.length; i++) {
      map.set(props.rowKey(rows[i]), i)
    }
    rowIndexMap.value = map
  }, { immediate: true, flush: 'pre' })

  /**
   * <zh/> 统一列索引域顺序（selection + normal 非 fixed + normal fixed），与虚拟渲染器一致。
   * <en/> Unified column index domain order (selection + normal non-fixed + normal fixed), consistent with the virtual renderer.
   */
  const columnIndexColumns = computed<LocalColumn[]>(() => buildColumnIndexOrder(props.selectionColumns, props.normalColumns))

  // 改为 shallowRef + watch 按需重建——列配置引用不变则 Map 引用不变
  const columnIndexMap = shallowRef<Map<string, number>>(new Map())
  watch(columnIndexColumns, (cols) => {
    const map = new Map<string, number>()
    for (let i = 0; i < cols.length; i++) {
      map.set(getColumnKey(cols[i]), i)
    }
    columnIndexMap.value = map
  }, { immediate: true, flush: 'pre' })

  const rendererExpose = createRendererExpose({
    getRootEl: () => (tableRef.value?.$el as HTMLElement | undefined) ?? null,
    // <zh/> 拖拽容器选择器经 DOM 适配器解析（`thead/tr/tbody` 为标准 HTML，非 EP 实现细节）。
    // <zh/> 缺 dom 时返回 null（调用方 resolveDragContainer 经 tableId 回退，正确性不变）。
    // <en/> Drag container selectors resolved via the DOM adapter.
    getColumnDragContainer: () => {
      const headerRowSelector = toValue(props.dom)?.getHeaderRowSelector()
      if (!headerRowSelector)
        return null
      return getRootEl()?.querySelector(headerRowSelector) as HTMLElement | null
    },
    getRowDragContainer: () => {
      const bodySelector = toValue(props.dom)?.getBodySelector()
      if (!bodySelector)
        return null
      return getRootEl()?.querySelector(`${bodySelector} tbody`) as HTMLElement | null
    },
    // <zh/> 拖拽手柄默认原生标签（`th` / `td`，标准 HTML，非 EP 实现细节，
    // <zh/> 与 `columnDraggableSelector: 'th'` 同口径）。此前为 EP 内部 `.cell`：
    // <zh/> EP 改名即拖拽无法启动，且命中区域实际一致（`.cell` 充满单元格）。
    // <en/> Drag-handle defaults are native tags (`th` / `td`, standard HTML, not EP
    // <en/> internals, same caliber as `columnDraggableSelector: 'th'`). Previously the
    // <en/> EP-internal `.cell`: an EP rename would silently disable drag start while the
    // <en/> hit area is identical in practice (`.cell` fills the cell).
    defaultColumnDragHandle: 'th',
    defaultRowDragHandle: 'td',
    columnDraggableSelector: 'th',
  })

  function getRootEl(): HTMLElement | null {
    return (tableRef.value?.$el as HTMLElement | undefined) ?? null
  }

  // <zh/> 引用稳定——浅相等时复用上一次引用，避免 ElTable v-bind 全量 patch
  // <en/> reference stability — reuses the previous reference on shallow-equal
  // <en/> results, avoiding full ElTable v-bind patches.
  const tableProps = computed<Record<string, unknown>>((prev) => {
    const next = filterTableProps(props, getElTablePropKeys(), EXPLICITLY_BOUND)
    if (prev && shallowEqual(prev as Record<string, unknown>, next))
      return prev
    return next
  })

  return {
    currentRow,
    bodyWidth,
    hoverLayerStyle,
    rendererExpose,
    hoverOptionColumns: computed(() => props.hoverOptionColumns ?? []),
    hasHoverOptionColumns: computed(() => props.hasHoverOptionColumns ?? false),
    hoverOptionTeleport: computed(() => props.hoverOptionTeleport ?? false),
    displayNormalColumns: computed(() => props.displayNormalColumns ?? []),
    selectionColumnSyncKey: computed(() => props.selectionColumnSyncKey ?? ''),
    tableProps,
    hoverRowKey,
    hoverRowData,
    hoverRowIndex,
    hoverLayerVisible,
    hoverLayerCollapsed,
    toggleHoverLayerCollapse,
    handleHoverLayerEnter,
    handleHoverLayerLeave,
    rediscoverHoverAfterScroll,
    hoverTableEvents,
    handleScroll,
    isScrolling,
    rowIndexMap,
    columnIndexMap,
    columnIndexColumns,
  }
}
