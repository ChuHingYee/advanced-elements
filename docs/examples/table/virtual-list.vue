<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'

interface Row {
  id: number
  name: string
  department: string
  amount: number
}

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '姓名', width: 140 },
  { prop: 'department', label: '部门', width: 120 },
  { prop: 'amount', label: '金额', width: 140, valueType: 'money' },
]

// 5 万行：virtual 模式（默认）只渲染可视区，滚动条与数据量无关
const data: Row[] = Array.from({ length: 50000 }, (_, i) => ({
  id: i + 1,
  name: `用户${i + 1}`,
  department: ['技术部', '市场部', '财务部'][i % 3]!,
  amount: (i + 1) * 13.7,
}))
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :height="360"
    :row-config="{ rowKey: 'id' }"
    :ui-config="{ tableId: 'demo-virtual-list' }"
  />
</template>
