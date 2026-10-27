<!-- <zh/> 6.10 弹窗位置 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 6.10 弹窗位置 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { editColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { popupPositionData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>6.10 弹窗位置</h1>
    <p>控制弹窗编辑器的显示位置。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="popupPositionData"
          :columns="editColumns.map(c => ({ ...c, cellEditorPopup: { position: 'bottom' } }))"
          :edit-config="{}"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="popupPositionData"
          :columns="editColumns.map(c => ({ ...c, cellEditorPopup: { position: 'bottom' } }))"
          :edit-config="{}"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
