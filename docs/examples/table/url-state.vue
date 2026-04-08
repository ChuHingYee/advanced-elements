<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'

interface Row {
  id: number
  name: string
  department: string
  amount: number
}

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '姓名', width: 140 },
  { prop: 'department', label: '部门', width: 140 },
  { prop: 'amount', label: '金额', width: 140, valueType: 'money', aggFunc: 'sum' },
]

const ALL: Row[] = Array.from({ length: 43 }, (_, i) => ({
  id: i + 1,
  name: `用户${i + 1}`,
  department: ['技术部', '市场部', '财务部'][i % 3]!,
  amount: (i + 1) * 137.5,
}))

// urlState 把分页写进路由 query：刷新页面 / 分享链接都能回到当前页
const urlState = { enabled: true, pageKey: 'p', sizeKey: 's' }

async function fetchPage(params: Record<string, unknown>) {
  await new Promise(resolve => setTimeout(resolve, 200))
  const page = Number(params.page ?? 1)
  const size = Number(params.size ?? 10)
  const start = (page - 1) * size
  return { data: ALL.slice(start, start + size), total: ALL.length }
}
</script>

<template>
  <AdvTable
    :columns="columns"
    :request="{ source: fetchPage }"
    :row-config="{ rowKey: 'id' }"
    :url-state="urlState"
    :pagination="{ enabled: true, pageSize: 10, pageSizes: [10, 20, 50] }"
    :ui-config="{ tableId: 'demo-url-state' }"
  />
</template>
