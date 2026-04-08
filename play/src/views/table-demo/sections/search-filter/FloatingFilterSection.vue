<!-- <zh/> 4.2 浮动筛选 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 4.2 浮动筛选 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { filterSortColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { filterSortData, floatingFilterRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>4.2 浮动筛选</h1>
    <p>列头内置浮动筛选器。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="floatingFilterRef"
          mode="default"
          :data="filterSortData"
          :columns="filterSortColumns"
          :filter-config="{ floatingFilter: true }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="filterSortData"
          :columns="filterSortColumns"
          :filter-config="{ floatingFilter: true }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
