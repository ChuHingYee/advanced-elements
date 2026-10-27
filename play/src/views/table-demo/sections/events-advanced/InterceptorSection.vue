<!-- <zh/> 10.3 事件拦截器 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 10.3 事件拦截器 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { basicData, interceptorLog, interceptorRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>10.3 事件拦截器</h1>
    <p>拦截和修改表格事件。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="interceptorRef"
          mode="default"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          :interceptor="{ 'event.rowClick': () => { interceptorLog = '行点击被拦截'; return false } }"
          height="400px"
        />
        <div
          v-if="interceptorLog"
          style="margin-top: 10px"
        >
          {{ interceptorLog }}
        </div>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          :interceptor="{ 'event.rowClick': () => { interceptorLog = '行点击被拦截'; return false } }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
