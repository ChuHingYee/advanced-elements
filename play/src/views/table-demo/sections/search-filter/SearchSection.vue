<!-- <zh/> 4.1 自定义搜索 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 4.1 自定义搜索 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { filterSortColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'
import { customComponents, customSearchFields } from '../../helpers'

const { filterSortData, searchCustomRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>4.1 自定义搜索</h1>
    <p>自定义搜索字段和布局。搜索栏仅在 <code>search.enabled</code> 为 true（或列配置含 <code>search</code>）时渲染，此处显式开启。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="searchCustomRef"
          mode="default"
          :data="filterSortData"
          :columns="filterSortColumns"
          :search="{ enabled: true, fields: customSearchFields, components: customComponents }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="filterSortData"
          :columns="filterSortColumns"
          :search="{ enabled: true, fields: customSearchFields, components: customComponents }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
