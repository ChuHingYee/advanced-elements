import type { InjectionKey, Ref } from 'vue'
import type { AdvConfig } from './types'
import { inject, provide, ref, shallowReadonly } from 'vue'

/** <zh/> 全局配置 provide/inject key（消费侧只读，写入经 AdvConfigProvider 的 config prop） | <en/> Global config provide/inject key (readonly for consumers; writes go through AdvConfigProvider's config prop) */
export const advConfigKey: InjectionKey<Readonly<Ref<AdvConfig>>> = Symbol('advConfig')

/**
 * <zh/> 无 Provider 时的共享空配置——值对象冻结 + ref 浅只读，阻断经共享引用写入的多实例污染
 * <en/> Shared empty config without a provider — frozen value plus shallow-readonly ref, blocking cross-instance pollution via the shared reference
 */
const EMPTY_CONFIG: Readonly<Ref<AdvConfig>> = shallowReadonly(ref<AdvConfig>(Object.freeze({})))

/**
 * <zh/> 向后代组件提供全局配置
 * <en/> Provide global config to descendant components
 *
 * @remarks
 * <zh/> 由 AdvConfigProvider 内部使用
 * <en/> Used internally by AdvConfigProvider
 */
export function provideAdvConfig(config: Readonly<Ref<AdvConfig>>) {
  provide(advConfigKey, config)
}

/**
 * <zh/> 从祖先 AdvConfigProvider 获取全局配置
 * <en/> Get global config from ancestor AdvConfigProvider
 *
 * @returns <zh/> 只读响应式 ref — 消费方仅可通过 `.value` 读取，变更须经 Provider 的 config prop 替换引用
 *          | <en/> A readonly reactive ref — consumers may only read via `.value`; changes must replace the reference through the provider's config prop
 */
export function useAdvConfig(): Readonly<Ref<AdvConfig>> {
  return inject(advConfigKey, EMPTY_CONFIG)
}
