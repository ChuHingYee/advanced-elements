<!-- <zh/> 11.6 筛选配置(filterConfig) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 11.6 筛选配置(filterConfig) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElInput } from 'element-plus'
import { filterSortColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { filterSortData, quickFilterText } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>11.6 筛选配置 (filterConfig)</h1>
    <p><code>filterConfig</code> 控制列头筛选行为：<code>floatingFilter</code> 浮动筛选、<code>quickFilterDebounce</code> 全局搜索防抖、<code>quickFilterCacheSize</code> 文本缓存上限、侧边筛选面板等。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default · floatingFilter + quickFilterDebounce=500</h4>
        <ElInput
          v-model="quickFilterText"
          placeholder="全局搜索（500ms 防抖）"
          clearable
          style="margin-bottom:8px"
        />
        <adv-table
          mode="default"
          :data="filterSortData"
          :columns="filterSortColumns"
          :filter-config="{ floatingFilter: true, quickFilterDebounce: 500, quickFilterCacheSize: 3000 }"
          :quick-filter="quickFilterText"
          height="360px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual · floatingFilter + quickFilterDebounce=100</h4>
        <ElInput
          v-model="quickFilterText"
          placeholder="全局搜索（100ms 防抖）"
          clearable
          style="margin-bottom:8px"
        />
        <adv-table
          mode="virtual"
          :data="filterSortData"
          :columns="filterSortColumns"
          :filter-config="{ floatingFilter: true, quickFilterDebounce: 100, quickFilterCacheSize: 5000 }"
          :quick-filter="quickFilterText"
          height="360px"
        />
      </div>
    </div>
  </div>
</template>
