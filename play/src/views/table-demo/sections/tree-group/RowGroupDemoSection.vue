<!-- <zh/> 9.4 行分组(rowGroupConfig) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 9.4 行分组(rowGroupConfig) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElCheckbox, ElOption, ElSelect } from 'element-plus'
import { rowGroupColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { rowGroupConfig, rowGroupData, rowGroupDefaultExpandAll, rowGroupField, rowGroupRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>9.4 行分组 (rowGroupConfig)</h1>
    <p>按字段分组显示数据。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <div style="margin-bottom: 10px">
          分组字段:
          <ElSelect
            v-model="rowGroupField"
            size="small"
            style="width: 120px"
          >
            <ElOption
              label="部门"
              value="department"
            />
            <ElOption
              label="角色"
              value="role"
            />
            <ElOption
              label="城市"
              value="city"
            />
          </ElSelect>
          <ElCheckbox
            v-model="rowGroupDefaultExpandAll"
            style="margin-left: 10px"
          >
            默认展开
          </ElCheckbox>
        </div>
        <adv-table
          ref="rowGroupRef"
          mode="default"
          :data="rowGroupData"
          :columns="rowGroupColumns"
          :row-group-config="rowGroupConfig"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="rowGroupData"
          :columns="rowGroupColumns"
          :row-group-config="rowGroupConfig"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
