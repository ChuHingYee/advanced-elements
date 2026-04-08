<!-- <zh/> 10.7b 声明式合并配置(spanConfig) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 10.7b 声明式合并配置(spanConfig) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { mergeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { mergeData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>10.7b 声明式合并配置 (spanConfig)</h1>
    <p>通过表格级 <code>spanConfig</code> prop 统一配置行/列合并规则，支持扁平简写和完整配置两种形式。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式 — 扁平简写</h4>
        <adv-table
          mode="default"
          :data="mergeData"
          :columns="mergeColumns"
          :span-config="{ department: true, team: true, role: true }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式 — 完整配置</h4>
        <adv-table
          mode="virtual"
          :data="mergeData"
          :columns="mergeColumns"
          :span-config="{ rows: { department: true, team: true }, cols: { id: true } }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
