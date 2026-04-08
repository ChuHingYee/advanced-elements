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
  { prop: 'amount', label: '金额', width: 140, valueType: 'money' },
]

const data = ref<Row[]>(
  Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    department: ['技术部', '市场部', '财务部'][i % 3]!,
    amount: (i + 1) * 137.5,
  })),
)

// spanMethod 优先于 spanConfig；返回 undefined 时回退到内部自动合并
function spanMethod({ rowIndex, columnIndex }: { rowIndex: number, columnIndex: number }) {
  if (columnIndex === 0 && rowIndex % 4 === 0)
    return { rowspan: 2, colspan: 1 }
  return undefined
}
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :span-method="spanMethod"
    :ui-config="{ tableId: 'demo-span-method' }"
  />
</template>
