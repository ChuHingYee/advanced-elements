<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ElMessage } from 'element-plus'

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

const data: Row[] = [
  { id: 1, name: '张三', department: '技术部', amount: 1200 },
  { id: 2, name: '李四', department: '技术部', amount: 2400 },
  { id: 3, name: '王五', department: '市场部', amount: 800 },
  { id: 4, name: '赵六', department: '市场部', amount: 1600 },
  { id: 5, name: '钱七', department: '财务部', amount: 3000 },
]

function onCellRangeSelected(selection: { range: { startRow: number, endRow: number, startCol: number, endCol: number }, rows: Row[], tsv: string }) {
  const { startRow, endRow } = selection.range
  ElMessage.info(`已选 R${startRow + 1}:R${endRow + 1}（${selection.rows.length} 行）`)
}
</script>

<template>
  <!-- 鼠标按住拖选一片单元格，松开即选中（Excel 风格） -->
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :range-selection="{ enabled: true }"
    :ui-config="{ tableId: 'demo-range-selection' }"
    @cell-range-selected="onCellRangeSelected"
  />
</template>
