<!-- <zh/> 4.4 侧边筛选面板 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 4.4 侧边筛选面板 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { filterSortColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { filterSortData, sidePanelRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>4.4 侧边筛选面板</h1>
    <p>侧边栏形式的筛选面板。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="sidePanelRef"
          mode="default"
          :data="filterSortData"
          :columns="filterSortColumns"
          :filter-config="{ sidePanel: true }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="filterSortData"
          :columns="filterSortColumns"
          :filter-config="{ sidePanel: true }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
