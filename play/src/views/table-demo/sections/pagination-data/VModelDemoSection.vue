<!-- <zh/> 3.7 v-model双向绑定 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 3.7 v-model双向绑定 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElButton } from 'element-plus'
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { vModelData, vModelDataV2, vModelRef, vModelV2Ref } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>3.7 v-model 双向绑定</h1>
    <p>支持 v-model 双向绑定数据：下方按钮经 <code>applyTransaction</code> 写入表格，绑定数组同步更新（见 JSON 回显）。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="vModelRef"
          v-model:data="vModelData"
          mode="default"
          :columns="allValueTypeColumns.slice(0, 6)"
          height="400px"
        />
        <div style="margin-top:8px;display:flex;gap:6px;align-items:center">
          <ElButton
            size="small"
            @click="vModelRef?.applyTransaction?.({ add: [{ id: `v-${Date.now()}`, name: '新增', age: 20 }] })"
          >
            添加一行
          </ElButton>
          <span style="font-size:12px;color:#606266">已绑定 {{ vModelData.length }} 条</span>
        </div>
        <pre style="font-size:11px;max-height:90px;overflow:auto">{{ JSON.stringify(vModelData.slice(0, 2)) }}</pre>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          ref="vModelV2Ref"
          v-model:data="vModelDataV2"
          mode="virtual"
          :columns="allValueTypeColumns.slice(0, 6)"
          height="400px"
        />
        <div style="margin-top:8px;display:flex;gap:6px;align-items:center">
          <ElButton
            size="small"
            @click="vModelV2Ref?.applyTransaction?.({ add: [{ id: `v2-${Date.now()}`, name: '新增', age: 20 }] })"
          >
            添加一行
          </ElButton>
          <span style="font-size:12px;color:#606266">已绑定 {{ vModelDataV2.length }} 条</span>
        </div>
        <pre style="font-size:11px;max-height:90px;overflow:auto">{{ JSON.stringify(vModelDataV2.slice(0, 2)) }}</pre>
      </div>
    </div>
  </div>
</template>
