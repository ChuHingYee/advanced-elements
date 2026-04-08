import type { MaybeRefOrGetter } from 'vue'
import type { IRendererDomAdapter } from './dom-adapter'
import { toValue } from 'vue'
import { isBrowser } from '../../utils/env'
import {
  epScrollbarVerticalBar,
  epScrollbarWrap,
  epTableBodyWrapper,
  epTableHeaderCell,
  epTableHeaderWrapper,
  epTableRow,
} from '../../utils/ep-selectors'
import { readRowKeyAttr } from '../../utils/row-key-attr'
import { createElTableCellLocator } from './cell-locator'

/**
 * <zh/> ElTable（default 模式）DOM 适配器实现。
 *
 * <zh/> 本文件与 `virtual-dom-adapter.ts` 是**唯一**持有 ElTable DOM 结构与类名模板的模块；
 * <zh/> 其余消费点（hook / 工具函数 / 渲染器）只调用 {@link IRendererDomAdapter} 方法。
 *
 * <en/> DOM adapter implementation for ElTable (default mode).
 *
 * <en/> This file and `virtual-dom-adapter.ts` are the ONLY modules holding ElTable DOM structure
 * <en/> and class-name templates; every other consumer (hooks / utilities / renderers) calls
 * <en/> {@link IRendererDomAdapter} methods only.
 *
 * @param namespace - <zh/> EP 命名空间（默认 `el`，可由 `uiConfig.namespace` 覆盖） | <en/> EP namespace (defaults to `el`, overridable via `uiConfig.namespace`)
 */
export function createDefaultDomAdapter(namespace: MaybeRefOrGetter<string | undefined>): IRendererDomAdapter {
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
    // <zh/> SSR 守卫：非浏览器环境（预渲染/单测直调）无 document，直接回退 null（调用方均按 null 处理）
    // <en/> SSR guard: no document outside browsers (prerender / direct unit-test calls); fall back to null (all callers handle null)
    isBrowser ? document.getElementById(tableId) : null
  /** <zh/> 行容器（根元素内的 tbody） | <en/> Row container (the tbody inside the root) */
  const rowContainerEl = (tableId: string): HTMLElement | null =>
    tableRoot(tableId)?.querySelector<HTMLElement>(`${epTableBodyWrapper(ns())} tbody`) ?? null
  /** <zh/> body 包装元素（根元素内） | <en/> Body wrapper (inside the root) */
  const bodyWrapperEl = (tableId: string): HTMLElement | null =>
    tableRoot(tableId)?.querySelector<HTMLElement>(epTableBodyWrapper(ns())) ?? null
  /**
   * <zh/> 行拖拽手柄选择器——原生 `td`（与本文件 `getCellSelector: 'td'`、
   * <zh/> `getHeaderRowSelector` 的 `thead tr` 同口径：标准 HTML，非 EP 实现细节）。
   * <zh/> 此前为 EP 内部 `.cell`（单元格内边距容器）：EP 改名即拖拽无法启动，
   * <zh/> 且命中区域与 `td` 实际一致（`.cell` 充满 `td`），故替换为零行为差异。
   * <en/> Row drag handle selector — native `td` (same caliber as this file's
   * <en/> `getCellSelector: 'td'` and `thead tr` in `getHeaderRowSelector`: standard
   * <en/> HTML, not EP internals). Previously EP-internal `.cell` (the padding container
   * <en/> inside cells): an EP rename would silently disable drag start, while the hit
   * <en/> area is identical in practice (`.cell` fills `td`), so the swap is behavior-preserving.
   */
  const dragHandleSelector = 'td'
  /** <zh/> 行拖拽 ghost 类名 | <en/> Row drag ghost class */
  const dragGhostClass = 'adv-table__row--ghost'

  return {
    /**
     * <zh/> ElTable 的反查落在单一表格容器内，无固定条带/汇总副本，无需收窄
     * <en/> ElTable reverse lookup lives inside a single table container with no pinned/summary
     * <en/> duplicates, so no narrowing is needed
     */
    getScopeSelector: () => undefined,

    /**
     * <zh/> 与 `getRowSelector` 一致按命名空间构造
     * <zh/> 自定义命名空间（`uiConfig.namespace`）下该选择器不命中，hover clamp 静默退化为根元素 rect
     * <zh/> （悬浮条可能覆盖表头）。改为命名空间化后默认命名空间下行为完全不变，自定义命名空间被修正。
     * <en/> Built from the namespace like `getRowSelector` — the previous implementation used the static
     * <en/> `.el-table__body-wrapper` constant, which never matched under a custom `uiConfig.namespace`, so
     * <en/> hover clamping silently degraded to the root rect (the hover bar could cover the header).
     * <en/> Namespace-aware, the default namespace behaves identically while custom namespaces are fixed.
     */
    getBodySelector: () => epTableBodyWrapper(ns()),
    getRowSelector: () => epTableRow(ns()),
    /** <zh/> 行反查经命名空间化选择器，自定义命名空间同样命中 | <en/> Namespace-aware row reverse lookup */
    closestRow: el => el.closest<HTMLElement>(epTableRow(ns())),
    /** <zh/> ElTable 表头包装容器（命名空间化） | <en/> Namespace-aware ElTable header wrapper */
    getHeaderSelector: () => epTableHeaderWrapper(ns()),
    /** <zh/> ElTable 表头单元格为原生 th 上的命名空间化类名 | <en/> Namespace-aware ElTable header cell class on native th */
    getHeaderCellSelector: () => epTableHeaderCell(ns()),
    /**
     * <zh/> ElTable 列拖拽容器即表头行（`thead tr` 为标准 HTML，非 EP 实现细节） | <en/> ElTable column-drag container is the header row (`thead tr` is standard HTML)
     */
    getHeaderRowSelector: () => `${epTableHeaderWrapper(ns())} thead tr`,

    /**
     * <zh/> ElTable 不使用虚拟列表与自定义滚动条以外的滚动机制：
     * <zh/> 虚拟列表滚动条不存在（`virtualBar: undefined`），内容由 ElScrollbar 包装。
     * <zh/> 两个 ElScrollbar 选择器均经命名空间构造器——自定义 `uiConfig.namespace` 下同样命中
     * <zh/> （静态 `.el-scrollbar__*` 字面量会静默失配：`table-renderer` 的滚动回退到
     * <zh/> `overflow: hidden` 的 body 包装层，滚动与悬浮层夹取会无声失效）。
     * <en/> ElTable uses no virtual list: the virtual-list bar never exists (`virtualBar: undefined`),
     * <en/> and content is wrapped by ElScrollbar. Both ElScrollbar selectors come from the namespace
     * <en/> builders so a custom `uiConfig.namespace` also matches (static `.el-scrollbar__*` literals
     * <en/> would silently miss: `table-renderer`'s scroll falls back to the `overflow: hidden` body
     * <en/> wrapper, quietly breaking scrolling and hover clamping).
     */
    getBodyScrollbarSpec: () => ({
      virtualBar: undefined,
      scrollWrap: epScrollbarWrap(ns()),
      customBar: epScrollbarVerticalBar(ns()),
    }),

    createCellLocator: () => createElTableCellLocator(),

    createDragLocator(tableId: string) {
      // 单次扫描生成 { element, key }：DOM 索引先映射到本数组再取业务 key
      function getRowEntries(): Array<{ element: HTMLElement, key: string | null }> {
        const container = rowContainerEl(tableId)
        if (!container)
          return []
        const rows = container.querySelectorAll<HTMLElement>(epTableRow(ns()))
        const entries: Array<{ element: HTMLElement, key: string | null }> = []
        rows.forEach((row) => {
          // <zh/> 行 key 读取收口至 readRowKeyAttr：此前此模式在 4 文件 8 处独立书写
          // <zh/> 且属性名字面量硬编码，行 key 域变更时漏改即表现为拖拽错位/定位跳行。
          // <en/> Row-key reads go through readRowKeyAttr: the pattern was
          // <en/> hand-written in 8 places across 4 files with the attribute literal inlined, so a
          // <en/> missed site on a row-key domain change shows up as drag misalignment / row jumps.
          entries.push({ element: row, key: readRowKeyAttr(row) })
        })
        return entries
      }
      return {
        getRowContainer: () => rowContainerEl(tableId),
        getCurrentRowKeys: () => {
          const keys: string[] = []
          for (const entry of getRowEntries()) {
            if (entry.key)
              keys.push(entry.key)
          }
          return keys
        },
        getCurrentRowEntries: getRowEntries,
        getDragHandleSelector: () => dragHandleSelector,
        getDraggableRowSelector: () => epTableRow(ns()),
        getVisibleRowElements: scrollContainer => Array.from(scrollContainer.querySelectorAll<HTMLElement>(epTableRow(ns()))),
        /**
         * <zh/> ElTable 渲染的是原生 `<table>`，行内单元格即 HTML `<td>`——与命名空间无关。
         * <en/> ElTable renders a native `<table>`, so row cells are HTML `<td>` — namespace-independent.
         */
        getCellSelector: () => 'td',
        getAnimation: () => 150,
        getGhostClass: () => dragGhostClass,
        getInsertIndicatorContainer: () => bodyWrapperEl(tableId),
      }
    },
  }
}
