/**
 * <zh/> 虚拟滚动失步检测 — 检测 ElTableV2 内部网格状态与 DOM 滚动位置不一致的失步情况。
 *
 * <zh/> 背景：ElTableV2 的虚拟网格用内部状态 states.scrollTop 决定渲染窗口，DOM 滚动位置
 * 保存在滚动容器（虚拟列表的 window，即 .el-table-v2__body 内首个可滚动子元素）上。
 * 当弹层（el-drawer / el-dialog 等）触发容器尺寸变化、可见性变化或数据更新时，可能发生
 * DOM 写入被跳过/钳制而内部状态未同步的场景，表现为「滚动条位置未变，但顶部出现空白带，
 * 渲染行整体下移」（如原可见 10-25，错误渲染 13-25）。
 * 此时任意一次真实滚动事件都会让网格从 DOM 重新读取位置而自愈。
 *
 * <zh/> 注意：.el-table-v2__body 仅是虚拟列表的 wrapper（overflow 可见），并非滚动容器；
 * 真正可滚动的 window 是其内部首个 scrollHeight > clientHeight 的 div（无类名）。
 *
 * <zh/> 检测方式：在可失步事件后对比「首个/末个渲染行的绝对偏移」与「DOM 滚动位置」，
 * 若偏移差超过一行行高（大于虚拟窗口的 cache 回绕余量），判定发生失步，
 * 调用方应以 DOM scrollTop 回写网格状态（scrollToTop），零视觉跳变地完成自愈。
 *
 * <en/> Virtual scroll desync detection — detects when ElTableV2's internal grid state
 * diverges from the DOM scroll position.
 *
 * <en/> Background: ElTableV2's virtual grid derives the render window from an internal
 * states.scrollTop, while the real scroll position lives on the virtual list's window
 * (the first scrollable child inside .el-table-v2__body). When overlays (el-drawer /
 * el-dialog etc.) trigger container size changes, visibility changes or data updates,
 * the DOM write can be skipped/clamped without the internal state catching up — visible
 * as "scrollbar unchanged but a blank band at top, rendered rows shifted down"
 * (e.g. previously 10-25, wrongly rendered 13-25). Any real scroll event re-syncs the
 * grid from the DOM and self-heals.
 *
 * <en/> Note: .el-table-v2__body is only the virtual list wrapper (overflow visible),
 * NOT the scroll container; the scrollable window is its first child div with
 * scrollHeight > clientHeight (it carries no class name).
 *
 * <en/> Detection: after desync-prone events, compare the first/last rendered row's absolute
 * offset against the DOM scroll position. If the offset gap exceeds one row height (beyond
 * the virtual window's cache margin), a desync is confirmed and the caller rewrites the grid
 * state with the DOM scrollTop (scrollToTop), healing with zero visual jump.
 */

/** <zh/> 失步方向——top：渲染窗口下移（顶部空白）；bottom：渲染窗口上移（底部空白） | <en/> Desync direction — 'top': render window shifted down (blank at top); 'bottom': render window shifted up (blank at bottom) */
export type VirtualScrollDesync = 'top' | 'bottom' | null

export interface VirtualScrollSnapshot {
  /** <zh/> DOM 滚动容器当前滚动位置（px） | <en/> Current DOM scroll position of the scroll container (px) */
  domScrollTop: number
  /** <zh/> 滚动容器可视高度（px） | <en/> Visible height of the scroll container (px) */
  clientHeight: number
  /** <zh/> 首个渲染行的绝对偏移（style.top，px） | <en/> Absolute offset of the first rendered row (style.top, px) */
  firstRowTop: number
  /** <zh/> 最后一个渲染行的绝对偏移（style.top，px） | <en/> Absolute offset of the last rendered row (style.top, px) */
  lastRowTop: number
  /** <zh/> 最后一个渲染行的高度（px） | <en/> Height of the last rendered row (px) */
  lastRowHeight: number
}

/** <zh/> 非有限值守卫 | <en/> Non-finite value guard */
function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value)
}

const scrollWindowCache = new WeakMap<HTMLElement, HTMLElement>()

/**
 * <zh/> 在 ElTableV2 表体 wrapper 内查找真正的滚动容器（虚拟列表 window）。
 *
 * <zh/> .el-table-v2__body 是虚拟列表的 wrapper（overflow 可见），不可滚动；真正的滚动容器
 * 是其内部首个 scrollHeight > clientHeight 的 div（无类名）。按「可滚动性」而非结构性选择器
 * 查找，对 EP 内部结构变动更稳健；无滚动内容时返回 null。
 *
 * <en/> Find the actual scroll container (virtual list window) inside an ElTableV2 body wrapper.
 *
 * <en/> .el-table-v2__body is only the virtual list wrapper (overflow visible) and is not
 * scrollable; the real scroll container is its first child div with scrollHeight > clientHeight
 * (it carries no class name). Finding it by scrollability rather than structural selectors is
 * more robust to EP internals; returns null when there is nothing to scroll.
 *
 * @param bodyWrapper - <zh/> .el-table-v2__body 包装元素 | <en/> the .el-table-v2__body wrapper element
 * @returns <zh/> 滚动容器或 null | <en/> the scroll container, or null
 */
export function findVirtualScrollWindow(bodyWrapper: HTMLElement): HTMLElement | null {
  // <zh/> 命中缓存：滚动容器在 EP 虚拟列表结构中位置稳定，看门狗（use-scroll-reconcile）高频调用，
  // <zh/> 用 WeakMap 缓存避免每次重复 DOM 遍历。缓存仅记录「命中」结果，未见命中（null）不缓存，
  // <zh/> 以便数据加载后新出现的可滚动节点能被后续调用发现。
  // <en/> Cache hit: the scroll container's position in EP's virtual list structure is stable and the
  // <en/> watchdog (use-scroll-reconcile) calls this frequently, so a WeakMap avoids repeated DOM walks.
  // <en/> Only positive hits are cached — a null (no match) is never cached, so a scrollable node that
  // <en/> appears after data loads is still discoverable by a later call.
  const cached = scrollWindowCache.get(bodyWrapper)
  if (cached) {
    // <zh/> 失效校验：节点已脱离 DOM（如 EP 重建网格）或不再可滚动时，删除缓存并重新查找
    // <en/> Invalidation check: if the node left the DOM (e.g. EP rebuilt the grid) or is no longer scrollable, drop the cache and re-walk
    if (bodyWrapper.contains(cached) && cached.scrollHeight > cached.clientHeight)
      return cached
    scrollWindowCache.delete(bodyWrapper)
  }

  // <zh/> 优化查找策略：优先检查直接子元素（EP 虚拟列表结构中滚动容器通常在浅层），
  // <zh/> 仅在直接子元素未命中时才 fallback 到 querySelectorAll 全量遍历。
  // <en/> Optimized search strategy: check direct children first (EP virtual list scroll container is typically shallow),
  // <en/> only fall back to querySelectorAll full traversal when direct children don't match.
  for (const child of bodyWrapper.children) {
    if (child.tagName === 'DIV') {
      const el = child as HTMLElement
      if (el.scrollHeight > el.clientHeight) {
        scrollWindowCache.set(bodyWrapper, el)
        return el
      }
      // <zh/> 检查一级子 div 内部（EP 结构为 .el-table-v2__body > wrapper > scroll-div） | <en/> Check one level inside child div (EP structure: .el-table-v2__body > wrapper > scroll-div)
      for (const grandchild of el.children) {
        if (grandchild.tagName === 'DIV') {
          const gc = grandchild as HTMLElement
          if (gc.scrollHeight > gc.clientHeight) {
            scrollWindowCache.set(bodyWrapper, gc)
            return gc
          }
        }
      }
    }
  }
  // <zh/> Fallback：直接子元素未命中时全量遍历 | <en/> Fallback: full traversal when direct children don't match
  for (const el of bodyWrapper.querySelectorAll<HTMLElement>('div')) {
    if (el.scrollHeight > el.clientHeight) {
      scrollWindowCache.set(bodyWrapper, el)
      return el
    }
  }
  return null
}

/**
 * <zh/> 检测虚拟网格渲染窗口与 DOM 滚动位置是否失步
 *
 * <zh/> 判定原则：虚拟网格始终在可视窗口上下各渲染 cache 行（默认 2 行，即 2 倍行高），
 * 因此正常状态下首个渲染行的偏移恒 ≤ domScrollTop，末个渲染行的底边恒 ≥ domScrollTop + clientHeight。
 * 一旦差值超过一行行高，说明渲染窗口基于的滚动状态与 DOM 不一致。
 *
 * <en/> Detect whether the virtual grid render window is out of sync with the DOM scroll position.
 *
 * <en/> Rule: the virtual grid always renders cache rows above and below the visible window
 * (default 2 rows, i.e. 2× row height), so in a healthy state the first rendered row's offset
 * is always ≤ domScrollTop and the last rendered row's bottom edge is always ≥ domScrollTop + clientHeight.
 * A gap larger than one row height means the render window is derived from a stale scroll state.
 *
 * @param snapshot - <zh/> 渲染窗口快照 | <en/> render window snapshot
 * @param rowHeight - <zh/> 行高（px），兼作容差 | <en/> row height (px), used as tolerance
 * @returns <zh/> 'top' | 'bottom' | null | <en/> 'top' | 'bottom' | null
 */
export function detectVirtualScrollDesync(
  snapshot: VirtualScrollSnapshot,
  rowHeight: number,
): VirtualScrollDesync {
  const {
    domScrollTop,
    clientHeight,
    firstRowTop,
    lastRowTop,
    lastRowHeight,
  } = snapshot

  if (!isFiniteNumber(rowHeight) || rowHeight <= 0)
    return null
  if (![domScrollTop, clientHeight, firstRowTop, lastRowTop, lastRowHeight].every(isFiniteNumber))
    return null
  if (clientHeight <= 0)
    return null

  // <zh/> 顶部空白：首个渲染行整体落在可视区顶部以下超过一行（超出 cache 回绕余量）。
  // <zh/> 使用 >=：3 行失步时差值为恰好一行行高（如 10→13 的典型场景）。
  // <en/> Blank at top: the first rendered row sits at least one row below the viewport top (beyond the cache margin).
  // <en/> Uses >=: a 3-row desync yields exactly one row height (the typical 10→13 case).
  if (firstRowTop - domScrollTop >= rowHeight)
    return 'top'

  // <zh/> 底部空白：末个渲染行底边距视口底部超过一行（正常状态末行底边必然盖过视口底部）
  // <en/> Blank at bottom: the last rendered row's bottom edge leaves at least one row below the viewport bottom (a healthy state always covers the viewport bottom)
  const lastRowBottom = lastRowTop + lastRowHeight
  if (domScrollTop + clientHeight - lastRowBottom >= rowHeight)
    return 'bottom'

  return null
}
