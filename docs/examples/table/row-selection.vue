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
  // 选择列需要显式声明：rowConfig.rowSelection 只决定选择行为，列还得自己加
  { selection: true, width: 50, label: '' },
  { prop: 'name', label: '姓名', width: 140 },
  { prop: 'department', label: '部门', width: 120 },
  { prop: 'amount', label: '金额', width: 140, valueType: 'money' },
]

const data = ref<Row[]>(
  Array.from({ length: 24 }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    department: ['技术部', '市场部', '财务部'][i % 3]!,
    amount: (i + 1) * 137.5,
  })),
)

// 事件载荷与 tableId 并列传入：handler 第一个参数是选中行，第二个是轻量 key 快照
function onSelectionChange(rows: Row[], meta: { keys: string[], count: number }) {
  ElMessage.info(`已选 ${rows.length} 行（keys: ${meta.keys.join(', ')}）`)
}
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id', rowSelection: 'multiple', rowMultiSelectWithClick: true }"
    :ui-config="{ tableId: 'demo-row-selection' }"
    :pagination="{ enabled: true, mode: 'client', pageSize: 10 }"
    @selection-change="onSelectionChange"
  />
</template>
