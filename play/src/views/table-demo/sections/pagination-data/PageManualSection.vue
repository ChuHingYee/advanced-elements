<!-- <zh/> 3.3 手动分页 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 3.3 手动分页 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { manualRows, manualRowsV2, onManualPageChange, pageManualRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>3.3 手动分页</h1>
    <p>手动控制分页逻辑：配置 <code>pagination.mode: 'manual'</code> 后底栏变为“加载更多”按钮，点击触发 <code>page-change</code> 事件，由父组件追加数据（表格不再自动切片/请求）。需同时传入 <code>total</code> 以便计算是否还有更多。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="pageManualRef"
          mode="default"
          :data="manualRows"
          :columns="allValueTypeColumns.slice(0, 6)"
          :pagination="{ mode: 'manual', pageSize: 10, total: 60 }"
          height="400px"
          @page-change="(page: number, size: number) => onManualPageChange('default', page, size)"
        />
        <p style="font-size:12px;color:#606266">
          已加载 {{ manualRows.length }} / 60 条
        </p>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="manualRowsV2"
          :columns="allValueTypeColumns.slice(0, 6)"
          :pagination="{ mode: 'manual', pageSize: 10, total: 60 }"
          height="400px"
          @page-change="(page: number, size: number) => onManualPageChange('virtual', page, size)"
        />
        <p style="font-size:12px;color:#606266">
          已加载 {{ manualRowsV2.length }} / 60 条
        </p>
      </div>
    </div>
  </div>
</template>
