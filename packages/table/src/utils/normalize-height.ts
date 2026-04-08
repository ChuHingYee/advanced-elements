import { devWarn } from './dev-warn'

/**
 * <zh/> 合法 CSS 长度——数值 + 可选单位（无单位视为 px，与 ElTable 保持一致）。
 * <zh/> 必须全串匹配：`Number.parseFloat('50abc')` 会得 50 而静默接受垃圾后缀，故此处不用它做校验。
 * <en/> Legal CSS length — numeric value + optional unit (unitless means px, consistent with ElTable).
 * <en/> Must match the whole string: `Number.parseFloat('50abc')` yields 50 and would silently
 * <en/> accept garbage suffixes, so it is NOT used for validation here.
 */
const CSS_LENGTH_RE = /^(?:\d+(?:\.\d+)?|\.\d+)(px|%|vh|vw|vmin|vmax|rem|em|ex|ch|cm|mm|in|pt|pc|q)?$/

/**
 * <zh/> CSS 数学函数串（calc/min/max/clamp）——无法静态求值，校验仅确认函数外形后交由浏览器裁决。
 * <en/> CSS math-function strings (calc/min/max/clamp) — cannot be evaluated statically; validation
 * <en/> only confirms the function shape and lets the browser decide.
 */
const CSS_MATH_FN_RE = /^(calc|min|max|clamp)\([\s\S]*\)$/

/**
 * <zh/> 表格高度归一化——非法高度（负数/0/NaN/不可解析字符串/带垃圾后缀的字符串如 '50abc'）回退 undefined（自适应高度），
 * <zh/> 避免透传给 ElTable/ElTableV2 渲染出空白表体。合法值（正数、CSS 长度、calc/min/max/clamp 串）原样返回。
 * <en/> Normalize the table height — illegal heights (negative/0/NaN/unparseable strings/garbage-suffixed
 * <en/> strings like '50abc') fall back to undefined (auto height) instead of breaking ElTable/ElTableV2
 * <en/> into a blank body. Legal values (positive numbers, CSS lengths, calc/min/max/clamp strings)
 * <en/> pass through untouched.
 *
 * @param height - <zh/> 用户传入的 height（number | css 字符串 | undefined） | <en/> user-supplied height
 * @returns <zh/> 合法高度原样返回，否则 undefined（并一次性 dev 告警） | <en/> legal height as-is, otherwise undefined (plus a one-time dev warning)
 */
export function normalizeTableHeight(height: number | string | undefined): number | string | undefined {
  if (height === undefined || height === null)
    return undefined
  if (typeof height === 'number') {
    if (Number.isFinite(height) && height > 0)
      return height
  }
  else {
    const trimmed = height.trim()
    if (trimmed !== '' && (CSS_LENGTH_RE.test(trimmed) || CSS_MATH_FN_RE.test(trimmed))) {
      const numeric = Number.parseFloat(trimmed)
      // <zh/> 数学函数串无法静态求值（parseFloat 得 NaN），直接放行由浏览器裁决；数值串需为正数
      // <en/> Math-function strings cannot be evaluated statically (parseFloat yields NaN) — pass through
      // <en/> for the browser to decide; numeric strings must be positive
      if (!Number.isFinite(numeric) || numeric > 0)
        return height
    }
  }
  devWarn(
    `[AdvTable] Invalid table height "${String(height)}" — falling back to auto height. `
    + 'Height must be a positive number or a CSS size resolving to a positive value.',
  )
  return undefined
}
