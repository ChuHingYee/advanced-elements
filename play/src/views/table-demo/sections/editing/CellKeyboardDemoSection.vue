<!-- <zh/> 6.19 单元格键盘事件 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 6.19 单元格键盘事件 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { cellKeyboardColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { cellKeyboardLog, cellKeyboardLogV2, cellKeyboardRef, editData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>6.19 单元格键盘事件</h1>
    <p>监听单元格键盘事件。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="cellKeyboardRef"
          mode="default"
          :data="editData"
          :columns="cellKeyboardColumns"
          :edit-config="{}"
          height="400px"
          @cell-key-down="(e: any) => cellKeyboardLog.push(`按键: ${e.event.key}`)"
        />
        <div style="margin-top: 10px; font-size: 12px">
          最近按键: {{ cellKeyboardLog.slice(-1)[0] || '无' }}
        </div>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="editData"
          :columns="cellKeyboardColumns"
          :edit-config="{}"
          height="400px"
          @cell-key-down="(e: any) => cellKeyboardLogV2.push(`按键: ${e.event.key}`)"
        />
        <div style="margin-top: 10px; font-size: 12px">
          最近按键: {{ cellKeyboardLogV2.slice(-1)[0] || '无' }}
        </div>
      </div>
    </div>
  </div>
</template>
