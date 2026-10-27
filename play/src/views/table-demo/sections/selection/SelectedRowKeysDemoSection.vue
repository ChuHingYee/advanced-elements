<!-- <zh/> 2.7 受控选中(selectedRowKeys) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 2.7 受控选中(selectedRowKeys) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElButton } from 'element-plus'
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'
import { selectViaApi } from '../../helpers'

const { basicData, selectedRowKeysRef, selectedRowKeysV2Ref, selectedRowKeysValue } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>2.7 受控选中 (selectedRowKeys)</h1>
    <p>通过 <code>selectedRowKeys</code> prop 受控管理选中行，适合需要从外部（如 URL、父组件）初始化选中状态的场景。<br>注意：行 id 5、8 已通过 <code>selectableFn</code> 设为不可选（disabled），设置选中时会自动过滤。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <div style="margin-bottom: 10px">
          <ElButton @click="selectedRowKeysValue = ['1', '3', '5']">
            受控选中 1,3,5
          </ElButton>
          <ElButton @click="selectedRowKeysValue = []">
            清空
          </ElButton>
          <ElButton @click="selectedRowKeysValue = ['2', '4', '6', '8']">
            受控选中 2,4,6,8
          </ElButton>
          <ElButton
            type="primary"
            @click="selectViaApi(selectedRowKeysRef, ['1', '3', '5'])"
          >
            API 选中 1,3,5
          </ElButton>
          <ElButton
            type="primary"
            @click="selectViaApi(selectedRowKeysRef, ['2', '4', '6', '8'])"
          >
            API 选中 2,4,6,8
          </ElButton>
        </div>
        <adv-table
          ref="selectedRowKeysRef"
          mode="default"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          :selected-row-keys="selectedRowKeysValue"
          :row-config="{ rowKey: 'id', rowSelection: 'multiple' }"
          height="400px"
        />
        <div style="margin-top: 10px; font-size: 12px; color: #606266">
          当前选中 keys: {{ selectedRowKeysValue.join(', ') || '无' }}<br>
          <span style="color: #909399">提示：行 5、8 为 disabled，受控设置时自动过滤不选中</span>
        </div>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <div style="margin-bottom: 10px">
          <ElButton
            type="primary"
            @click="selectViaApi(selectedRowKeysV2Ref, ['1', '3', '5'])"
          >
            API 选中 1,3,5
          </ElButton>
          <ElButton
            type="primary"
            @click="selectViaApi(selectedRowKeysV2Ref, ['2', '4', '6', '8'])"
          >
            API 选中 2,4,6,8
          </ElButton>
        </div>
        <adv-table
          ref="selectedRowKeysV2Ref"
          mode="virtual"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          :selected-row-keys="selectedRowKeysValue"
          :row-config="{ rowKey: 'id', rowSelection: 'multiple' }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
