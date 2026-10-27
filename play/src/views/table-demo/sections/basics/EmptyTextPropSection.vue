<!-- <zh/> 1.6b 空数据提示（emptyText prop 形态）——自 TableDemo.vue 原样迁出 | <en/> 1.6b empty state (emptyText prop) — migrated verbatim from TableDemo.vue -->
<script setup lang="ts">
import { allValueTypeColumns } from '../../columns'
</script>

<template>
  <div class="demo-section">
    <h1>1.6b 空数据提示 (emptyText prop)</h1>
    <p>使用 <code>emptyText</code> prop 设置空数据文本，比 slot 更轻量。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="[]"
          :columns="allValueTypeColumns.slice(0, 5)"
          empty-text="暂无员工数据，请先添加"
          height="300px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="[]"
          :columns="allValueTypeColumns.slice(0, 5)"
          empty-text="暂无员工数据，请先添加"
          height="300px"
        />
      </div>
    </div>
  </div>
</template>
