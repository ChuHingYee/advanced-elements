<!-- <zh/> 11.15 布局算法(tableLayout) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 11.15 布局算法(tableLayout) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElRadio, ElRadioGroup } from 'element-plus'
import { useDemoContext } from '../../demo-context'

const { surfaceCols, surfaceData, tableLayoutDemoValue } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>11.15 布局算法 (tableLayout)</h1>
    <p><code>table-layout="fixed"</code>（默认）列宽由表格宽度决定；<code>auto</code> 列宽由内容决定。Virtual 模式下 ElTableV2 始终为 fixed 布局，此 demo 主要展示 Default 模式差异，Virtual 侧作为对照。</p>
    <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px">
      <span style="font-size: 13px; color: #606266">布局算法：</span>
      <ElRadioGroup
        v-model="tableLayoutDemoValue"
        size="small"
      >
        <ElRadio value="fixed">
          fixed
        </ElRadio>
        <ElRadio value="auto">
          auto
        </ElRadio>
      </ElRadioGroup>
      <span style="font-size: 12px; color: #909399">当前：tableLayout="{{ tableLayoutDemoValue }}"（fixed 列宽固定，auto 按内容自适应；可观察列宽是否随内容拉伸）</span>
    </div>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default · {{ tableLayoutDemoValue }}</h4>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          :table-layout="tableLayoutDemoValue"
          height="300px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual · {{ tableLayoutDemoValue }}（对照）</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          :table-layout="tableLayoutDemoValue"
          height="300px"
        />
      </div>
    </div>
  </div>
</template>
