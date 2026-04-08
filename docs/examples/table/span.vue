<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ref } from 'vue'

interface Row {
  id: number
  department: string
  name: string
  amount: number
}

const columns: AdvColumn<Row>[] = [
  { prop: 'department', label: '部门', width: 140 },
  { prop: 'name', label: '姓名', width: 140 },
  { prop: 'amount', label: '金额', width: 140, valueType: 'money' },
]

const data = ref<Row[]>([
  { id: 1, department: '技术部', name: '张三', amount: 1200 },
  { id: 2, department: '技术部', name: '李四', amount: 2400 },
  { id: 3, department: '技术部', name: '王五', amount: 3600 },
  { id: 4, department: '市场部', name: '赵六', amount: 800 },
  { id: 5, department: '市场部', name: '钱七', amount: 1600 },
])

// 扁平简写：{ 部门列: true } 等价于 { rows: { 部门列: true } }，按相邻行同值自动合并
const spanConfig = { rows: { department: true } }
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :span-config="spanConfig"
    :ui-config="{ tableId: 'demo-span' }"
  />
</template>
