<!-- <zh/> 2.2 Shift+Click范围选择 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 2.2 Shift+Click范围选择 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { filterSortColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { filterSortData, selShiftDefaultRef, selShiftVirtualRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>2.2 Shift+Click 范围选择</h1>
    <p>按住 Shift 键点击可选择连续行范围。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="selShiftDefaultRef"
          mode="default"
          :data="filterSortData"
          :columns="filterSortColumns"
          :row-config="{ rowSelection: 'multiple' }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          ref="selShiftVirtualRef"
          mode="virtual"
          :data="filterSortData"
          :columns="filterSortColumns"
          :row-config="{ rowSelection: 'multiple' }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
