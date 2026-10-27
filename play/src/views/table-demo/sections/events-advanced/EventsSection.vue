<!-- <zh/> 10.1 事件监听 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 10.1 事件监听 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { basicData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>10.1 事件监听</h1>
    <p>监听表格各种事件。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          height="400px"
          @row-click="(params: any) => console.log('行点击:', params.rowData.name)"
          @selection-change="(rows: any) => console.log('选择变化:', rows.length)"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          height="400px"
          @row-click="(params: any) => console.log('行点击:', params.rowData.name)"
          @selection-change="(rows: any) => console.log('选择变化:', rows.length)"
        />
      </div>
    </div>
  </div>
</template>
