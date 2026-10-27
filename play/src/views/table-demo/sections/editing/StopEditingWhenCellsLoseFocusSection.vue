<!-- <zh/> 6.8 失焦结束编辑 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 6.8 失焦结束编辑 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { loseFocusColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { loseFocusData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>6.8 失焦结束编辑</h1>
    <p>单元格失去焦点时自动结束编辑。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          v-model:data="loseFocusData"
          mode="default"
          :columns="loseFocusColumns"
          :edit-config="{ stopEditingWhenCellsLoseFocus: true }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          :data="loseFocusData"
          mode="virtual"
          :columns="loseFocusColumns"
          :edit-config="{ stopEditingWhenCellsLoseFocus: true }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
