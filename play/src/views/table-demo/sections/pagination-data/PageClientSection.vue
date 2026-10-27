<!-- <zh/> 3.1 客户端分页 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 3.1 客户端分页 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { pageClientRef, pageClientV2Ref, pageData60 } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>3.1 客户端分页</h1>
    <p>数据在客户端进行分页处理。需显式配置 <code>pagination.mode: 'client'</code>（默认 <code>'page'</code> 为服务端分页语义，本地数据不会切片）。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="pageClientRef"
          mode="default"
          :data="pageData60"
          :columns="allValueTypeColumns.slice(0, 6)"
          :pagination="{ mode: 'client', pageSize: 10, pageSizes: [5, 10, 20] }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          ref="pageClientV2Ref"
          mode="virtual"
          :data="pageData60"
          :columns="allValueTypeColumns.slice(0, 6)"
          :pagination="{ mode: 'client', pageSize: 10, pageSizes: [5, 10, 20] }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
