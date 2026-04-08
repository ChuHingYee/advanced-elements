<!-- <zh/> 10.9 自定义格式映射 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 10.9 自定义格式映射 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { formatMapsRef, formatMapsV2Ref, mockCustomFormatRequest } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>10.9 自定义格式映射</h1>
    <p>使用 formatMaps 自定义响应数据的字段映射（如将 <code>items</code> 映射为 <code>data</code>，<code>totalCount</code> 映射为 <code>total</code>）。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="formatMapsRef"
          mode="default"
          :columns="allValueTypeColumns.slice(0, 6)"
          :request="{ source: mockCustomFormatRequest, formatMaps: { data: 'items', total: 'totalCount' } }"
          :pagination="{ pageSize: 10 }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          ref="formatMapsV2Ref"
          mode="virtual"
          :columns="allValueTypeColumns.slice(0, 6)"
          :request="{ source: mockCustomFormatRequest, formatMaps: { data: 'items', total: 'totalCount' } }"
          :pagination="{ pageSize: 10 }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
