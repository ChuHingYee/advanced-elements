<!-- <zh/> 10.7 声明式单元格合并(spanRows/colSpan) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 10.7 声明式单元格合并(spanRows/colSpan) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { colMergeColumns, mergeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { colMergeData, mergeData, spanMethodRef, spanMethodV2Ref } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>10.7 声明式单元格合并 (spanRows / colSpan)</h1>
    <p>通过列级 <code>spanRows</code>（行合并）和 <code>colSpan</code>（列合并）声明式配置合并规则。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式 - spanRows 行合并</h4>
        <adv-table
          ref="spanMethodRef"
          mode="default"
          :data="mergeData"
          :columns="mergeColumns"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式 - colSpan 列合并</h4>
        <adv-table
          ref="spanMethodV2Ref"
          mode="virtual"
          :data="colMergeData"
          :columns="colMergeColumns"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
