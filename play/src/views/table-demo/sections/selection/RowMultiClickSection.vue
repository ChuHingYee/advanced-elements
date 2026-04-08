<!-- <zh/> 2.3 单击多选(AG Grid兼容) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 2.3 单击多选(AG Grid兼容) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { basicData, selMultiClickDefaultRef, selMultiClickVirtualRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>2.3 单击多选 (AG Grid 兼容)</h1>
    <p>单击行即可切换选中状态，无需按住 Ctrl。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="selMultiClickDefaultRef"
          mode="default"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          :row-config="{ rowSelection: 'multiple', rowMultiSelectWithClick: true }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          ref="selMultiClickVirtualRef"
          mode="virtual"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          :row-config="{ rowSelection: 'multiple', rowMultiSelectWithClick: true }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
