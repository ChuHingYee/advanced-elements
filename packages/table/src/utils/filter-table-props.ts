/**
 * <zh/> 允许透传到原生 HTML 元素的属性集合。这些属性是标准 HTML 全局属性，不受表格组件 Props 约束。
 * <en/> Set of attributes allowed to pass through to native HTML elements. These are standard HTML global attributes, not constrained by the table component's Props.
 */
export const ALLOWED_HTML_ATTRS = new Set(['class', 'style', 'id', 'key'])

/**
 * <zh/> 从 props 对象中提取可透传的属性，避免将模板已绑定的属性重复传入底层组件。
 * <en/> Extract pass-through props from a props object, avoiding re-passing attributes already bound in the template to the underlying component.
 *
 * @example
 * filterTableProps({ a: 1, b: 2 }, new Set(['a']), new Set)
 * // => { a: 1 }
 */
export function filterTableProps(
  props: Record<string, unknown>,
  allowedKeys: Set<string>,
  explicitlyBound: Set<string>,
): Record<string, unknown> {
  const rest: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (
      (allowedKeys.has(key) || ALLOWED_HTML_ATTRS.has(key))
      && !explicitlyBound.has(key)
    ) {
      rest[key] = value
    }
  }
  return rest
}
