<!-- <zh/> 10.13 表格就绪(gridReady) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 10.13 表格就绪(gridReady) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { basicData, gridReadyLog, gridReadyRef, gridReadyV2Ref } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>10.13 表格就绪 (gridReady)</h1>
    <p>表格初始化完成事件。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="gridReadyRef"
          mode="default"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          height="400px"
          @grid-ready="() => gridReadyLog = 'Default 模式就绪'"
        />
        <div
          v-if="gridReadyLog"
          style="margin-top: 10px"
        >
          {{ gridReadyLog }}
        </div>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          ref="gridReadyV2Ref"
          mode="virtual"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          height="400px"
          @grid-ready="() => gridReadyLog = 'Virtual 模式就绪'"
        />
      </div>
    </div>
  </div>
</template>
