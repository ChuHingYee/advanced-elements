<!-- <zh/> 8.2 外边框与列宽拖拽 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 8.2 外边框与列宽拖拽 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElCheckbox } from 'element-plus'
import { resizeCols } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { basicData, borderOn, resizableOn } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>8.2 外边框与列宽拖拽</h1>
    <p>同时启用外边框和列宽拖拽。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="basicData"
          :columns="resizeCols"
          :border="borderOn"
          :resizable="resizableOn"
          height="400px"
        />
        <div style="margin-top: 10px">
          <ElCheckbox v-model="borderOn">
            显示边框
          </ElCheckbox>
          <ElCheckbox v-model="resizableOn">
            允许拖拽
          </ElCheckbox>
        </div>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="basicData"
          :columns="resizeCols"
          :border="borderOn"
          :resizable="resizableOn"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
