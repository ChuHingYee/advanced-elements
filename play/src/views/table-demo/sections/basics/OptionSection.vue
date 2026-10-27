<!-- <zh/> 1.5 操作按钮列 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 1.5 操作按钮列 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { optionColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { optionData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>1.5 操作按钮列</h1>
    <p>Hover 显示操作按钮（Teleport 模式）。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="optionData"
          :columns="optionColumns"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="optionData"
          :columns="optionColumns"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
