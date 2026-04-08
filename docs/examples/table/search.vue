<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ElMessage } from 'element-plus'
import { ref } from 'vue'

interface Row {
  id: number
  name: string
  status: 'enabled' | 'disabled'
  amount: number
}

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '姓名', width: 140, search: true },
  {
    prop: 'status',
    label: '状态',
    width: 120,
    search: true,
    valueEnum: { enabled: { text: '启用' }, disabled: { text: '禁用' } },
  },
  { prop: 'amount', label: '金额', width: 140, valueType: 'money', search: true },
]

const data = ref<Row[]>(
  Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    status: i % 3 === 0 ? 'disabled' : 'enabled',
    amount: (i + 1) * 99,
  })),
)

// 搜索字段来自列上的 `search: true`；额外字段用 fields 补充，type 取内置组件名（input/select/datePicker/switch/number）
const search = {
  enabled: true,
  labelWidth: 'auto',
  collapsed: true,
  fields: [
    { prop: 'createdAt', label: '创建日期', type: 'datePicker', componentProps: { type: 'daterange', valueFormat: 'YYYY-MM-DD' } },
  ],
}

function onQuery(params: Record<string, unknown>) {
  ElMessage.info(`查询参数：${JSON.stringify(params)}`)
}
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :search="search"
    :ui-config="{ tableId: 'demo-search' }"
    @query="onQuery"
  />
</template>
