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
  { prop: 'name', label: '姓名', width: 140, editable: true, cellEditor: 'text' },
  {
    prop: 'department',
    label: '部门',
    width: 140,
    editable: true,
    cellEditor: 'select',
    cellEditorParams: {
      options: [
        { label: '技术部', value: '技术部' },
        { label: '市场部', value: '市场部' },
        { label: '财务部', value: '财务部' },
      ],
    },
  },
  { prop: 'amount', label: '金额', width: 140, editable: true, cellEditor: 'number', cellEditorParams: { min: 0 } },
]

const data = ref<Row[]>([
  { id: 1, name: '张三', department: '技术部', amount: 1200 },
  { id: 2, name: '李四', department: '市场部', amount: 2400 },
  { id: 3, name: '王五', department: '财务部', amount: 3600 },
])

function onFullRowEdit(payload: { row: Row, changes: { prop: string, oldValue: unknown, newValue: unknown }[] }) {
  const summary = payload.changes
    .map(change => `${change.prop}: ${change.oldValue} → ${change.newValue}`)
    .join('；')
  ElMessage.success(`${payload.row.name} 本次提交：${summary}`)
}
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :edit-config="{ editType: 'fullRow', singleClickEdit: true }"
    :ui-config="{ tableId: 'demo-full-row-editing' }"
    @full-row-edit="onFullRowEdit"
  />
</template>
