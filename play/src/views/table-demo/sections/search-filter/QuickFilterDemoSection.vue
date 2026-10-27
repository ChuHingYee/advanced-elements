<!-- <zh/> 4.3 全局搜索(quickFilter) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 4.3 全局搜索(quickFilter) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElInput } from 'element-plus'
import { filterSortColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { filterSortData, quickFilterRef, quickFilterText } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>4.3 全局搜索 (quickFilter)</h1>
    <p>全局文本搜索过滤。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <ElInput
          v-model="quickFilterText"
          placeholder="输入搜索关键词..."
          clearable
          style="margin-bottom: 10px"
        />
        <adv-table
          ref="quickFilterRef"
          mode="default"
          :data="filterSortData"
          :columns="filterSortColumns"
          :quick-filter="quickFilterText"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="filterSortData"
          :columns="filterSortColumns"
          :quick-filter="quickFilterText"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
