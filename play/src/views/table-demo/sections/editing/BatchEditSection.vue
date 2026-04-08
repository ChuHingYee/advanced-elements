<!-- <zh/> 6.3 批量编辑 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 6.3 批量编辑 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { editColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { batchEditData, batchEditRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>6.3 批量编辑</h1>
    <p>选中多行后批量编辑。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="batchEditRef"
          v-model:data="batchEditData"
          mode="default"
          :columns="editColumns"
          :edit-config="{ editType: 'batch' }"
          :row-config="{ rowSelection: 'multiple' }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          :data="batchEditData"
          mode="virtual"
          :columns="editColumns"
          :edit-config="{ editType: 'batch' }"
          :row-config="{ rowSelection: 'multiple' }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
