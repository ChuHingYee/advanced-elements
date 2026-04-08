<!--
  @component ProgressCell
  @displayName 进度条单元格
  @displayName Progress Cell
  @description <zh/> 基于 ElProgress 封装的进度条单元格渲染组件，用于展示百分比进度条
  @description <en/> Progress cell renderer based on ElProgress, for displaying percentage progress bars
  @category 数据展示 | Data Display
  @extends ElProgress
  @since 1.0.0
-->
<script setup lang="ts">
import { ElProgress } from 'element-plus'
import { computed } from 'vue'

const props = defineProps<{
  /** <zh/> 百分比值，范围 0-100 | <en/> Percentage value, range 0-100 */
  value?: number
  /** <zh/> 进度条状态：success（成功）/exception（异常）/warning（警告） | <en/> Progress status: success/exception/warning */
  status?: 'success' | 'exception' | 'warning'
  /** <zh/> 进度条宽度（单位：px） | <en/> Progress stroke width (px) */
  strokeWidth?: number
  /** <zh/> 是否显示百分比文本 | <en/> Whether to show percentage text */
  showText?: boolean
}>()

const percentage = computed(() => {
  const num = Number(props.value ?? 0)
  return Math.min(100, Math.max(0, Number.isNaN(num) ? 0 : num))
})
</script>

<template>
  <div class="adv-table-progress-cell">
    <ElProgress
      :percentage="percentage"
      :stroke-width="strokeWidth ?? 6"
      :status="status"
      :show-text="showText ?? true"
    />
  </div>
</template>
