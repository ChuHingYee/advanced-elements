<!-- <zh/> 1.3 多级表头 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 1.3 多级表头 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { groupColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { groupData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>1.3 多级表头</h1>
    <p>支持多级表头分组。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="groupData"
          :columns="groupColumns"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="groupData"
          :columns="groupColumns"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
