<!-- <zh/> 11.14 表格尺寸(size) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 11.14 表格尺寸(size) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElOption, ElSelect } from 'element-plus'
import { useDemoContext } from '../../demo-context'

const { sizeDemoValue, surfaceCols, surfaceData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>11.14 表格尺寸 (size)</h1>
    <p><code>size="small"</code> / <code>default</code> / <code>large</code> 透传给 ElTable 的 size prop，Virtual 模式下通过 mergedSizeConfig 影响 rowHeight/header 高度。下方选择器实时切换。</p>
    <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px">
      <span style="font-size: 13px; color: #606266">表格尺寸：</span>
      <ElSelect
        v-model="sizeDemoValue"
        size="small"
        style="width: 140px"
      >
        <ElOption
          label="Large"
          value="large"
        />
        <ElOption
          label="Default"
          value="default"
        />
        <ElOption
          label="Small"
          value="small"
        />
      </ElSelect>
      <span style="font-size: 12px; color: #909399">当前：size="{{ sizeDemoValue }}"（观察行高/表头高度/内边距变化）</span>
    </div>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default · {{ sizeDemoValue }}</h4>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          :size="sizeDemoValue"
          height="300px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual · {{ sizeDemoValue }}</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          :size="sizeDemoValue"
          height="300px"
        />
      </div>
    </div>
  </div>
</template>
