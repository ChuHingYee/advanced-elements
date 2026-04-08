/**
 * <zh/> axe 集成测试共享辅助——异步渲染器就绪等待 + 核心结构规则扫描
 * <en/> Shared helpers for axe integration tests — async renderer readiness wait + core structural rule scan
 *
 * @remarks
 * <zh/> 环境适配（happy-dom）：
 * <zh/> 1. defineAsyncComponent 的动态 import 在 vite-node 下需宏任务推进，单次 flushPromises 不足；
 * <zh/>    以 `.adv-table__main` 出现为就绪信号做条件轮询（见 components/__harness__/mount-table.tsx 同款策略）。
 * <zh/> 2. 规则扫描前剔除 HTML 注释——模板内含 `aria-rowcount` 字样的说明注释，不得计为属性存在。
 * <en/> Environment adaptations (happy-dom):
 * <en/> 1. defineAsyncComponent dynamic imports need macrotask pumping under vite-node; a single
 * <en/>    flushPromises is insufficient. Poll for `.adv-table__main` as the readiness signal
 * <en/>    (same strategy as components/__harness__/mount-table.tsx).
 * <en/> 2. Strip HTML comments before scanning — template comments mentioning `aria-rowcount`
 * <en/>    must not count as rendered attributes.
 */
import type { VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'

/** <zh/> 渲染器就绪轮询上限 | <en/> Renderer readiness poll deadline */
const READY_DEADLINE_MS = 15_000
/** <zh/> 轮询步长 | <en/> Poll step */
const POLL_STEP_MS = 25

/**
 * <zh/> 等待异步渲染器挂载完成
 * <en/> Wait until the async renderer is mounted
 */
export async function waitForRenderer(wrapper: VueWrapper): Promise<void> {
  const deadline = Date.now() + READY_DEADLINE_MS
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, POLL_STEP_MS))
    await nextTick()
    if (wrapper.find('.adv-table__main').exists())
      break
  }
  await nextTick()
  await nextTick()
}

/**
 * <zh/> 核心 axe 结构规则（注释已剔除后断言） | <en/> Core axe structural rules (asserted on comment-stripped html)
 */
export function structuralAxeRules(html: string): string[] {
  const text = html.replace(/<!--[\s\S]*?-->/g, '')
  const violations: string[] = []
  if (!text.includes('role="grid"'))
    violations.push('missing role="grid"')
  if (!text.includes('aria-rowcount'))
    violations.push('missing aria-rowcount')
  if (!text.includes('aria-colcount'))
    violations.push('missing aria-colcount')
  if (!text.includes('aria-label'))
    violations.push('missing aria-label')
  // <zh/> 检查重复 id | <en/> check duplicate id
  const ids = Array.from(text.matchAll(/id="([^"]+)"/g), m => m[1])
  if (new Set(ids).size !== ids.length)
    violations.push('duplicate id')
  return violations
}
