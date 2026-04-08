<!-- <zh/> 10.16 集合侧边栏 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 10.16 集合侧边栏 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { sidePanelComboColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { sidePanelComboData, sidePanelComboRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>10.16 集合侧边栏</h1>
    <p>组合侧边栏功能。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="sidePanelComboRef"
          mode="default"
          :data="sidePanelComboData"
          :columns="sidePanelComboColumns"
          :filter-config="{ sidePanel: true }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="sidePanelComboData"
          :columns="sidePanelComboColumns"
          :filter-config="{ sidePanel: true }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
