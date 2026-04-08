<!-- <zh/> 10.6 单元格合并 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 10.6 单元格合并 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { colMergeColumns, mergeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { colMergeData, colMergeRef, colMergeV2Ref, mergeData, mergeRef, mergeV2Ref } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>10.6 单元格合并</h1>
    <p>行合并和列合并：两种模式均支持行合并与列合并。</p>
    <h3>行合并 (rowspan)</h3>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="mergeRef"
          mode="default"
          :data="mergeData"
          :columns="mergeColumns"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          ref="mergeV2Ref"
          mode="virtual"
          :data="mergeData"
          :columns="mergeColumns"
          height="400px"
        />
      </div>
    </div>
    <h3>列合并 (colspan)</h3>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="colMergeRef"
          mode="default"
          :data="colMergeData"
          :columns="colMergeColumns"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          ref="colMergeV2Ref"
          mode="virtual"
          :data="colMergeData"
          :columns="colMergeColumns"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
