<!-- <zh/> 8.5 defaultColDef/columnTypes section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 8.5 defaultColDef/columnTypes section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { defaultColDefColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { basicData, defaultColDefRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>8.5 defaultColDef / columnTypes</h1>
    <p>默认列配置和列类型预设。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="defaultColDefRef"
          mode="default"
          :data="basicData"
          :columns="defaultColDefColumns"
          :column-config="{ defaultColDef: { width: 120 }, columnTypes: { center: { align: 'center' }, money: { valueType: 'money', align: 'right', width: 100 } } }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="basicData"
          :columns="defaultColDefColumns"
          :column-config="{ defaultColDef: { width: 120 }, columnTypes: { center: { align: 'center' }, money: { valueType: 'money', align: 'right', width: 100 } } }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
