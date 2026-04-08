<!--
  @component IconDrag
  @displayName 拖拽手柄图标
  @displayName Drag Icon
  @description <zh/> 列设置拖拽手柄图标组件，用于列设置列表中拖拽排序的把手图标
  @description <en/> Drag handle icon component for column setting list drag sorting
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script setup lang="ts">
defineOptions({ name: 'IconDrag' })

withDefaults(defineProps<{
  /** <zh/> 图标尺寸（单位 px，支持数字或字符串） | <en/> Icon size (px, supports number or string) */
  size?: number | string
}>(), {
  size: 16,
})
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 1024 1024"
  >
    <path
      fill="currentColor"
      d="M300 276.497a56 56 0 1 0 56-96.994a56 56 0 0 0-56 96.994m0 284a56 56 0 1 0 56-96.994a56 56 0 0 0-56 96.994M640 228a56 56 0 1 0 112 0a56 56 0 0 0-112 0m0 284a56 56 0 1 0 112 0a56 56 0 0 0-112 0M300 844.497a56 56 0 1 0 56-96.994a56 56 0 0 0-56 96.994M640 796a56 56 0 1 0 112 0a56 56 0 0 0-112 0"
    />
  </svg>
</template>
