<!-- <zh/> 3.5 数据轮询 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 3.5 数据轮询 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'
import { genData } from '../../demo-data'

const { basicData, pollingRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>3.5 数据轮询</h1>
    <p>定时轮询更新数据。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="pollingRef"
          mode="default"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          :request="{ source: async () => ({ data: genData(10), total: 10 }) }"
          :toolbar="{ pollingBtn: true, pollingOptions: { time: 5000 } }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          :request="{ source: async () => ({ data: genData(10), total: 10 }) }"
          :toolbar="{ pollingBtn: true, pollingOptions: { time: 5000 } }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
