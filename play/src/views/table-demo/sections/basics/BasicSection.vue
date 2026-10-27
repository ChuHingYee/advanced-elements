<!-- <zh/> 1.1 基础用法 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 1.1 基础用法 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { basicData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>1.1 基础用法</h1>
    <p>最简单的表格用法，展示基础列配置。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
