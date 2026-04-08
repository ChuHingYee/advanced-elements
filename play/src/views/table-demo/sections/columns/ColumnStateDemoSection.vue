<!-- <zh/> 8.3 列状态持久化 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 8.3 列状态持久化 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { columnStateColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { columnStateData, columnStateRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>8.3 列状态持久化</h1>
    <p>保存和恢复列状态（宽度、顺序、显示）。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="columnStateRef"
          mode="default"
          :data="columnStateData"
          :columns="columnStateColumns"
          :column-state="{ enabled: true, storageKey: 'demo-column-state' }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="columnStateData"
          :columns="columnStateColumns"
          :column-state="{ enabled: true, storageKey: 'demo-column-state-v2' }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
