<!-- <zh/> 1.2 列类型展示 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 1.2 列类型展示 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { allValueTypeData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>1.2 列类型展示</h1>
    <p>展示所有支持的 valueType 类型。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="allValueTypeData"
          :columns="allValueTypeColumns"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="allValueTypeData"
          :columns="allValueTypeColumns"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
