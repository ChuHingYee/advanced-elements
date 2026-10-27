<!-- <zh/> 5.3 行拖拽 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 5.3 行拖拽 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { dragColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { dragData, dragDataV2, dragRef, dragV2Ref } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>5.3 行拖拽</h1>
    <p>拖拽行进行排序。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="dragRef"
          v-model:data="dragData"
          mode="default"
          :columns="dragColumns"
          :row-config="{ rowDraggable: true, rowDragHandle: '.drag-handle' }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          ref="dragV2Ref"
          v-model:data="dragDataV2"
          mode="virtual"
          :columns="dragColumns"
          :row-config="{ rowDraggable: true, rowDragHandle: '.drag-handle' }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
