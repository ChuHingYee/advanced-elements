<!-- <zh/> 6.15 编辑器生命周期 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 6.15 编辑器生命周期 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { lifecycleColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { lifecycleData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>6.15 编辑器生命周期</h1>
    <p>监听编辑器生命周期事件。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="lifecycleData"
          :columns="lifecycleColumns"
          :edit-config="{}"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="lifecycleData"
          :columns="lifecycleColumns"
          :edit-config="{}"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
