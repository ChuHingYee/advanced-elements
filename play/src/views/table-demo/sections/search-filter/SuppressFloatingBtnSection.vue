<!-- <zh/> 4.6 隐藏浮动筛选按钮 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 4.6 隐藏浮动筛选按钮 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { filterSortColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { filterSortData, suppressFloatingBtnRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>4.6 隐藏浮动筛选按钮</h1>
    <p>禁用浮动筛选按钮显示。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="suppressFloatingBtnRef"
          mode="default"
          :data="filterSortData"
          :columns="filterSortColumns.map(c => ({ ...c, suppressFloatingFilterButton: true }))"
          :filter-config="{ floatingFilter: true }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="filterSortData"
          :columns="filterSortColumns.map(c => ({ ...c, suppressFloatingFilterButton: true }))"
          :filter-config="{ floatingFilter: true }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
