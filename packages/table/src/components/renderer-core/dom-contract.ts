import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'

/**
 * <zh/> EP DOM 契约校验结果
 * <en/> EP DOM contract verification result
 */
export interface DomContractResult {
  /** <zh/> 全部命中时为 true | <en/> true when every selector matches */
  ok: boolean
  /** <zh/> 未命中的选择器清单 | <en/> selectors that matched nothing */
  missing: string[]
}

/**
 * <zh/> 校验 EP DOM 契约——对同一 root 批量验证多个选择器，一次返回全部失配项（dev 去重告警），供升级回归 fail-fast。
 *
 * <zh/> 注意：仅在**稳定时点**调用（挂载后真实渲染产物 / guard 单测）；挂载前 DOM 本就不存在，热路径仍返回 null/[] 优雅降级。
 * <en/> Verify the EP DOM contract — batch-check several selectors against one root and return every miss at once (deduped dev warning) for fail-fast upgrade regression.
 *
 * <en/> Call only at **stable points** (post-mount real output / guard tests); pre-mount the DOM legitimately
 * <en/> misses, so hot paths still degrade gracefully with null/[].
 */
export function verifyDomContract(
  root: ParentNode | null | undefined,
  selectors: readonly string[],
  context: string,
): DomContractResult {
  const missing = !root
    ? [...selectors]
    : selectors.filter(selector => !root.querySelector(selector))
  if (missing.length > 0 && isDev) {
    devWarn(
      `[AdvTable] EP DOM contract broken (${context}): ${missing.length} selector(s) matched nothing: `
      + `${missing.join(', ')}. See EP-UPGRADE-CHECKLIST.md.`,
    )
  }
  return { ok: missing.length === 0, missing }
}

/**
 * <zh/> 断言 EP DOM 契约——失配即抛错（guard 单测 / strict 调用方），错误信息一次列出全部失配选择器。
 * <en/> Assert the EP DOM contract — throws on mismatch (guard tests / strict callers), listing every miss at once.
 */
export function assertDomContract(
  root: ParentNode | null | undefined,
  selectors: readonly string[],
  context: string,
): void {
  const { missing } = verifyDomContract(root, selectors, context)
  if (missing.length > 0) {
    throw new Error(
      `[AdvTable] EP DOM contract broken (${context}): ${missing.join(', ')}. See EP-UPGRADE-CHECKLIST.md.`,
    )
  }
}
