<!--
  @component SummaryCell
  @displayName 汇总表尾单元格
  @displayName Summary Cell
  @description <zh/> 用于虚拟滚动模式（ElTableV2）的汇总行，渲染单个单元格的值，支持 string 直接文本渲染和 VNode 自定义渲染两种模式
  @description <en/> Summary cell for virtual scrolling mode (ElTableV2), renders single cell value, supports string text rendering and VNode custom rendering
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script setup lang="ts">
import type { VNode } from 'vue'

defineProps<{
  value: string | VNode | undefined
}>()
</script>

<template>
  <template v-if="value !== undefined">
    <template v-if="typeof value === 'string'">
      {{ value }}
    </template>
    <component
      :is="value"
      v-else
    />
  </template>
</template>
