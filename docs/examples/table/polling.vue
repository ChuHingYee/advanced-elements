<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'

interface Row {
  id: number
  name: string
  amount: number
  updatedAt: string
}

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '姓名', width: 140 },
  { prop: 'amount', label: '金额', width: 140, valueType: 'money' },
  { prop: 'updatedAt', label: '更新时间', width: 200 },
]

let seq = 0

async function fetchStatus() {
  await new Promise(resolve => setTimeout(resolve, 300))
  seq += 1
  return {
    data: [
      { id: 1, name: '张三', amount: 1200 + seq * 10, updatedAt: new Date().toLocaleTimeString() },
      { id: 2, name: '李四', amount: 2400 + seq * 10, updatedAt: new Date().toLocaleTimeString() },
    ],
    total: 2,
  }
}
</script>

<template>
  <!-- 点工具栏的轮询按钮开始/暂停；也可以用 pollingOptions 直接默认开启 -->
  <AdvTable
    :columns="columns"
    :request="{ source: fetchStatus }"
    :row-config="{ rowKey: 'id' }"
    :toolbar="{
      pollingBtn: true,
      refreshBtn: true,
      pollingOptions: { enabled: false, interval: 5000 },
    }"
    :ui-config="{ tableId: 'demo-polling' }"
  />
</template>
