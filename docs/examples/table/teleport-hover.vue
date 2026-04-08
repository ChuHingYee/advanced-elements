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
  { prop: 'name', label: '姓名', width: 140 },
  { prop: 'department', label: '部门', width: 140 },
  { prop: 'amount', label: '金额', width: 140, valueType: 'money' },
  {
    label: '操作',
    valueType: 'option',
    width: 200,
    fixed: 'right',
    // teleport: true —— 单实例 fixed 定位，滚动/resize 时不会错位，也不会被表格裁切
    hoverActions: { teleport: true },
    actions: [
      { label: '编辑', type: 'primary', onClick: ({ row }) => ElMessage.success(`编辑 ${row.name}`) },
      { label: '删除', type: 'danger', onClick: ({ row }) => ElMessage.error(`删除 ${row.name}`) },
    ],
  },
]

const data = ref<Row[]>(
  Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    department: ['技术部', '市场部', '财务部'][i % 3]!,
    amount: (i + 1) * 137.5,
  })),
)
</script>

<template>
  <!-- 悬停任意行，右侧操作按钮以 Teleport 浮层出现 -->
  <AdvTable
    :columns="columns"
    :data="data"
    :height="360"
    :row-config="{ rowKey: 'id' }"
    :ui-config="{ tableId: 'demo-teleport-hover' }"
  />
</template>
