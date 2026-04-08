/**
 * <zh/> Hover 定位统一 — 抽取 default/virtual 双渲染器的 locateHoveredRow 公共逻辑
 * <en/> Hover locator unified — extracts common locateHoveredRow logic from default/virtual renderers
 *
 * @remarks
 * <zh/> 原两渲染器 `locateHoveredRow` 各自实现 `querySelector([data-adv-table-row-key]) → getBoundingClientRect → clamp` 3 步，重复 70%
 * <zh/> 本 composable 提供 `createHoverLocator` 工厂，差异经 DOM 适配器注入，返回 `locate` 函数供 `useTeleportRowRect` 复用
 *
 * <zh/> **本 composable 不持有任何 EP 类名字符串**：行/body 选择器与滚动条规格均在调用时
 * <zh/> 从 {@link IRendererDomAdapter} 读取（保持命名空间运行时变更即时生效）。
 *
 * <en/> Two renderers' `locateHoveredRow` shared 3 steps: `querySelector([data-adv-table-row-key]) → getBoundingClientRect → clamp`, 70% duplicate
 * <en/> This composable provides `createHoverLocator` factory with differences injected via the DOM adapter
 *
 * <en/> **This composable holds no EP class-name string**: row/body selectors and the scrollbar spec are
 * <en/> read from {@link IRendererDomAdapter} at call time (so runtime namespace changes take effect).
 */
import type { Ref } from 'vue'
import type { IRendererDomAdapter } from '../../components/renderer-core/dom-adapter'
import type { HoveredRowRect, RowLocateSpec } from '../../utils/hover-locator'
import { ADV_TABLE_ROW_KEY_ATTR } from '../../constants'
import { clampRowToContainer, getBodyContainerRect, locateRowByKey } from '../../utils/hover-locator'
import { rowKeyAttrSelector } from '../../utils/row-key-attr'

export interface HoverLocatorOptions {
  /** <zh/> 行容器 getter（ElTable/ElTableV2 根）| <en/> Row container getter (ElTable/ElTableV2 root) */
  getContainer: () => HTMLElement | null | undefined
  /**
   * <zh/> DOM 适配器——行/body 选择器与滚动条规格的唯一来源；
   * <zh/> 渲染器经 `rendererProps.dom` 获取（见 `core/use-renderer-adapter.ts`）。
   * <en/> DOM adapter — the single source of the row/body selectors and the scrollbar spec; renderers
   * <en/> obtain it from `rendererProps.dom` (see `core/use-renderer-adapter.ts`).
   */
  dom: IRendererDomAdapter
  /** <zh/> 当前悬浮行键 | <en/> Current hover row key */
  hoverRowKey: Ref<string | number | null>
  /** <zh/> 行键属性名，默认 `data-adv-table-row-key` | <en/> Row key attribute, defaults to `data-adv-table-row-key` */
  rowKeyAttr?: string
}

/**
 * <zh/> 创建 hover 定位器 | <en/> Create hover locator
 */
export function createHoverLocator(options: HoverLocatorOptions) {
  const { getContainer, dom, hoverRowKey, rowKeyAttr } = options

  return (): HoveredRowRect | undefined => {
    const container = getContainer()
    if (!container)
      return undefined
    const key = hoverRowKey.value
    if (key == null)
      return undefined

    // <zh/> 每次调用读取选择器规格——JS 侧命名空间（uiConfig.namespace）运行时变更后即时生效；
    // <zh/> 注意样式侧不跟随运行时变更：自定义前缀需重建 CSS（SASS $ep-namespace 配对），见 README 命名空间章节
    // <en/> Read the selector spec per call so runtime JS-side namespace (uiConfig.namespace) changes take effect immediately;
    // <en/> note the style side does NOT follow runtime changes: a custom prefix needs a rebuilt CSS (pair SASS $ep-namespace), see the README namespace chapter
    const spec: RowLocateSpec = {
      rowSelector: dom.getRowSelector(),
      rowKeyAttr,
      bodyRect: {
        bodySelector: dom.getBodySelector(),
        scrollbars: dom.getBodyScrollbarSpec(),
      },
    }

    const located = locateRowByKey(container, String(key), spec)
    if (located)
      return clampRowToContainer(located.rect, located.containerRect)

    // <zh/> 回退：cell rect（虚拟回收后行容器已回收但 cell 仍在）——转义经 rowKeyAttrSelector 统一，
    // <zh/> rowKey 含反斜杠/引号不抛 SyntaxError；缺省属性名取常量
    // <en/> Fallback: cell rect (row recycled but cell remains) — escaping unified via rowKeyAttrSelector so
    // <en/> rowKeys with backslashes/quotes never throw SyntaxError; the default attr comes from the
    // <en/> constant
    const attrName = rowKeyAttr ?? ADV_TABLE_ROW_KEY_ATTR
    const containerRect = getBodyContainerRect(container, spec.bodyRect)
    const cell = container.querySelector<HTMLElement>(rowKeyAttrSelector(String(key), attrName))
    if (!cell)
      return undefined
    const cellRect = cell.getBoundingClientRect()
    const visible = cellRect.top + cellRect.height > containerRect.top && cellRect.top < containerRect.bottom
    if (!visible)
      return undefined
    return clampRowToContainer(cellRect, containerRect)
  }
}
