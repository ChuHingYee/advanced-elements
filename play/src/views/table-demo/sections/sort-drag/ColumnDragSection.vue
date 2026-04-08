<!-- <zh/> 5.4 列拖拽排序 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 5.4 列拖拽排序 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { columnDragColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { columnDragData, columnDragDataV2 } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>5.4 列拖拽排序</h1>
    <p>拖拽列头调整列顺序。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="columnDragData"
          :columns="columnDragColumns"
          :column-config="{ columnDraggable: true }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="columnDragDataV2"
          :columns="columnDragColumns"
          :column-config="{ columnDraggable: true }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
