<!-- <zh/> 11.5 合成行分页(includeSynthetic) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 11.5 合成行分页(includeSynthetic) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { rowExpandColumns, rowGroupColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { rowExpandConfig, rowExpandData, rowGroupConfig, rowGroupData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>11.5 合成行分页 (pagination.includeSynthetic)</h1>
    <p><code>includeSynthetic</code> 控制合成行（DetailRow/GroupHeader）是否计入分页容量。<code>true</code>（默认）时计入分页，<code>false</code> 时仅数据行计入，合成行在分页后追加。下方用行分组 + 分页对比。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default · includeSynthetic: true（默认）</h4>
        <adv-table
          mode="default"
          :data="rowGroupData"
          :columns="rowGroupColumns"
          :row-group-config="rowGroupConfig"
          :pagination="{ pageSize: 5, includeSynthetic: true }"
          height="360px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual · includeSynthetic: false</h4>
        <adv-table
          mode="virtual"
          :data="rowGroupData"
          :columns="rowGroupColumns"
          :row-group-config="rowGroupConfig"
          :pagination="{ pageSize: 5, includeSynthetic: false }"
          height="360px"
        />
      </div>
    </div>
    <div
      class="dual-mode"
      style="margin-top:16px"
    >
      <div class="mode-panel">
        <h4>Default · 行展开 + includeSynthetic:true</h4>
        <adv-table
          mode="default"
          :data="rowExpandData"
          :columns="rowExpandColumns"
          :row-expand-config="rowExpandConfig"
          :pagination="{ pageSize: 5, includeSynthetic: true }"
          height="320px"
        >
          <template #expandRow="{ row }">
            <div class="surface-expand-content">
              {{ row.orderNo }} 详情
            </div>
          </template>
        </adv-table>
      </div>
      <div class="mode-panel">
        <h4>Virtual · 行展开 + includeSynthetic:false</h4>
        <adv-table
          mode="virtual"
          :data="rowExpandData"
          :columns="rowExpandColumns"
          :row-expand-config="rowExpandConfig"
          :pagination="{ pageSize: 5, includeSynthetic: false }"
          height="320px"
        >
          <template #expandRow="{ row }">
            <div class="surface-expand-content">
              {{ row.orderNo }} 详情
            </div>
          </template>
        </adv-table>
      </div>
    </div>
  </div>
</template>
