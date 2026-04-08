<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'

interface Row {
  id: number
  name: string
  amount: number
  createTime: string
  status: string
}

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '姓名', type: 'nameCol' },
  { prop: 'amount', label: '金额', type: 'moneyCol' },
  { prop: 'createTime', label: '创建时间', type: 'dateCol' },
  { prop: 'status', label: '状态', type: 'statusCol', valueEnum: { 1: '启用', 0: '禁用' } },
]

// 合并顺序：defaultColDef → columnTypes[type] → 列自身定义
const columnConfig = {
  defaultColDef: { resizable: true, minWidth: 80 },
  columnTypes: {
    nameCol: { width: 140 },
    moneyCol: { valueType: 'money', align: 'right', sortable: true },
    dateCol: { valueType: 'date', width: 160 },
    statusCol: { valueType: 'select', width: 110, align: 'center' },
  },
}

const data: Row[] = [
  { id: 1, name: '张三', amount: 1200, createTime: '2026-01-12', status: '1' },
  { id: 2, name: '李四', amount: 2400, createTime: '2026-02-03', status: '0' },
  { id: 3, name: '王五', amount: 3600, createTime: '2026-03-18', status: '1' },
]
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :column-config="columnConfig"
    :ui-config="{ tableId: 'demo-column-types' }"
  />
</template>
