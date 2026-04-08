<!--
  @component LinkCell
  @displayName 链接单元格
  @displayName Link Cell
  @description <zh/> 基于 ElLink 封装的链接单元格渲染组件，支持截断显示，点击时触发事件
  @description <en/> Link cell renderer based on ElLink, supports truncation display, triggers event on click
  @category 数据展示 | Data Display
  @extends ElLink
  @since 1.0.0
-->
<script setup lang="ts">
import { ElLink } from 'element-plus'
import { computed } from 'vue'
import { sanitizeUrl } from '../../utils/security'

const props = defineProps<{
  cellData: unknown
  /** <zh/> 链接文本 | <en/> Link text */
  value?: string
  /** <zh/> 链接地址 | <en/> Link URL */
  href?: string
  /** <zh/> 最大显示长度，超出部分截断并显示省略号 | <en/> Max display length, truncates with ellipsis if exceeded */
  maxLength?: number
}>()

/** <zh/> 点击链接时触发 | <en/> Triggered when link is clicked */
defineEmits<{
  (e: 'click', value: string): void
}>()

/**
 * <zh/> 净化后的链接地址——显式 href 优先，回退单元格数据；
 * <zh/> 仅放行白名单协议（http/https/mailto/tel）与相对地址，
 * <zh/> `javascript:` 等可执行协议一律降级为空串（渲染为纯文本）。
 * <en/> Sanitized href — explicit href wins, falls back to cell data;
 * <en/> only whitelisted protocols (http/https/mailto/tel) and relative URLs pass,
 * <en/> executable protocols like `javascript:` degrade to '' (rendered as plain text).
 */
const safeHref = computed(() => sanitizeUrl(props.href ?? props.cellData))
</script>

<template>
  <ElLink
    v-if="value || cellData"
    :href="safeHref || undefined"
    target="_blank"
    rel="noopener noreferrer"
    type="primary"
    @click="$emit('click', value || (cellData as string))"
  >
    {{ value || cellData }}
  </ElLink>
  <span v-else />
</template>
