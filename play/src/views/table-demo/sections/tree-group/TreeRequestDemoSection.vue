<!-- <zh/> 9.6 树形数据(request数据源) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 9.6 树形数据(request数据源) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { treeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { mockTreeRequest, treeConfigExpandAll } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>9.6 树形数据 (request 数据源)</h1>
    <p>与 9.1 的对照：数据源不使用 <code>:data</code>，而是通过 <code>:request="{ source: mockTreeRequest }"</code> 请求获取。配合 <code>:pagination="{ enabled: false }"</code> 走 simple 请求模式，一次拉取整棵子树。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :request="{ source: mockTreeRequest }"
          :pagination="{ enabled: false }"
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
          :request="{ source: mockTreeRequest }"
          :pagination="{ enabled: false }"
          :columns="treeColumns"
          :tree-config="treeConfigExpandAll"
          :row-config="{ rowKey: 'id' }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
