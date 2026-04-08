<!-- <zh/> 10.15 导入导出 + 工具栏 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 10.15 导入导出 + 工具栏 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { basicData, importLog, importRef, toolbarRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>10.15 导入导出 + 工具栏</h1>
    <p>表格工具栏功能。使用 <code>v-model:data</code> 支持导入数据更新。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="toolbarRef"
          v-model:data="basicData"
          mode="default"
          :columns="allValueTypeColumns.slice(0, 6)"
          :toolbar="{ exportBtn: true, importBtn: true }"
          height="400px"
        />
        <div style="margin-top: 10px">
          <div
            v-for="(log, i) in importLog"
            :key="i"
            style="font-size: 12px"
          >
            {{ log }}
          </div>
        </div>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          ref="importRef"
          v-model:data="basicData"
          mode="virtual"
          :columns="allValueTypeColumns.slice(0, 6)"
          :toolbar="{ exportBtn: true, importBtn: true }"
          height="400px"
        />
        <div style="margin-top: 10px">
          <div
            v-for="(log, i) in importLog"
            :key="i"
            style="font-size: 12px"
          >
            {{ log }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
