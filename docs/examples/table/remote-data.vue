<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ElMessage } from 'element-plus'

interface Row {
  id: number
  name: string
  department: string
  amount: number
  createTime: string
}

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'department', label: '部门', width: 120 },
  { prop: 'amount', label: '金额', width: 120, valueType: 'money' },
  { prop: 'createTime', label: '创建时间', width: 160, valueType: 'date' },
]

// 假后端：本地数据集分页返回，模拟 300ms 网络延迟
const ALL: Row[] = Array.from({ length: 57 }, (_, i) => ({
  id: i + 1,
  name: `用户${i + 1}`,
  department: ['技术部', '市场部', '财务部'][i % 3]!,
  amount: (i + 1) * 137.5,
  createTime: `2026-0${(i % 9) + 1}-${String((i % 27) + 1).padStart(2, '0')}`,
}))

const request = {
  source: async (params: Record<string, unknown>) => {
    await new Promise(resolve => setTimeout(resolve, 300))
    const page = Number(params.page ?? 1)
    const size = Number(params.size ?? 10)
    const start = (page - 1) * size
    return { data: ALL.slice(start, start + size), total: ALL.length }
  },
}

function onDataChange({ reason, data }: { reason: string, data: Row[] }) {
  ElMessage.success(`${reason}：本页 ${data.length} 行`)
}
</script>

<template>
  <AdvTable
    :columns="columns"
    :request="request"
    :row-config="{ rowKey: 'id' }"
    :pagination="{ enabled: true, pageSize: 10, pageSizes: [10, 20, 50] }"
    :ui-config="{ tableId: 'demo-remote-data' }"
    @data-change="onDataChange"
  />
</template>
