<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ElMessage } from 'element-plus'
import { ref } from 'vue'

interface Row {
  id: number
  name: string
  age: number
  gender: 'M' | 'F'
  email: string
}

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '姓名', width: 140, editable: true, cellEditor: 'text' },
  { prop: 'age', label: '年龄', width: 110, editable: true, cellEditor: 'number', cellEditorParams: { min: 0, max: 150 } },
  {
    prop: 'gender',
    label: '性别',
    width: 110,
    editable: true,
    cellEditor: 'select',
    cellEditorParams: { options: [{ label: '男', value: 'M' }, { label: '女', value: 'F' }] },
  },
  { prop: 'email', label: '邮箱', minWidth: 220, editable: true, cellEditor: 'text' },
]

const data = ref<Row[]>([
  { id: 1, name: '张三', age: 28, gender: 'M', email: 'zhangsan@example.com' },
  { id: 2, name: '李四', age: 32, gender: 'F', email: 'lisi@example.com' },
  { id: 3, name: '王五', age: 26, gender: 'M', email: 'wangwu@example.com' },
])

function onCellValueChanged(payload: { row: Row, prop: string, oldValue: unknown, newValue: unknown }) {
  ElMessage.success(`${payload.prop}：${payload.oldValue} → ${payload.newValue}`)
}
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :edit-config="{ stopEditingWhenCellsLoseFocus: true }"
    :ui-config="{ tableId: 'demo-cell-editing' }"
    @cell-value-changed="onCellValueChanged"
  />
</template>
