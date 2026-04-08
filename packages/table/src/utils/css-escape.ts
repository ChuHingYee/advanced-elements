/**
 * <zh/> CSS.escape 兼容 — 浏览器原生 CSS.escape 回退
 * <en/> CSS.escape compat — fallback for browsers without native CSS.escape
 *
 * @remarks
 * <zh/> `CSS.escape` 在 `chrome >=46` 可用，`browserslist` 为 `chrome >=94` 理论可用，但 SSR/Node/happy-dom 无 `CSS`
 * <zh/> 回退仅转义 `"` 与 `\` 满足 `querySelector([attr="value"])` 场景，`rowKey` 来自数据含引号时防注入
 * <en/> `CSS.escape` available since `chrome >=46`, `browserslist` `chrome >=94` theoretically ok, but SSR/Node/happy-dom has no `CSS`
 * <en/> Fallback only escapes `"` and `\` for `querySelector([attr="value"])`, `rowKey` from data may contain quotes
 *
 * <zh/> **本函数只适用于属性值上下文**（`[attr="value"]`）。需要按 id 定位元素时不要构造
 * <zh/> `#\${id}` 选择器：`uiConfig.tableId` 是使用者输入，`#123` / `#order.list` 会抛 `SyntaxError`；
 * <zh/> 且转义并非可靠替代——测试环境 happy-dom 的选择器引擎不支持 CSS 转义
 * <zh/> （`CSS.escape('123')` 产出的 `#\31 23` 同样不命中），应改用 `getElementById` + 子树查询
 * <zh/> （见 `renderer-core/*-dom-adapter.ts` 的 `tableRoot`）。
 * <en/> **Attribute-value context only** (`[attr="value"]`). Do not build `#\${id}` selectors to locate
 * <en/> elements by id: `uiConfig.tableId` is user input, and `#123` / `#order.list` throw `SyntaxError`;
 * <en/> escaping is not a reliable substitute either — the test environment's happy-dom selector engine
 * <en/> supports no CSS escapes (the `#\31 23` produced by `CSS.escape('123')` also fails to match), so
 * <en/> use `getElementById` + subtree queries instead (see `tableRoot` in `renderer-core/*-dom-adapter.ts`).
 */

const BACKSLASH_RE = /\\/g
const QUOTE_RE = /"/g

/**
 * <zh/> 转义 CSS 选择器属性值 | <en/> Escape CSS selector attribute value
 */
export function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  // <zh/> 回退：仅转义引号与反斜杠，满足属性选择器 | <en/> Fallback: only escape quotes and backslash for attribute selector
  return value.replace(BACKSLASH_RE, '\\\\').replace(QUOTE_RE, '\\"')
}
