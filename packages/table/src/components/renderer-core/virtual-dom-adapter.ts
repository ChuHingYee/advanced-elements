import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type { IRendererDomAdapter } from './dom-adapter'
import { toValue } from 'vue'
import { DEFAULT_ROW_HEIGHT } from '../../constants'
import { isBrowser } from '../../utils/env'
import {
  epTableV2Body,
  epTableV2Header,
  epTableV2HeaderCell,
  epTableV2HeaderRow,
  epTableV2Main,
  epTableV2Row,
  epTableV2RowCell,
  epVlVertical,
} from '../../utils/ep-selectors'
import { readRowKeyAttr } from '../../utils/row-key-attr'
import { createTableV2CellLocator } from './cell-locator'
/**
 * <zh/> ElTableV2（virtual 模式）DOM 适配器实现。
 *
 * <zh/> 与 `default-dom-adapter.ts` 一样是 EP 内部结构的唯一出口；差异集中在三处：
 * <zh/> 1. 反查需收窄到 `.el-table-v2__main`（固定条带/汇总区会复制行属性）；
 * <zh/> 2. 存在虚拟列表滚动条（覆盖层），hover clamp 必须优先减除；
 * <zh/> 3. 行容器是 Grid 的多层包装，需按结构路径定位。
 *
 * <en/> DOM adapter implementation for ElTableV2 (virtual mode).
 *
 * <en/> Like `default-dom-adapter.ts` it is the only outlet for EP internals; the differences are:
 * <en/> 1. reverse lookup must be narrowed to `.el-table-v2__main` (pinned strips/summary duplicate row attrs);
 * <en/> 2. a virtual-list scrollbar overlay exists and must be subtracted first in hover clamping;
 * <en/> 3. the row container is a multi-layer Grid wrapper, located by its structural path.
 *
 * @param namespace - <zh/> EP 命名空间（默认 `el`，可由 `uiConfig.namespace` 覆盖） | <en/> EP namespace (defaults to `el`, overridable via `uiConfig.namespace`)
 */
export function createVirtualDomAdapter(namespace: MaybeRefOrGetter<string | undefined>): IRendererDomAdapter {
  const ns = (): string => toValue(namespace) || 'el'
  /**
   * <zh/> 解析表格根元素——**刻意不让 id 进入 CSS 解析**。
   *
   * <zh/> `uiConfig.tableId` 是使用者输入：`#123`、`#order.list`、含空白的 id 都会令
   * <zh/> `querySelector('#…')` 抛 `SyntaxError`（DOM 规范：非法选择器），行拖拽与滚动定位
   * <zh/> 会直接中断；而 `getElementById` 接受任意字符串、不做选择器解析，从根本上无此风险
   * <zh/> （`utils/drag-container-resolver` 亦用此口径）。ES 转义不是可靠替代：转义产物属于
   * <zh/> 合法选择器，但依赖环境的 CSS 转义支持（测试环境 happy-dom 即不支持）。
   *
   * <en/> Resolve the table root — the id is **deliberately kept out of CSS parsing**.
   *
   * <en/> `uiConfig.tableId` is user input: `#123`, `#order.list` or an id containing whitespace
   * <en/> makes `querySelector('#…')` throw `SyntaxError` (an illegal selector per the DOM spec),
   * <en/> breaking row drag and scroll targeting outright; `getElementById` accepts any string and does
   * <en/> no selector parsing, removing the risk at the root (the caliber `utils/drag-container-resolver`
   * <en/> already uses). Escaping is not a reliable substitute: the escaped output is a legal selector but
   * <en/> depends on the environment's CSS-escape support (happy-dom, the test environment, has none).
   */
  const tableRoot = (tableId: string): HTMLElement | null =>
    // <zh/> SSR 守卫：非浏览器环境直接回退 null（调用方均按 null 处理），见 default 适配器同名注释
    // <en/> SSR guard: fall back to null outside browsers (all callers handle null); see the default adapter's note
    isBrowser ? document.getElementById(tableId) : null
  /** <zh/> 主网格容器（根元素内） | <en/> Main-grid container (inside the root) */
  const mainEl = (tableId: string): HTMLElement | null =>
    tableRoot(tableId)?.querySelector<HTMLElement>(epTableV2Main(ns())) ?? null
  /** <zh/> 表体容器（根元素内） | <en/> Body container (inside the root) */
  const bodyEl = (tableId: string): HTMLElement | null =>
    tableRoot(tableId)?.querySelector<HTMLElement>(epTableV2Body(ns())) ?? null
  /** <zh/> 行拖拽手柄选择器 | <en/> Row drag handle selector */
  const dragHandleSelector = '.adv-table__cell'
  // <zh/> 取共享常量而非本地写死：此前此处自建 `DEFAULT_ROW_HEIGHT = 48`，
  // <zh/> 与 `constants` 的同名常量并存；改默认行高漏改即出现「实测兜底高度与其余行不一致」。
  // <en/> Take the shared constant instead of a local literal: this used to declare
  // <en/> its own `DEFAULT_ROW_HEIGHT = 48` alongside the constant in `constants`; missing it on a
  // <en/> default-height change leaves the measured fallback height inconsistent with the other rows.
  const FALLBACK_ROW_HEIGHT = DEFAULT_ROW_HEIGHT

  return {
    /** <zh/> 主网格作用域同样命名空间化（原静态 `.el-` 常量在自定义命名空间下失配） | <en/> Namespace-aware scope selector */
    getScopeSelector: () => epTableV2Main(ns()),

    /** <zh/> 与行/主网格选择器一致按命名空间构造（见 default 适配器同名说明） | <en/> Built from the namespace like the row/main-grid selectors (see the default adapter's note) */
    getBodySelector: () => epTableV2Body(ns()),
    getRowSelector: () => epTableV2Row(ns()),
    /** <zh/> 行反查经命名空间化选择器，自定义命名空间同样命中 | <en/> Namespace-aware row reverse lookup */
    closestRow: el => el.closest<HTMLElement>(epTableV2Row(ns())),
    /** <zh/> ElTableV2 表头容器（命名空间化） | <en/> Namespace-aware ElTableV2 header container */
    getHeaderSelector: () => epTableV2Header(ns()),
    /** <zh/> ElTableV2 内置表头单元格（命名空间化） | <en/> Namespace-aware built-in ElTableV2 header cell */
    getHeaderCellSelector: () => epTableV2HeaderCell(ns()),
    /** <zh/> ElTableV2 列拖拽容器即表头行（命名空间化） | <en/> Namespace-aware ElTableV2 column-drag container (header row) */
    getHeaderRowSelector: () => epTableV2HeaderRow(ns()),

    /**
     * <zh/> 虚拟列表滚动条为绝对定位覆盖层（不占布局），因此 `scrollWrap` 返回空串
     * <zh/> （body 容器自身即滚动元素），且 `customBar` 为 `undefined`——v2 不使用 ElScrollbar。
     * <en/> The virtual-list bar is an absolutely-positioned overlay (no layout space), so `scrollWrap`
     * <en/> is an empty string (the body container scrolls itself) and `customBar` is `undefined`
     * <en/> v2 does not use ElScrollbar.
     */
    getBodyScrollbarSpec: () => ({
      virtualBar: epVlVertical(ns()),
      scrollWrap: '',
      customBar: undefined,
    }),

    createCellLocator: (keyToIndex?: ComputedRef<Map<string, number>>) => createTableV2CellLocator(keyToIndex),

    createDragLocator(tableId: string, rowHeight: MaybeRefOrGetter<number | undefined>) {
      function getV2RowEntries(): Array<{ element: HTMLElement, key: string | null }> {
        const container = mainEl(tableId)
        if (!container)
          return []
        const rows = container.querySelectorAll<HTMLElement>(epTableV2Row(ns()))
        const entries: Array<{ element: HTMLElement, key: string | null }> = []
        rows.forEach((row) => {
          // <zh/> 行 key 读取收口至 readRowKeyAttr
          // <en/> Row-key reads go through readRowKeyAttr
          entries.push({ element: row, key: readRowKeyAttr(row) })
        })
        return entries
      }
      /**
       * <zh/> 行内层（Inner）——首行父元素；Sortable 要求可拖拽行为容器的直接子节点。
       * <en/> Row inner layer — parent of the first row; Sortable requires draggables to be direct children.
       */
      function getRowInner(): HTMLElement | null {
        const body = bodyEl(tableId)
        if (!body)
          return null
        const firstRow = body.querySelector<HTMLElement>(epTableV2Row(ns()))
        if (firstRow?.parentElement)
          return firstRow.parentElement as HTMLElement
        const win = body.firstElementChild as HTMLElement | null
        const inner = win?.firstElementChild as HTMLElement | null
        return inner ?? win ?? null
      }
      /**
       * <zh/> 滚动窗口（Window）——Inner 的父元素，`onScroll` 挂载点与 `scrollTop` 持有者。
       * <en/> Scroll window — parent of the inner layer, the `onScroll` mount point and `scrollTop` owner.
       */
      function getScrollWindow(): HTMLElement | null {
        const body = bodyEl(tableId)
        if (!body)
          return mainEl(tableId)
        const firstRow = body.querySelector<HTMLElement>(epTableV2Row(ns()))
        const inner = firstRow?.parentElement as HTMLElement | null
        if (inner?.parentElement)
          return inner.parentElement as HTMLElement
        return (body.firstElementChild as HTMLElement | null) ?? body
      }
      return {
        /**
         * <zh/> 行容器即行内层（Inner），而非滚动窗口（Window）：
         * <zh/> Grid 结构为 `body（.el-vl__wrapper）> window（overflow:hidden，可滚动）> inner（总高度）> rows（absolute）`。
         * <zh/> 旧 `div div` 路径命中 window（仅 1 个子节点 inner），Sortable 视其直接子节点为可拖拽行，
         * <zh/> 导致窗口内 10 行全为孙节点、拖拽手柄可抓但无法拖动。现以首行父元素锚定 inner，
         * <zh/> 空数据时回退 `body > window > inner` 结构路径（inner 为空仍可绑定，后续行加入后即生效）。
         * <en/> The row container is the inner layer, not the scroll window:
         * <en/> the Grid nests as `body (.el-vl__wrapper) > window (overflow:hidden, scrollable) > inner (total height) > rows (absolute)`.
         * <en/> The old `div div` path hit the window (a single inner child), so Sortable saw no direct draggable
         * <en/> children and the handle grabbed but never dragged. Anchor the inner layer via the first row's
         * <en/> parent now, falling back to the `body > window > inner` path when empty (binding an empty inner
         * <en/> still takes effect once rows mount).
         */
        getRowContainer: () => getRowInner(),
        getCurrentRowKeys: () => {
          const keys: string[] = []
          for (const entry of getV2RowEntries()) {
            if (entry.key)
              keys.push(entry.key)
          }
          return keys
        },
        getCurrentRowEntries: getV2RowEntries,
        getDragHandleSelector: () => dragHandleSelector,
        getDraggableRowSelector: () => epTableV2Row(ns()),
        getVisibleRowElements: scrollContainer => Array.from(scrollContainer.querySelectorAll<HTMLElement>(epTableV2Row(ns()))),
        /**
         * <zh/> v2 行内单元格是命名空间化的 `__row-cell`。
         * <zh/> 改用命名空间化构造器后，`uiConfig.namespace` 自定义命名空间下也能命中
         * <zh/> （原 `utils/drag-ghost` 内的硬编码 `.el-table-v2__row-cell` 会静默失配，
         * <zh/> 导致 fallback 克隆行丢失单元格样式）。
         * <en/> v2 row cells are the namespace-aware `__row-cell`.
         * <en/> Building it from the namespace makes it match under a custom `uiConfig.namespace`
         * <en/> (the previously hard-coded `.el-table-v2__row-cell` in `utils/drag-ghost` silently
         * <en/> missed, so the fallback clone lost its cell styles).
         */
        getCellSelector: () => epTableV2RowCell(ns()),
        /**
         * <zh/> 无过渡——虚拟滚动体制的行位置由行高与索引决定，不能有 CSS 过渡，提交时机也因此不同
         * <en/> No transition — virtual-scroll row positions derive from row height and index, so a CSS
         * <en/> transition is impossible and the commit timing differs accordingly
         */
        getAnimation: () => 0,
        getGhostClass: () => undefined,
        /**
         * <zh/> 滚动容器即滚动窗口（Window），而非主网格（Main）：
         * <zh/> `onScroll` 挂在 window 上，`scrollTop` 也由其持有；旧 main 既不滚动（`scrollTop` 恒 0），
         * <zh/> 其矩形又含表头，`calcVirtualTargetKey` 的 `mouseY - rect.top + scrollTop` 会偏大约一个表头高度。
         * <zh/> 同理滚动监听挂 main 永不触发，可见行缓存无法随滚动刷新。
         * <en/> The scroll container is the scroll window, not the main grid:
         * <en/> `onScroll` rides on the window and so does `scrollTop`; the old main never scrolls
         * <en/> (`scrollTop` stuck at 0) and its rect includes the header, skewing
         * <en/> `calcVirtualTargetKey` by about a header height. A scroll listener on main never fires either,
         * <en/> so the visible-row cache went stale on scroll.
         */
        getScrollContainer: () => getScrollWindow(),
        // <zh/> namespace 字段已从 DragLocator 移除：行类名拼接收敛至 getVisibleRowElements/getDraggableRowSelector，定位器不再向外暴露命名空间
        // <en/> The namespace field is removed from DragLocator: row class-name concatenation converges in getVisibleRowElements/getDraggableRowSelector
        getRowHeight: () => {
          const rowHeightValue = toValue(rowHeight)
          if (rowHeightValue)
            return rowHeightValue
          const firstRow = tableRoot(tableId)?.querySelector<HTMLElement>(epTableV2Row(ns()))
          return firstRow?.offsetHeight || FALLBACK_ROW_HEIGHT
        },
        getInsertIndicatorContainer: () => mainEl(tableId),
      }
    },
  }
}
