<!-- <zh/> 1.6 空数据提示（slot 形态）——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二试点） | <en/> 1.6 empty state (slot) — migrated verbatim from TableDemo.vue (COMPLEXITY-PLAN battle line 2 pilot) -->
<script setup lang="ts">
import { ElEmpty } from 'element-plus'
import { allValueTypeColumns } from '../../columns'
</script>

<template>
  <div class="demo-section">
    <h1>1.6 空数据提示</h1>
    <p>表格无数据时的空状态展示。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="[]"
          :columns="allValueTypeColumns.slice(0, 5)"
          height="300px"
        >
          <template #empty>
            <ElEmpty description="暂无数据" />
          </template>
        </adv-table>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="[]"
          :columns="allValueTypeColumns.slice(0, 5)"
          height="300px"
        >
          <template #empty>
            <ElEmpty description="暂无数据" />
          </template>
        </adv-table>
      </div>
    </div>
  </div>
</template>
