<!-- <zh/> 3.4 URL State section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 3.4 URL State section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { filterSortColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { filterSortData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>3.4 URL State</h1>
    <p>将分页、排序、筛选状态同步到 URL。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="filterSortData"
          :columns="filterSortColumns"
          :pagination="{ pageSize: 10 }"
          :url-state="{ enabled: true }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="filterSortData"
          :columns="filterSortColumns"
          :pagination="{ pageSize: 10 }"
          :url-state="{ enabled: true }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
