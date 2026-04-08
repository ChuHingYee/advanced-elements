<!-- <zh/> 3.2 远程分页 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 3.2 远程分页 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { mockPaginatedRequest, pageData100, pageRemoteRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>3.2 远程分页</h1>
    <p>分页由后端处理，适合大数据量场景。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="pageRemoteRef"
          mode="default"
          :data="pageData100"
          :columns="allValueTypeColumns.slice(0, 6)"
          :pagination="{ pageSize: 10, total: 100 }"
          :request="{ source: mockPaginatedRequest }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="pageData100"
          :columns="allValueTypeColumns.slice(0, 6)"
          :pagination="{ pageSize: 10, total: 100 }"
          :request="{ source: mockPaginatedRequest }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
