/**
 * <zh/> virtual 渲染器的悬停操作层域
 * <en/> Virtual-renderer hover-action-layer domain
 *
 * @remarks
 * <zh/> 职责单一：teleport 形态的 RowActionBar 定位与本渲染器向子组件 provide 的 hover 层 API。
 * <zh/> 两处耦合原先散落在 SFC 中，且存在**隐式顺序约束**——`useTeleportRowRect` 产出的
 * <zh/> `shouldUseTeleport` 又是 `hoverLayerApi` 的输入，故二者必须同处一域、由本模块保证顺序。
 * <zh/> 虚拟滚动会回收行 DOM：`locateHoveredRow` 返回 undefined 时须清空 hover 状态，
 * <zh/> 否则 RowActionBar 会残留指向已滚出视图的旧行。
 * <en/> Single responsibility: positioning of the teleported RowActionBar and the hover-layer API this
 * <en/> renderer provides to its children. The two used to be scattered across the SFC and carry an
 * <en/> **implicit ordering constraint** — `shouldUseTeleport` (produced by `useTeleportRowRect`) is an
 * <en/> input of `hoverLayerApi`, so both must live in one domain whose order this module guarantees.
 * <en/> Virtual scrolling recycles row DOM: when `locateHoveredRow` returns undefined the hover state
 * <en/> must be cleared, or the RowActionBar lingers on a stale row that scrolled out of view.
 */
import type { ComputedRef, CSSProperties, Ref, ShallowRef } from 'vue'
import type { ProcessedColumn as LocalColumn } from '../../types'
import type { TableHoverLayerApi } from '../../types/config-api'
import type { UseV2ScrollApiReturn } from './use-v2-scroll-api'
import { createHoverLocator } from '../../composables/rendering/use-hover-locator'
import { useTeleportRowRect } from '../../composables/rendering/use-renderer-common'
import { useHoverLayerProvider } from '../../composables/rendering/use-renderer-event-adapter'

/** <zh/> 悬停层域依赖 | <en/> Hover-layer domain deps */
export interface UseV2HoverDeps<T = any> {
  /** <zh/> ElTableV2 实例（悬停行定位宿主） | <en/> ElTableV2 instance (hovered-row locate host) */
  tableV2Ref: ShallowRef<any>
  /** <zh/> EP DOM 适配器 | <en/> EP DOM adapter */
  dom: any
  /** <zh/> 是否存在 hover 操作列 | <en/> whether hover option columns exist */
  hasHoverOptionColumns: ComputedRef<boolean>
  /** <zh/> hover 操作列 | <en/> hover option columns */
  hoverOptionColumns: ComputedRef<LocalColumn[]>
  /** <zh/> hover 操作是否走 teleport | <en/> whether hover options use teleport */
  hoverOptionTeleport: ComputedRef<boolean | undefined>
  /** <zh/> 当前悬停行键 | <en/> current hovered row key */
  hoverRowKey: Ref<string | null>
  /** <zh/> 当前悬停行数据 | <en/> current hovered row data */
  hoverRowData: Ref<T | null>
  /** <zh/> 当前悬停行索引 | <en/> current hovered row index */
  hoverRowIndex: Ref<number>
  /** <zh/> 悬停层是否可见 | <en/> whether the hover layer is visible */
  hoverLayerVisible: Ref<boolean>
  /** <zh/> 悬停层是否折叠 | <en/> whether the hover layer is collapsed */
  hoverLayerCollapsed: Ref<boolean>
  /** <zh/> 悬停层定位样式 | <en/> hover layer positioning style */
  hoverLayerStyle: ComputedRef<CSSProperties>
  /** <zh/> 折叠切换 | <en/> collapse toggle */
  toggleHoverLayerCollapse: (e: Event) => void
  /** <zh/> 悬停层进入处理 | <en/> hover-layer enter handler */
  handleHoverLayerEnter: () => void
  /** <zh/> 悬停层离开处理 | <en/> hover-layer leave handler */
  handleHoverLayerLeave: () => void
  /**
   * <zh/> teleport 操作条 zIndex——由渲染器按列配置派生；渲染器模板不得读取，
   * <zh/> 仅随 teleportOverlay 交给 HoverTeleportOverlay 消费。
   * <en/> z-index of the teleported bar, derived from column config by the renderer. The renderer
   * <en/> template must not read it; it reaches HoverTeleportOverlay only via `teleportOverlay`.
   */
  hoverOptionZIndex: ComputedRef<number | string | undefined>
  /** <zh/> 滚动处理（由本域包装为 wrappedHandleScroll） | <en/> scroll handler (wrapped by this domain) */
  handleScroll: (params: { scrollLeft: number, scrollTop?: number }) => void
  /** <zh/> 是否处于滚动中 | <en/> whether scrolling */
  isScrolling: Ref<boolean>
  /** <zh/> 滚动停止后重新发现悬停行 | <en/> re-discover the hovered row after scrolling stops */
  rediscoverHoverAfterScroll: () => void
  /** <zh/> 当前横向滚动位置（悬停层程序化滚动起点） | <en/> current horizontal scroll position (hover-layer scroll origin) */
  currentScrollLeft: Ref<number>
  /** <zh/> 当前纵向滚动位置（悬停层程序化滚动起点） | <en/> current vertical scroll position (hover-layer scroll origin) */
  currentScrollTop: Ref<number>
  /**
   * <zh/> 表格根元素 getter——供 teleport 矩形域判定捕获到的 scroll 来自表内还是祖先滚动体；
   * <zh/> 缺省时仅页面级滚动触发重定位。
   * <en/> Table root element getter — lets the teleport-rect domain tell whether a captured scroll
   * <en/> comes from inside the table or an ancestor scroller; without it only page-level scrolls relocate.
   */
  getRootEl?: () => HTMLElement | null | undefined
  /** <zh/> V2 程序化滚动探针 | <en/> V2 programmatic-scroll probe */
  v2ScrollApi: UseV2ScrollApiReturn
}

/** <zh/> 悬停层域返回 | <en/> Hover-layer domain return */
export interface UseV2HoverReturn {
  /** <zh/> teleport 悬停行的矩形 | <en/> rect of the teleported hovered row */
  teleportRowRect: ReturnType<typeof useTeleportRowRect>['teleportRowRect']
  /** <zh/> 是否渲染 teleport 悬停层 | <en/> whether the teleported hover layer renders */
  showTeleportHover: ReturnType<typeof useTeleportRowRect>['showTeleportHover']
  /** <zh/> 是否应使用 teleport | <en/> whether teleport should be used */
  shouldUseTeleport: ReturnType<typeof useTeleportRowRect>['shouldUseTeleport']
  /** <zh/> 包装后的滚动处理（维护滚动态与 teleport 重定位） | <en/> wrapped scroll handler (maintains scroll state and teleport repositioning) */
  wrappedHandleScroll: ReturnType<typeof useTeleportRowRect>['wrappedHandleScroll']
  /** <zh/> 强制隐藏悬停层 | <en/> force-hide the hover layer */
  handleForceHide: ReturnType<typeof useTeleportRowRect>['handleForceHide']
  /** <zh/> 向子组件 provide 的 hover 层 API（列工厂亦需显式接收） | <en/> hover layer API provided to children (column factories also take it explicitly) */
  hoverLayerApi: TableHoverLayerApi
}

/**
 * <zh/> 创建悬停操作层域
 * <en/> Create the hover-action-layer domain
 */
export function useV2Hover<T = any>(deps: UseV2HoverDeps<T>): UseV2HoverReturn {
  const {
    tableV2Ref,
    dom,
    hasHoverOptionColumns,
    hoverOptionColumns,
    hoverOptionTeleport,
    hoverRowKey,
    hoverRowData,
    hoverRowIndex,
    hoverLayerVisible,
    hoverLayerCollapsed,
    hoverLayerStyle,
    toggleHoverLayerCollapse,
    handleHoverLayerEnter,
    handleHoverLayerLeave,
    hoverOptionZIndex,
    handleScroll,
    isScrolling,
    rediscoverHoverAfterScroll,
    currentScrollLeft,
    currentScrollTop,
    v2ScrollApi,
    getRootEl,
  } = deps

  const {
    teleportRowRect,
    showTeleportHover,
    shouldUseTeleport,
    wrappedHandleScroll,
    handleForceHide,
  } = useTeleportRowRect({
    hoverOptionTeleport,
    hasHoverOptionColumns,
    hoverRowKey,
    hoverLayerVisible,
    handleScroll,
    isScrolling,
    rediscoverHover: rediscoverHoverAfterScroll,
    getRootEl,
    locateHoveredRow: (() => {
      const locate = createHoverLocator({
        getContainer: () => (tableV2Ref.value?.$el ?? tableV2Ref.value) as HTMLElement | null,
        // <zh/> 行/body 选择器与滚动条规格均由 DOM 适配器供给（渲染器不持有 EP 类名）
        // <en/> Row/body selectors and the scrollbar spec all come from the DOM adapter
        dom,
        hoverRowKey,
      })
      return () => {
        const rect = locate()
        if (rect)
          return rect
        // <zh/> 回退 cell rect 已在 createHoverLocator 内 | <en/> Fallback cell rect already in createHoverLocator
        /**
         * <zh/> 悬停行被虚拟滚动回收后 querySelector 返回 null。
         * <zh/> 状态清空逻辑已移至 onRowNotFound 回调，由 composable 统一调用。
         * <en/> After virtual scroll recycles the hovered row, querySelector returns null.
         * <en/> State clearing logic has been moved to the onRowNotFound callback, invoked by the composable.
         * @remarks
         * <zh/> 行滚回视图后由 mousemove 自然触发 hover 更新
         * <en/> When the row scrolls back, mousemove naturally triggers hover update
         */
        return undefined
      }
    })(),
    onRowNotFound: () => {
      hoverRowKey.value = null
      hoverRowData.value = null
      hoverRowIndex.value = -1
      hoverLayerVisible.value = false
    },
  })

  /**
   * <zh/> hover 层 API——同对象同时用于 provide（子组件注入）与列构建（自身 setup 直接使用）。
   * <zh/> 注意：渲染器自身 setup 无法注入自己 provide 的 key，必须显式传给 useNormalV2Columns。
   * <en/> Hover layer API — the same object is provided to children AND passed explicitly to
   * <en/> useNormalV2Columns, since a renderer cannot inject its own provide.
   */
  const hoverLayerApi: TableHoverLayerApi = {
    hoverRowKey,
    hoverLayerVisible,
    hoverLayerCollapsed,
    hoverLayerStyle,
    hoverOptionColumns,
    hoverOptionTeleport,
    shouldUseTeleport,
    onToggleCollapse: toggleHoverLayerCollapse,
    /**
     * <zh/> teleport 操作条渲染域——ref 只交给 HoverTeleportOverlay 消费，渲染器模板不得读取，
     * <zh/> 否则每次跨行/滚动帧都会重渲染整个虚拟表格。
     * <en/> Teleport bar render domain — refs are consumed only by HoverTeleportOverlay and must not be
     * <en/> read by the renderer template, or every row crossing/scroll frame re-renders the whole grid.
     */
    teleportOverlay: {
      hoverRowData,
      hoverRowIndex,
      rowRect: teleportRowRect,
      isScrolling,
      zIndex: hoverOptionZIndex,
      onEnter: handleHoverLayerEnter,
      onLeave: handleHoverLayerLeave,
      onForceHide: handleForceHide,
    },
    scrollBody: (dx, dy) => {
      const nextLeft = currentScrollLeft.value + dx
      const nextTop = currentScrollTop.value + dy
      return v2ScrollApi.scrollTo({ scrollLeft: nextLeft, scrollTop: nextTop })
    },
  }

  useHoverLayerProvider({ api: hoverLayerApi })

  return {
    teleportRowRect,
    showTeleportHover,
    shouldUseTeleport,
    wrappedHandleScroll,
    handleForceHide,
    hoverLayerApi,
  }
}
