<!-- <zh/> 8.4 列组管理 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 8.4 列组管理 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { filterSortColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { filterSortData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>8.4 列组管理</h1>
    <p>列分组显示/隐藏管理。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="filterSortData"
          :columns="filterSortColumns"
          :column-config="{ columnGroup: { enabled: true } }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="filterSortData"
          :columns="filterSortColumns"
          :column-config="{ columnGroup: { enabled: true } }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
