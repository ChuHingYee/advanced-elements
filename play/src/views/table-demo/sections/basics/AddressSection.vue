<!-- <zh/> 1.4 三层嵌套+固定列 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 1.4 三层嵌套+固定列 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { addressColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { addressData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>1.4 三层嵌套+固定列</h1>
    <p>三层多级表头 + 右侧固定列（操作列双模式一致渲染）。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="addressData"
          :columns="addressColumns"
          :pagination="{ pageSize: 20, pageSizes: [10, 20, 50, 100] }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="addressData"
          :columns="addressColumns"
          :pagination="{ pageSize: 20, pageSizes: [10, 20, 50, 100] }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
