<!-- <zh/> 6.6 动态编辑器参数 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 6.6 动态编辑器参数 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { dynamicParamsColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { dynamicParamsData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>6.6 动态编辑器参数</h1>
    <p>根据行数据动态配置编辑器参数。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          v-model:data="dynamicParamsData"
          mode="default"
          :columns="dynamicParamsColumns"
          :edit-config="{}"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          :data="dynamicParamsData"
          mode="virtual"
          :columns="dynamicParamsColumns"
          :edit-config="{}"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
