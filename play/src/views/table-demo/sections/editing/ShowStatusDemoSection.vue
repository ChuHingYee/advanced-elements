<!-- <zh/> 6.14 编辑状态视觉标记 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 6.14 编辑状态视觉标记 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { showStatusColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { showStatusData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>6.14 编辑状态视觉标记</h1>
    <p>显示单元格编辑状态标记。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="showStatusData"
          :columns="showStatusColumns"
          :edit-config="{ showStatus: true }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="showStatusData"
          :columns="showStatusColumns"
          :edit-config="{ showStatus: true }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
