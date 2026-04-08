<!-- <zh/> 6.9 弹窗编辑器 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 6.9 弹窗编辑器 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { editColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { popupEditData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>6.9 弹窗编辑器</h1>
    <p>使用弹窗形式编辑单元格。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="popupEditData"
          :columns="editColumns.map(c => ({ ...c, cellEditorPopup: true }))"
          :edit-config="{}"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="popupEditData"
          :columns="editColumns.map(c => ({ ...c, cellEditorPopup: true }))"
          :edit-config="{}"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
