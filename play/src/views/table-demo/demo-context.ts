import type { InjectionKey } from 'vue'
import { inject, provide } from 'vue'

/**
 * <zh/> 演示上下文——TableDemo 壳提供全量本地绑定（状态 ref/计算属性/事件处理器），
 * <zh/> 迁出的 section 组件经 useDemoContext() 按需解构消费（COMPLEXITY-PLAN 战线二）。
 * <zh/> 刻意 any：演示域不复制整套 ref 的类型面；缺绑定由 vue-tsc 的模板标识符检查兜底。
 * <en/> Demo context — the TableDemo shell provides every local binding (state refs, computeds,
 * <en/> handlers); migrated sections destructure what they need via useDemoContext().
 * <en/> Deliberately any: the demo layer does not replicate the whole ref type surface;
 * <en/> missing bindings are still caught by vue-tsc's template identifier checks.
 */
export type DemoContext = Record<string, any>

const demoContextKey: InjectionKey<DemoContext> = Symbol('demoContext')

/** <zh/> 壳侧提供（仅 TableDemo 调用一次） | <en/> provider side (TableDemo calls once) */
export function provideDemoContext(ctx: DemoContext): void {
  provide(demoContextKey, ctx)
}

/** <zh/> section 侧消费，壳外调用立即抛错 | <en/> consumer side; throws outside the shell */
export function useDemoContext(): DemoContext {
  const ctx = inject(demoContextKey)
  if (!ctx)
    throw new Error('[demo] useDemoContext() called outside the TableDemo shell')
  return ctx
}
