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
  // editable 为 true 但 editType: 'readOnly' 时，编辑器只读：适合"可点开看、不可改"的详情格
  { prop: 'name', label: '姓名', width: 160, editable: true, cellEditor: 'text' },
  { prop: 'department', label: '部门', width: 160, editable: true, cellEditor: 'text' },
  { prop: 'amount', label: '金额', width: 160, valueType: 'money', editable: true, cellEditor: 'number' },
]

const data = ref<Row[]>(
  Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    department: ['技术部', '市场部', '财务部'][i % 3]!,
    amount: (i + 1) * 137.5,
  })),
)
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :edit-config="{ editType: 'readOnly', singleClickEdit: true }"
    :ui-config="{ tableId: 'demo-readonly-editing' }"
  />
</template>
