<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ref } from 'vue'

interface Row {
  id: number
  name: string
  department: string
  amount: number
  status: string
}

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '姓名', width: 140, filter: 'text' },
  {
    prop: 'department',
    label: '部门',
    width: 140,
    filter: { type: 'enum', options: [{ label: '技术部', value: '技术部' }, { label: '市场部', value: '市场部' }] },
  },
  { prop: 'amount', label: '金额', width: 140, valueType: 'money', filter: 'number' },
  { prop: 'status', label: '状态', width: 120, valueType: 'select', valueEnum: { ok: { text: '正常' }, ng: { text: '异常' } } },
]

const data = ref<Row[]>(
  Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    department: ['技术部', '市场部', '财务部'][i % 3]!,
    amount: (i + 1) * 137.5,
    status: i % 3 === 0 ? 'ng' : 'ok',
  })),
)
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :filter-config="{
      sidePanel: true,
      sidePanelPosition: 'right',
      sidePanelDefaultOpen: true,
      floatingFilter: true,
    }"
    :ui-config="{ tableId: 'demo-filter-panel' }"
  />
</template>
