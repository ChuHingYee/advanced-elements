<!-- <zh/> 4.7 搜索值响应式 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 4.7 搜索值响应式 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { searchValuesColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { filterSortData, searchValuesModel, searchValuesRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>4.7 搜索值响应式</h1>
    <p>搜索值双向绑定。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="searchValuesRef"
          v-model:search-values="searchValuesModel"
          mode="default"
          :data="filterSortData"
          :columns="searchValuesColumns"
          height="400px"
        />
        <div style="margin-top: 10px">
          当前搜索值: {{ JSON.stringify(searchValuesModel) }}
        </div>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          v-model:search-values="searchValuesModel"
          mode="virtual"
          :data="filterSortData"
          :columns="searchValuesColumns"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
