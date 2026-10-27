<!-- <zh/> 6.17 P2功能增强(undo/guard) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 6.17 P2功能增强(undo/guard) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElButton } from 'element-plus'
import { editColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { p2CheckUnsaved, p2EnhancedData, p2Redo, p2TableRef, p2TableV2Ref, p2Undo } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>6.17 P2 功能增强 (undo/guard)</h1>
    <p>撤销/重做、编辑守卫功能。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <div style="margin-bottom: 10px">
          <ElButton @click="p2Undo">
            撤销
          </ElButton>
          <ElButton @click="p2Redo">
            重做
          </ElButton>
          <ElButton @click="p2CheckUnsaved">
            检查未保存
          </ElButton>
        </div>
        <adv-table
          ref="p2TableRef"
          mode="default"
          :data="p2EnhancedData"
          :columns="editColumns"
          :edit-config="{}"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          ref="p2TableV2Ref"
          mode="virtual"
          :data="p2EnhancedData"
          :columns="editColumns"
          :edit-config="{}"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
