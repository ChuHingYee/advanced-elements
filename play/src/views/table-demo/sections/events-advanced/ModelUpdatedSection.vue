<!-- <zh/> 10.11 modelUpdated 事件 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 10.11 modelUpdated 事件 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { editColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { editData, modelUpdatedCount, modelUpdatedRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>10.11 modelUpdated 事件</h1>
    <p>监听数据模型更新事件。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="modelUpdatedRef"
          mode="default"
          :data="editData"
          :columns="editColumns"
          :edit-config="{}"
          height="400px"
          @model-updated="() => modelUpdatedCount++"
        />
        <div style="margin-top: 10px">
          更新次数: {{ modelUpdatedCount }}
        </div>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="editData"
          :columns="editColumns"
          :edit-config="{}"
          height="400px"
          @model-updated="() => modelUpdatedCount++"
        />
      </div>
    </div>
  </div>
</template>
