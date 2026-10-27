<!-- <zh/> 9.1 树形数据(treeConfig) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 9.1 树形数据(treeConfig) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { treeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { treeConfigExpandAll, treeData, treeRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>9.1 树形数据 (treeConfig)</h1>
    <p>展示树形层级数据。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="treeRef"
          mode="default"
          :data="treeData"
          :columns="treeColumns"
          :tree-config="treeConfigExpandAll"
          :row-config="{ rowKey: 'id' }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="treeData"
          :columns="treeColumns"
          :tree-config="treeConfigExpandAll"
          :row-config="{ rowKey: 'id' }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
