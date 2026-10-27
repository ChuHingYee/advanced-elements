<!-- <zh/> 10.8 行样式 + Tooltip 自定义 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 10.8 行样式 + Tooltip 自定义 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElOption, ElSelect } from 'element-plus'
import { rowClassNameColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'
import { rowClassNameFn } from '../../helpers'

const { rowClassNameData, rowClassNameTooltipEffect } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>10.8 行样式 + Tooltip 自定义</h1>
    <p>自定义行样式和溢出 Tooltip。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <div style="margin-bottom: 10px">
          Tooltip 效果:
          <ElSelect
            v-model="rowClassNameTooltipEffect"
            size="small"
            style="width: 100px"
          >
            <ElOption
              label="Dark"
              value="dark"
            />
            <ElOption
              label="Light"
              value="light"
            />
          </ElSelect>
        </div>
        <adv-table
          mode="default"
          :data="rowClassNameData"
          :columns="rowClassNameColumns"
          :row-class-name="rowClassNameFn"
          :tooltip-effect="rowClassNameTooltipEffect"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <div style="margin-bottom: 10px">
          Tooltip 效果:
          <ElSelect
            v-model="rowClassNameTooltipEffect"
            size="small"
            style="width: 100px"
          >
            <ElOption
              label="Dark"
              value="dark"
            />
            <ElOption
              label="Light"
              value="light"
            />
          </ElSelect>
        </div>
        <adv-table
          mode="virtual"
          :data="rowClassNameData"
          :columns="rowClassNameColumns"
          :row-class-name="rowClassNameFn"
          :tooltip-effect="rowClassNameTooltipEffect"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
