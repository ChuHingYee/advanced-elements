<!-- <zh/> 6.4 只读编辑 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 6.4 只读编辑 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { editColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { editData, readOnlyEditLog, readOnlyEditRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>6.4 只读编辑</h1>
    <p>编辑请求拦截，可审批编辑操作。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="readOnlyEditRef"
          mode="default"
          :data="editData"
          :columns="editColumns"
          :edit-config="{ editType: 'readOnly' }"
          height="400px"
        />
        <div style="margin-top: 10px; font-size: 12px; color: #606266">
          {{ readOnlyEditLog }}
        </div>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="editData"
          :columns="editColumns"
          :edit-config="{ editType: 'readOnly' }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
