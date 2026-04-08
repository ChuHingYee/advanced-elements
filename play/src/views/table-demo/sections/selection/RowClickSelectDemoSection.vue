<!-- <zh/> 2.4 行点击选择(rowClickSelect) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 2.4 行点击选择(rowClickSelect) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { basicData, rowClickSelectFalseRef, rowClickSelectTrueRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>2.4 行点击选择 (rowClickSelect)</h1>
    <p>点击行即可选中。通过 <code>:row-config="{ rowClickSelect: true }"</code> 启用，默认即为 true。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式 - 单选</h4>
        <adv-table
          ref="rowClickSelectTrueRef"
          mode="default"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          :row-config="{ rowSelection: 'single', rowClickSelect: true }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式 - 单选</h4>
        <adv-table
          ref="rowClickSelectFalseRef"
          mode="virtual"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          :row-config="{ rowSelection: 'single', rowClickSelect: true }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
