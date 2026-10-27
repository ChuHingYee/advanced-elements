<!-- <zh/> 11.16 提示格式化(tooltipFormatter) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 11.16 提示格式化(tooltipFormatter) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { useDemoContext } from '../../demo-context'

const { surfaceTooltipFormatter, tooltipDemoCols, tooltipDemoData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>11.16 提示格式化 (tooltipFormatter)</h1>
    <p>表级别 <code>tooltipFormatter</code> 作为溢出 tooltip 默认格式化，可被列级别 <code>tooltipFormatter</code> 覆盖。演示使用窄列 + 超长文本（宽度 150 内的描述列文本溢出），鼠标悬浮溢出单元格时 tooltip 内容为 <code>[prop] name = value</code> 格式。</p>
    <p style="font-size: 12px; color: #909399; margin-bottom: 10px">
      👉 请将鼠标悬浮在“描述”列被截断的文本上，观察 tooltip 是否显示为格式化后的 <code>[description] 用户X = ...</code>
    </p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default（悬浮描述列）</h4>
        <adv-table
          mode="default"
          :data="tooltipDemoData"
          :columns="tooltipDemoCols"
          :tooltip-formatter="surfaceTooltipFormatter"
          height="300px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual（悬浮描述列）</h4>
        <adv-table
          mode="virtual"
          :data="tooltipDemoData"
          :columns="tooltipDemoCols"
          :tooltip-formatter="surfaceTooltipFormatter"
          height="300px"
        />
      </div>
    </div>
  </div>
</template>
