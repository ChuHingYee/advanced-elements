<!--
  @component AdvConfigProvider
  @displayName 全局配置提供者
  @displayName Config Provider
  @description <zh/> 通过 provide/inject 向后代注入组件级配置
  @description <en/> Provide component-level configuration to descendants via provide/inject
  @category 配置 | Configuration
  @extends None
  @since 1.0.0
-->
<script lang="ts" setup>
import type { AdvConfig } from './types'
import { computed } from 'vue'
import { deepMergeConfig, isEqualConfig } from './config-merge'
import { provideAdvConfig, useAdvConfig } from './context'

defineOptions({
  name: 'AdvConfigProvider',
  // <zh/> 逻辑型 Provider，无 DOM 根节点：关闭透传，避免 attrs 误落到 slot 内容上
  // <en/> Logical provider without a DOM root: disable fallthrough so attrs don't leak into slot content
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    /**
     * <zh/> 以组件名为 key 的全局配置
     * <en/> Global configuration keyed by component name
     *
     * @remarks
     * <zh/> 请替换引用而非深突变（如 `config = { ...config, table: {...} }`），深突变不会触发更新并绕过引用快路径
     * <en/> Replace the reference instead of deep-mutating (e.g. `config = { ...config, table: {...} }`); deep mutations don't trigger updates and bypass the reference fast path
     */
    config?: AdvConfig
  }>(),
  {
    config: () => ({}),
  },
)

// 合并父级配置（子级覆盖父级）
// Merge with parent config (child provider overrides parent)
const parentConfig = useAdvConfig()

const mergedConfig = computed<AdvConfig>((prev) => {
  const next = deepMergeConfig(parentConfig.value, props.config ?? {})

  if (prev && isEqualConfig(prev, next))
    return prev
  return next
})

provideAdvConfig(mergedConfig)
</script>

<template>
  <!--
    @slot default - <zh/> 默认插槽，渲染被配置包裹的子树 | <en/> Default slot, renders the configured subtree
  -->
  <slot />
</template>
