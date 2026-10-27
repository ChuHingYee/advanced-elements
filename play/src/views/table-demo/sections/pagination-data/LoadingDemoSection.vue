<!-- <zh/> 3.6 加载状态 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 3.6 加载状态 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { basicData, loadingDemoRef, loadingDemoV2Ref } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>3.6 加载状态</h1>
    <p>展示表格加载状态。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="loadingDemoRef"
          mode="default"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          loading
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          ref="loadingDemoV2Ref"
          mode="virtual"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          loading
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
