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
  // pinFixed 声明永久固定侧，fixed 决定当前固定方向，用户无法在列设置里改动
  { prop: 'id', label: 'ID', width: 80, fixed: 'left', pinFixed: 'left' },
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'department', label: '部门', width: 120 },
  { prop: 'amount', label: '金额', width: 140, valueType: 'money' },
  { prop: 'status', label: '状态', width: 120, ellipsis: { tooltip: true } },
  { prop: 'remark', label: '备注', minWidth: 240 },
]

const data = ref<Row[]>(
  Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    department: ['技术部', '市场部', '财务部'][i % 3]!,
    amount: (i + 1) * 137.5,
    status: i % 2 ? '正常' : '异常',
    remark: '这是一段比较长的备注文本，用来演示列宽拖拽与溢出省略',
  })),
)
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :column-config="{ sidePanel: true, sidePanelPosition: 'right' }"
    :column-state="{ enabled: true, storageKey: 'demo-column-setting' }"
    :ui-config="{ tableId: 'demo-column-setting' }"
  />
</template>
