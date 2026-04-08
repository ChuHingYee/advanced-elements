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
  { prop: 'name', label: '姓名', width: 140 },
  { prop: 'department', label: '部门', width: 140 },
  { prop: 'amount', label: '金额', width: 140, valueType: 'money' },
  { prop: 'status', label: '状态', width: 120 },
  { prop: 'remark', label: '备注', minWidth: 200, ellipsis: { tooltip: true } },
]

const data = ref<Row[]>(
  Array.from({ length: 16 }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    department: ['技术部', '市场部', '财务部'][i % 3]!,
    amount: (i + 1) * 137.5,
    status: i % 2 ? '正常' : '异常',
    remark: `第 ${i + 1} 行的备注`,
  })),
)

// 显式 storageKey 才能命中；默认键是 adv-table-cols-{tableId}，随机 tableId 每次刷新都变
const columnState = {
  enabled: true,
  storageKey: 'demo-column-state',
  autoSave: true,
  autoRestore: true,
  include: ['colId', 'width', 'hidden', 'fixed', 'sort'],
  errorStrategy: 'warn',
}
</script>

<template>
  <!-- 拖宽列、隐藏列、换排序，刷新页面后仍然保留 -->
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :column-config="{ sidePanel: true, sidePanelPosition: 'right' }"
    :column-state="columnState"
    :ui-config="{ tableId: 'demo-column-state' }"
  />
</template>
