<!--
  @component AvatarCell
  @displayName 头像单元格
  @displayName Avatar Cell
  @description <zh/> 基于 ElAvatar 封装的头像单元格渲染组件，用于在表格单元格中展示头像图片
  @description <en/> Avatar cell renderer based on ElAvatar, for displaying avatar images in table cells
  @category 数据展示 | Data Display
  @extends ElAvatar
  @since 1.0.0
-->
<script setup lang="ts">
import { ElAvatar } from 'element-plus'

defineProps<{
  /** <zh/> 头像图片地址 | <en/> Avatar image URL */
  src?: string
  /** <zh/> 图片替代文本 | <en/> Image alt text */
  alt?: string
  /** <zh/> 头像尺寸 | <en/> Avatar size */
  size?: 'small' | 'default' | 'large' | number
}>()
</script>

<template>
  <ElAvatar
    v-if="src"
    :size="size ?? 'small'"
    :src="src"
    :alt="alt"
  />
  <span v-else />
</template>
