<!-- <zh/> 5.1 列筛选+排序 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 5.1 列筛选+排序 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { filterSortColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { filterSortData, filterSortRef, filterSortV2Ref } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>5.1 列筛选+排序</h1>
    <p>列头筛选和排序功能。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="filterSortRef"
          mode="default"
          :data="filterSortData"
          :columns="filterSortColumns"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          ref="filterSortV2Ref"
          mode="virtual"
          :data="filterSortData"
          :columns="filterSortColumns"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
