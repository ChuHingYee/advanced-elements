<!-- <zh/> 2.5 单元格范围选择 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 2.5 单元格范围选择 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { cellRangeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { cellRangeData, cellRangeSelectionLog, cellRangeSelectionLogV2 } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>2.5 单元格范围选择</h1>
    <p>鼠标拖拽选择单元格范围，支持复制。使用内置 <code>rangeSelection</code> prop 启用。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="cellRangeData"
          :columns="cellRangeColumns"
          range-selection
          height="400px"
          @cell-range-selected="(s: any) => cellRangeSelectionLog = `已选: ${s.range.startRow}-${s.range.endRow} 行, ${s.range.startCol}-${s.range.endCol} 列`"
        />
        <div
          v-if="cellRangeSelectionLog"
          style="margin-top: 10px"
        >
          {{ cellRangeSelectionLog }}
        </div>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="cellRangeData"
          :columns="cellRangeColumns"
          range-selection
          height="400px"
          @cell-range-selected="(s: any) => cellRangeSelectionLogV2 = `已选: ${s.range.startRow}-${s.range.endRow} 行, ${s.range.startCol}-${s.range.endCol} 列`"
        />
        <div
          v-if="cellRangeSelectionLogV2"
          style="margin-top: 10px"
        >
          {{ cellRangeSelectionLogV2 }}
        </div>
      </div>
    </div>
  </div>
</template>
