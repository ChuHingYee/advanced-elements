<!-- <zh/> 6.5 Tab/Enter编辑导航 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 6.5 Tab/Enter编辑导航 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { tabEnterNavColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { editData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>6.5 Tab/Enter 编辑导航</h1>
    <p>使用 Tab 和 Enter 键在单元格间导航。需要配置 <code>tabToNextCell</code> 和 <code>enterMovesDownAfterEdit</code>。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          v-model:data="editData"
          mode="default"
          :columns="tabEnterNavColumns"
          :edit-config="{ tabToNextCell: true, enterMovesDownAfterEdit: true }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          :data="editData"
          mode="virtual"
          :columns="tabEnterNavColumns"
          :edit-config="{ tabToNextCell: true, enterMovesDownAfterEdit: true }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
