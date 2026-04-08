<!-- <zh/> 10.2 右键菜单(menuConfig) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 10.2 右键菜单(menuConfig) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { basicData, contextMenuLog, contextMenuRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>10.2 右键菜单 (menuConfig)</h1>
    <p>右键点击表格区域弹出菜单。支持内置菜单项（复制、排序、导出等）和自定义菜单项。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="contextMenuRef"
          mode="default"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          :menu-config="{
            body: {
              enabled: true,
              options: [
                ['copyCell', 'copyRow', 'copySelectedRows'],
                ['clearCell', 'editCell'],
                ['autoSizeThisColumn', 'autoSizeAllColumns'],
                ['clearSort', 'clearAllFilters'],
                ['exportCsv', 'print'],
              ],
            },
          }"
          height="400px"
          @context-menu-click="(e: any) => contextMenuLog = `菜单: ${e.menu?.code ?? 'unknown'}`"
        />
        <div
          v-if="contextMenuLog"
          style="margin-top: 10px"
        >
          {{ contextMenuLog }}
        </div>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          :menu-config="{
            body: {
              enabled: true,
              options: [
                ['copyCell', 'copyRow', 'copySelectedRows'],
                ['clearCell', 'editCell'],
                ['autoSizeThisColumn', 'autoSizeAllColumns'],
                ['clearSort', 'clearAllFilters'],
                ['exportCsv', 'print'],
              ],
            },
          }"
          height="400px"
          @context-menu-click="(e: any) => contextMenuLog = `菜单: ${e.menu?.code ?? 'unknown'}`"
        />
      </div>
    </div>
  </div>
</template>
