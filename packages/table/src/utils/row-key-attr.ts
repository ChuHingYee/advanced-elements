/**
 * @file row-key-attr.ts
 * @description
 * <zh/> 行 key 的 DOM 读取单一入口。
 *
 * <zh/> **为什么收口**：行 key 标记的读取曾是「行拖拽 / 行定位」核心路径上的一处复制粘贴模式——
 * <zh/> `el.getAttribute(ATTR) || el.querySelector('[ATTR]')?.getAttribute(ATTR)` 在
 * <zh/> `default-dom-adapter` / `virtual-dom-adapter` / `use-row-drag`（3 处）/ `row-drag-utils`（2 处）
 * <zh/> 共 8 处独立书写，且 `'data-adv-table-row-key'` 字面量另有 7+ 处硬编码
 * <zh/> （`constants/index.ts` 早已导出 `ADV_TABLE_ROW_KEY_ATTR` 却少人使用，`table-renderer.vue`
 * <zh/> 甚至又本地重声明了一份同值常量）。这类重复正是「改一处漏一处」的典型温床：行 key 域一旦
 * <zh/> 变更，漏改的那处会表现为**拖拽错位 / 定位跳行**——一个不报错、只错位的故障，排查成本极高。
 *
 * <zh/> **读取顺序为何是「自身 → 后代」**：两种渲染器落标记的位置不同——default 模式把
 * <zh/> `data-adv-table-row-key` 打在 `<tr>` 上，virtual 模式打在行内单元格上。故调用方传入的
 * <zh/> 元素可能是标记所在节点本身，也可能是其祖先，统一按「先自身、再首个后代」解析。
 *
 * <en/> Single entry point for reading the row-key DOM marker.
 *
 * <en/> **Why centralize**: reading the row-key marker used to be a copy-paste pattern on the core
 * <en/> row-drag / row-locate path — `el.getAttribute(ATTR) || el.querySelector('[ATTR]')?.getAttribute(ATTR)`
 * <en/> appeared 8 times independently across `default-dom-adapter` / `virtual-dom-adapter` /
 * <en/> `use-row-drag` (3×) / `row-drag-utils` (2×), while the `'data-adv-table-row-key'` literal was
 * <en/> hardcoded in 7+ more places (`constants/index.ts` already exported `ADV_TABLE_ROW_KEY_ATTR` but
 * <en/> few used it, and `table-renderer.vue` re-declared a local constant of the same value). This is
 * <en/> the classic "change one, miss one" breeding ground: when the row-key domain changes, a missed
 * <en/> site shows up as **drag misalignment / locate jumping to the wrong row** — a silent,
 * <en/> throw-free failure that is very expensive to diagnose.
 *
 * <en/> **Why "self, then descendant"**: the two renderers place the marker differently — default mode
 * <en/> puts `data-adv-table-row-key` on the `<tr>`, virtual mode puts it on a cell inside the row. So
 * <en/> the element passed in may be the marker node itself or one of its ancestors; resolve uniformly
 * <en/> as "self first, then first descendant".
 */
import { ADV_TABLE_ROW_KEY_ATTR } from '../constants'
import { cssEscape } from './css-escape'

/**
 * <zh/> 从行元素（或其任意祖先/后代）解析行 key。
 *
 * <zh/> 按「自身属性 → 首个带标记的后代」顺序解析，覆盖 default/virtual 两种渲染器的落点差异。
 * <zh/> 返回 `null` 而非空串，以便调用方区分「没有标记」与「标记为空」。
 *
 * @param el - <zh/> 行元素、其祖先，或包含标记的容器 | <en/> row element, one of its ancestors, or a container holding the marker
 * @param attr - <zh/> 标记属性名，缺省用 `ADV_TABLE_ROW_KEY_ATTR` | <en/> marker attribute name, defaults to `ADV_TABLE_ROW_KEY_ATTR`
 * @returns <zh/> 行 key；未找到标记时为 `null` | <en/> the row key, or `null` when no marker is found
 */
export function readRowKeyAttr(el: Element | null | undefined, attr: string = ADV_TABLE_ROW_KEY_ATTR): string | null {
  if (!el)
    return null
  const own = el.getAttribute(attr)
  if (own !== null)
    return own
  // <zh/> 自闭合标签（如 summary 行的 <td/>）也要能落到后代标记上，故用 querySelector 而非 firstElementChild。
  // <en/> Void/self-closing tags (e.g. a summary row's <td/>) must also resolve to a descendant marker,
  // <en/> hence querySelector rather than firstElementChild.
  return el.querySelector(`[${attr}]`)?.getAttribute(attr) ?? null
}

/**
 * <zh/> 构造「按行 key 精确选中标记元素」的选择器——供需要以 key 反查行元素的场景使用
 * <zh/> （如 hover 定位）。key 经 `cssEscape` 转义，避免含引号/反斜杠的行 key 破坏选择器。
 *
 * @param rowKey - <zh/> 行 key | <en/> row key
 * @param attr - <zh/> 标记属性名，缺省用 `ADV_TABLE_ROW_KEY_ATTR` | <en/> marker attribute name, defaults to `ADV_TABLE_ROW_KEY_ATTR`
 * @returns <zh/> 可直接用于 `querySelector` 的选择器 | <en/> a selector ready for `querySelector`
 */
export function rowKeyAttrSelector(rowKey: string, attr: string = ADV_TABLE_ROW_KEY_ATTR): string {
  return `[${attr}="${cssEscape(rowKey)}"]`
}
