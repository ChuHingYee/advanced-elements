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
  { prop: 'department', label: '部门', width: 140 },
  { prop: 'amount', label: '金额', width: 140, valueType: 'money' },
]

const data: Row[] = Array.from({ length: 2000 }, (_, i) => ({
  id: i + 1,
  name: `用户${i + 1}`,
  department: ['技术部', '市场部', '财务部'][i % 3]!,
  amount: (i + 1) * 13.7,
}))
</script>

<template>
  <!-- containerHeight + rowHeight 让分页条数随可视高度自动推算：可视区刚好容纳 10 行 -->
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :pagination="{ enabled: true, mode: 'client', autoPageSize: true, containerHeight: 480, rowHeight: 48 }"
    :ui-config="{ tableId: 'demo-virtual-pagination' }"
  />
</template>
