<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ElMessage } from 'element-plus'
import { ref } from 'vue'

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
  { prop: 'remark', label: '备注', minWidth: 180 },
]

const data = ref<Row[]>(
  Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    department: ['技术部', '市场部', '财务部'][i % 3]!,
    amount: (i + 1) * 137.5,
    remark: `第 ${i + 1} 行`,
  })),
)

function onColumnMoved(payload: { columns: { label?: string }[] }) {
  ElMessage.info(`当前列顺序：${payload.columns.map(column => column.label).join(' / ')}`)
}
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :column-config="{ columnDraggable: true, sidePanel: true, sidePanelPosition: 'right' }"
    :ui-config="{ tableId: 'demo-column-draggable' }"
    @column-moved="onColumnMoved"
  />
</template>
