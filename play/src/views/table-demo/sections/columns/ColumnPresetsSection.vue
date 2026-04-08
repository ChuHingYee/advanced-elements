<!-- <zh/> 8.6 内置列类型预设 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 8.6 内置列类型预设 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { presetColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { basicData, columnPresetsRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>8.6 内置列类型预设</h1>
    <p>使用内置列类型快速配置。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="columnPresetsRef"
          mode="default"
          :data="basicData"
          :columns="presetColumns"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="basicData"
          :columns="presetColumns"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
