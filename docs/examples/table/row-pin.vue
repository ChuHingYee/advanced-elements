<script setup lang="ts">
import type { AdvColumn, TableInstanceExpose } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ElMessage } from 'element-plus'
import { ref } from 'vue'

interface Row {
  id: string
  name: string
  department: string
  amount: number
}

const columns: AdvColumn<Row>[] = [
  { prop: 'id', label: '行键', width: 120 },
  { prop: 'name', label: '姓名', width: 140 },
  { prop: 'department', label: '部门', width: 140 },
  { prop: 'amount', label: '金额', width: 140, valueType: 'money' },
]

const data = ref<Row[]>([
  { id: 'total', name: '合计（固定在顶部）', department: '—', amount: 99999 },
  ...Array.from({ length: 20 }, (_, i) => ({
    id: String(i + 1),
    name: `用户${i + 1}`,
    department: ['技术部', '市场部', '财务部'][i % 3]!,
    amount: (i + 1) * 137.5,
  })),
  { id: 'avg', name: '平均值（固定在底部）', department: '—', amount: 1375 },
])

const tableRef = ref<TableInstanceExpose<Row>>()

function pinRow5() {
  tableRef.value?.pinRow('5', 'bottom')
  ElMessage.success('已把第 5 行固定到底部')
}

function unpinAll() {
  tableRef.value?.unpinRow('5')
  ElMessage.info('已取消第 5 行的固定')
}
</script>

<template>
  <div>
    <AdvTable
      ref="tableRef"
      :columns="columns"
      :data="data"
      :height="360"
      :row-config="{ rowKey: 'id' }"
      :row-pin-config="{ topRowKeys: ['total'], bottomRowKeys: ['avg'] }"
      :ui-config="{ tableId: 'demo-row-pin' }"
    />
    <div style="margin-top: 12px; display: flex; gap: 8px">
      <el-button
        size="small"
        @click="pinRow5"
      >
        运行时固定第 5 行到底部
      </el-button>
      <el-button
        size="small"
        @click="unpinAll"
      >
        取消固定
      </el-button>
    </div>
  </div>
</template>
