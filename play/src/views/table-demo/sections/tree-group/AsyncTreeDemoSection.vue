<!-- <zh/> 9.3 异步树形数据(loadData) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 9.3 异步树形数据(loadData) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { treeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { asyncTreeData, loadTreeData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>9.3 异步树形数据 (loadData)</h1>
    <p>演示异步加载子节点数据。展开节点时动态加载子级数据。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="asyncTreeData"
          :columns="treeColumns"
          :tree-config="{ children: 'children', defaultExpandAll: false, loadData: loadTreeData }"
          :row-config="{ rowKey: 'id' }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="asyncTreeData"
          :columns="treeColumns"
          :tree-config="{ children: 'children', defaultExpandAll: false, loadData: loadTreeData }"
          :row-config="{ rowKey: 'id' }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
