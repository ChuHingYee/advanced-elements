<!-- <zh/> 8.1 列宽拖拽 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 8.1 列宽拖拽 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { resizeCols } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { basicData, resizeRef, resizeV2Ref } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>8.1 列宽拖拽</h1>
    <p>拖拽列边框调整列宽。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="resizeRef"
          mode="default"
          :data="basicData"
          :columns="resizeCols"
          resizable
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          ref="resizeV2Ref"
          mode="virtual"
          :data="basicData"
          :columns="resizeCols"
          resizable
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
