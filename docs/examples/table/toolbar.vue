<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ref } from 'vue'

interface Row {
  id: number
  name: string
  department: string
  amount: number
}

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '姓名', width: 140 },
  { prop: 'department', label: '部门', width: 120 },
  { prop: 'amount', label: '金额', width: 140, valueType: 'money' },
]

const data = ref<Row[]>(
  Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    department: ['技术部', '市场部', '财务部'][i % 3]!,
    amount: (i + 1) * 137.5,
  })),
)

const toolbar = {
  columnSetting: true,
  refreshBtn: true,
  pollingBtn: true,
  pollingOptions: { enabled: false, interval: 5000 },
  exportBtn: true,
  exportCsvBtn: true,
  printBtn: true,
}
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :toolbar="toolbar"
    :ui-config="{ tableId: 'demo-toolbar' }"
  >
    <template #header-left>
      <el-button
        size="small"
        type="primary"
      >
        新增
      </el-button>
      <el-button size="small">
        批量删除
      </el-button>
    </template>
  </AdvTable>
</template>
