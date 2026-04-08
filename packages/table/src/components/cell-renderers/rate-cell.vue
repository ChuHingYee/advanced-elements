<!--
  @component RateCell
  @displayName 评分单元格
  @displayName Rate Cell
  @description <zh/> 只读评分展示（静态星形，无交互） | <en/> Read-only rating display (static stars, non-interactive)
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  /** <zh/> 单元格数据，由表格自动传入 | <en/> Cell data, automatically passed in by the table */
  cellData?: unknown
  /** <zh/> 评分值 | <en/> Rating value */
  value?: number
  /** <zh/> 最大星数 | <en/> Maximum number of stars */
  count?: number
  /** <zh/> 是否显示评分文字 | <en/> Whether to show the score text */
  showScore?: boolean
  /**
   * <zh/> 图标尺寸档（small 14px，其余 18px，与 ElRate 默认一致）
   * <en/> Icon size tier (small 14px, others 18px, matching ElRate defaults)
   */
  size?: '' | 'small' | 'default' | 'large'
  /** <zh/> 是否允许半选（仅影响小数部分的显示，与 ElRate 禁用态一致） | <en/> Whether half values display (matches ElRate disabled state) */
  allowHalf?: boolean
}>(), {
  count: 5,
})

/**
 * StarFilled 字形路径（与 @element-plus/icons-vue StarFilled 同源，1024 视图盒）。
 * 只读展示恒用实心字形 + 颜色区分（与 EP 禁用态一致：未填充星亦为实心灰形）。
 * StarFilled glyph path (same source as @element-plus/icons-vue StarFilled, 1024 viewBox).
 * Read-only display always uses the solid glyph with color distinction (matching EP's
 * disabled state, where unfilled stars are also solid gray shapes).
 */
const STAR_PATH = 'M313.6 924.48a70.4 70.4 0 0 1-74.152-5.365 70.4 70.4 0 0 1-27.992-68.875l37.888-220.928L88.96 472.96a70.4 70.4 0 0 1 3.788-104.225A70.4 70.4 0 0 1 128 352.896l221.76-32.256 99.2-200.96a70.4 70.4 0 0 1 100.246-28.595 70.4 70.4 0 0 1 25.962 28.595l99.2 200.96 221.824 32.256a70.4 70.4 0 0 1 39.04 120.064L774.72 629.376l37.888 220.928a70.4 70.4 0 0 1-102.144 74.24L512 820.096l-198.4 104.32z'

const maxCount = computed(() => Math.max(1, Math.floor(props.count ?? 5)))
const score = computed(() => {
  const raw = props.value !== undefined ? props.value : Number(props.cellData)
  const n = Number.isNaN(raw) ? 0 : raw
  return Math.min(Math.max(n, 0), maxCount.value)
})
const fullStars = computed(() => Math.floor(score.value))
const fraction = computed(() => score.value - fullStars.value)
const iconPx = computed(() => (props.size === 'small' ? 14 : 18))
const containerPx = computed(() => {
  if (props.size === 'small')
    return 24
  if (props.size === 'large')
    return 40
  return 32
})
const ariaLabel = computed(() => `${score.value} / ${maxCount.value}`)
</script>

<template>
  <span
    class="adv-table__rate-cell"
    role="img"
    :aria-label="ariaLabel"
    :style="{ height: `${containerPx}px` }"
  >
    <span
      v-for="i in maxCount"
      :key="i"
      class="adv-table__rate-cell-star"
      :class="{ 'is-active': i <= fullStars }"
    >
      <svg
        class="adv-table__rate-cell-icon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1024 1024"
        :width="iconPx"
        :height="iconPx"
        aria-hidden="true"
      ><path
        :d="STAR_PATH"
        fill="currentColor"
      /></svg>
      <span
        v-if="i === fullStars + 1 && fraction > 0"
        class="adv-table__rate-cell-decimal"
        :style="{ width: `${fraction * 100}%` }"
      >
        <svg
          class="adv-table__rate-cell-decimal-icon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1024 1024"
          :width="iconPx"
          :height="iconPx"
          aria-hidden="true"
        ><path
          :d="STAR_PATH"
          fill="currentColor"
        /></svg>
      </span>
    </span>
    <span
      v-if="props.showScore"
      class="adv-table__rate-cell-text"
    >{{ score }}</span>
  </span>
</template>
