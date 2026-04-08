<!-- <zh/> 2.6 单选高亮 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 2.6 单选高亮 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { highlightColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { basicData, highlightCurrentRow, highlightCurrentRowV2 } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>2.6 单选高亮</h1>
    <p>点击行高亮显示当前选中行。Default 模式下高亮始终启用（renderer 内置），Virtual 模式暂不支持。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="basicData"
          :columns="highlightColumns"
          height="400px"
          @current-change="(payload: any) => highlightCurrentRow = payload.currentRow"
        />
        <div
          v-if="highlightCurrentRow"
          style="margin-top: 10px"
        >
          当前选中: {{ highlightCurrentRow.name }}
        </div>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="basicData"
          :columns="highlightColumns"
          height="400px"
          @current-change="(payload: any) => highlightCurrentRowV2 = payload.currentRow"
        />
        <div
          v-if="highlightCurrentRowV2"
          style="margin-top: 10px"
        >
          当前选中: {{ highlightCurrentRowV2.name }}
        </div>
      </div>
    </div>
  </div>
</template>
