<!-- <zh/> 5.5 拖拽事件 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 5.5 拖拽事件 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { dragColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { dragEventData, dragEventLog, dragEventLogV2, dragEventRef, dragEventV2Data, dragEventV2Ref } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>5.5 拖拽事件</h1>
    <p>监听拖拽相关事件。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="dragEventRef"
          v-model:data="dragEventData"
          mode="default"
          :columns="dragColumns"
          :row-config="{ rowDraggable: true, rowDragHandle: '.drag-handle' }"
          height="400px"
          @row-drag-start="(e: any) => dragEventLog.push(`开始拖拽: ${e.sourceRow.name}`)"
          @row-drag-end="(e: any) => dragEventLog.push(`结束拖拽: ${e.sourceRow.name} → ${e.targetRow?.name ?? '末尾'}`)"
        />
        <div style="margin-top: 10px; max-height: 100px; overflow-y: auto">
          <div
            v-for="(log, i) in dragEventLog"
            :key="i"
            style="font-size: 12px; color: #606266"
          >
            {{ log }}
          </div>
        </div>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          ref="dragEventV2Ref"
          v-model:data="dragEventV2Data"
          mode="virtual"
          :columns="dragColumns"
          :row-config="{ rowDraggable: true, rowDragHandle: '.drag-handle' }"
          height="400px"
          @row-drag-start="(e: any) => dragEventLogV2.push(`开始拖拽: ${e.sourceRow.name}`)"
          @row-drag-end="(e: any) => dragEventLogV2.push(`结束拖拽: ${e.sourceRow.name} → ${e.targetRow?.name ?? '末尾'}`)"
        />
        <div style="margin-top: 10px; max-height: 100px; overflow-y: auto">
          <div
            v-for="(log, i) in dragEventLogV2"
            :key="i"
            style="font-size: 12px; color: #606266"
          >
            {{ log }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
