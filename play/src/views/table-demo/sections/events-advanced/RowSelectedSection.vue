<!-- <zh/> 10.10 rowSelected 事件 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 10.10 rowSelected 事件 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { basicData, rowSelectedRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>10.10 rowSelected 事件</h1>
    <p>监听行选择事件。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="rowSelectedRef"
          mode="default"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          :row-config="{ rowSelection: 'multiple' }"
          height="400px"
          @row-selected="(e: any) => console.log('行选择:', e)"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          :row-config="{ rowSelection: 'multiple' }"
          height="400px"
          @row-selected="(e: any) => console.log('行选择:', e)"
        />
      </div>
    </div>
  </div>
</template>
