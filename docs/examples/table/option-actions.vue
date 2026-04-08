<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ref } from 'vue'

interface Row {
  id: number
  name: string
  department: string
  status: 'active' | 'inactive' | 'archived' | 'locked'
  amount: number
}

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'department', label: '部门', width: 120 },
  {
    prop: 'status',
    label: '状态',
    width: 110,
    valueType: 'select',
    valueEnum: {
      active: { text: '正常', status: 'Success' },
      inactive: { text: '停用', status: 'Info' },
      archived: { text: '归档', status: 'Warning' },
      locked: { text: '锁定', status: 'Danger' },
    },
  },
  { prop: 'amount', label: '金额', width: 130, valueType: 'money' },
  {
    valueType: 'option',
    label: '操作',
    width: 200,
    fixed: 'right',
    actions: [
      { label: '查看', type: 'primary', link: true, onClick: ({ row }) => ElMessage.info(`查看 ${row.name}`) },
      { label: '编辑', type: 'warning', link: true, onClick: ({ row }) => ElMessage.warning(`编辑 ${row.name}`) },
      {
        label: '删除',
        type: 'danger',
        link: true,
        // visible / disabled 都是函数，按行状态逐条决定
        visible: ({ row }) => row.status !== 'archived',
        disabled: ({ row }) => row.status === 'locked',
        onClick: async ({ row }) => {
          await ElMessageBox.confirm(`确认删除 ${row.name}？`, '提示', { type: 'warning' })
          ElMessage.success(`已删除 ${row.name}`)
        },
      },
    ],
  },
]

const data = ref<Row[]>([
  { id: 1, name: '张三', department: '技术部', status: 'active', amount: 1200 },
  { id: 2, name: '李四', department: '技术部', status: 'locked', amount: 2400 },
  { id: 3, name: '王五', department: '市场部', status: 'inactive', amount: 800 },
  { id: 4, name: '赵六', department: '财务部', status: 'archived', amount: 1600 },
])
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :ui-config="{ tableId: 'demo-option-actions' }"
  />
</template>
