<!-- <zh/> 10.8b Tooltip 选项(tooltipOptions) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 10.8b Tooltip 选项(tooltipOptions) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { rowClassNameColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { rowClassNameData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>10.8b Tooltip 选项 (tooltipOptions)</h1>
    <p>通过 <code>tooltipOptions</code> 自定义溢出 tooltip 的 placement、popperClass 等选项。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式 — placement: top</h4>
        <adv-table
          mode="default"
          :data="rowClassNameData"
          :columns="rowClassNameColumns"
          :tooltip-options="{ placement: 'top' }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式 — placement: bottom</h4>
        <adv-table
          mode="virtual"
          :data="rowClassNameData"
          :columns="rowClassNameColumns"
          :tooltip-options="{ placement: 'bottom' }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
