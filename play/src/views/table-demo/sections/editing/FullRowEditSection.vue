<!-- <zh/> 6.2 全行编辑 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 6.2 全行编辑 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { editColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { editData, fullRowEditRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>6.2 全行编辑</h1>
    <p>整行同时进入编辑模式。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="fullRowEditRef"
          v-model:data="editData"
          mode="default"
          :columns="editColumns"
          :edit-config="{ editType: 'fullRow' }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          :data="editData"
          mode="virtual"
          :columns="editColumns"
          :edit-config="{ editType: 'fullRow' }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
