<!-- <zh/> 6.16 多选编辑器 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 6.16 多选编辑器 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { multiSelectColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { multiSelectData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>6.16 多选编辑器</h1>
    <p>支持多选下拉编辑器。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="multiSelectData"
          :columns="multiSelectColumns"
          :edit-config="{}"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="multiSelectData"
          :columns="multiSelectColumns"
          :edit-config="{}"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
