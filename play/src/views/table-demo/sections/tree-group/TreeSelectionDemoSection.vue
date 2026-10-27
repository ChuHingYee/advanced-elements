<!-- <zh/> 9.2 树形选择 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 9.2 树形选择 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElCheckbox } from 'element-plus'
import { treeSelectionColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { treeData, treeSelectionConfig, treeSelectionRef, treeSelectionSelectedKeys, treeSelectionStrictly } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>9.2 树形选择</h1>
    <p>树形数据的选择联动。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <div style="margin-bottom: 10px">
          <ElCheckbox v-model="treeSelectionStrictly">
            父子不联动
          </ElCheckbox>
        </div>
        <adv-table
          ref="treeSelectionRef"
          mode="default"
          :data="treeData"
          :columns="treeSelectionColumns"
          :tree-config="treeSelectionConfig"
          :row-config="{ rowKey: 'id', rowSelection: 'multiple' }"
          height="400px"
        />
        <div style="margin-top: 10px">
          选中 keys: {{ treeSelectionSelectedKeys.join(', ') || '无' }}
        </div>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="treeData"
          :columns="treeSelectionColumns"
          :tree-config="treeSelectionConfig"
          :row-config="{ rowKey: 'id', rowSelection: 'multiple' }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
