<!-- <zh/> 10.12 单元格聚焦事件 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 10.12 单元格聚焦事件 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { basicData, cellFocusedLog, cellFocusedRef, cellFocusedV2Ref } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>10.12 单元格聚焦事件</h1>
    <p>监听单元格聚焦事件。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="cellFocusedRef"
          mode="default"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          height="400px"
          @cell-focused="(e: any) => cellFocusedLog = `聚焦: ${e.column?.prop}`"
        />
        <div style="margin-top: 10px">
          当前聚焦: {{ cellFocusedLog || '无' }}
        </div>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          ref="cellFocusedV2Ref"
          mode="virtual"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          height="400px"
          @cell-focused="(e: any) => cellFocusedLog = `聚焦: ${e.column?.prop}`"
        />
      </div>
    </div>
  </div>
</template>
