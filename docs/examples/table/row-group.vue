<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ref } from 'vue'

interface Row {
  id: number
  name: string
  department: string
  amount: number
}

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '姓名', width: 140 },
  { prop: 'department', label: '部门', width: 140 },
  { prop: 'amount', label: '金额', width: 140, valueType: 'money', aggFunc: 'sum' },
]

const data = ref<Row[]>([
  { id: 1, name: '张三', department: '技术部', amount: 1200 },
  { id: 2, name: '李四', department: '技术部', amount: 2400 },
  { id: 3, name: '王五', department: '市场部', amount: 800 },
  { id: 4, name: '赵六', department: '市场部', amount: 1600 },
  { id: 5, name: '钱七', department: '财务部', amount: 3000 },
])

// 展开/收起由分组行自带的箭头负责；插槽只负责分组头的展示内容（value / count / expanded / toggle）
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :row-group-config="{ field: 'department', defaultExpandAll: true }"
    :ui-config="{ tableId: 'demo-row-group' }"
  >
    <template #group-header="{ value, count }">
      <el-tag
        size="small"
        type="primary"
      >
        {{ value }}
      </el-tag>
      <span style="margin-left: 8px; color: var(--el-text-color-secondary)">（{{ count }} 人）</span>
    </template>
  </AdvTable>
</template>
