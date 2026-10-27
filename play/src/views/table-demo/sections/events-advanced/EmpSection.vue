<!-- <zh/> 10.17 多级表头 + 筛选 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 10.17 多级表头 + 筛选 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { empColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { empData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>10.17 多级表头 + 筛选</h1>
    <p>多级表头配合筛选功能。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="empData"
          :columns="empColumns"
          :filter-config="{ floatingFilter: true }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="empData"
          :columns="empColumns"
          :filter-config="{ floatingFilter: true }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
