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
  { prop: 'department', label: '部门', width: 120 },
  { prop: 'amount', label: '金额', width: 140, valueType: 'money', sortable: true },
  { prop: 'createTime', label: '创建时间', minWidth: 180, sortable: true },
]

const data = ref<Row[]>(
  Array.from({ length: 46 }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    department: ['技术部', '市场部', '财务部'][i % 3]!,
    amount: (i + 1) * 137.5,
    createTime: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
  })),
)
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :ui-config="{ tableId: 'demo-pagination' }"
    :pagination="{
      enabled: true,
      mode: 'client',
      pageSize: 10,
      pageSizes: [10, 20, 50],
      layout: 'total, sizes, prev, pager, next, jumper',
    }"
  />
</template>
