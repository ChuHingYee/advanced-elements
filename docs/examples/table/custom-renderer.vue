<script setup lang="ts">
import type { AdvColumn, AdvTableColumnSlotProps } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ref } from 'vue'

interface Row {
  id: number
  name: string
  department: string
  amount: number
}

// 动态插槽的类型来自 `插槽名 = 列 prop` 的推导：行类型必须显式声明，否则插槽名拼写不会被检查
defineSlots<{
  'department': (props: AdvTableColumnSlotProps<Row>) => unknown
  'name-header': () => unknown
}>()

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '姓名', width: 140 },
  { prop: 'department', label: '部门', width: 140 },
  { prop: 'amount', label: '金额', width: 140, valueType: 'money' },
]

const data = ref<Row[]>([
  { id: 1, name: '张三', department: '技术部', amount: 1200 },
  { id: 2, name: '李四', department: '技术部', amount: 2400 },
  { id: 3, name: '王五', department: '市场部', amount: 800 },
])
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :ui-config="{ tableId: 'demo-custom-renderer' }"
  >
    <template #department="{ cellData }">
      <el-tag size="small">
        {{ cellData }}
      </el-tag>
    </template>
    <template #name-header>
      <span style="color: var(--el-color-danger)">
        姓名（自定义表头）
      </span>
    </template>
  </AdvTable>
</template>
