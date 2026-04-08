<script setup lang="ts">
import type { AdvColumn, TableInstanceExpose } from '@advanced-elements/table'
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
  { selection: true, width: 50, label: '' },
  { prop: 'name', label: '姓名', width: 140 },
  { prop: 'department', label: '部门', width: 140 },
  { prop: 'amount', label: '金额', width: 160, valueType: 'money' },
  { prop: 'remark', label: '备注', minWidth: 200 },
]

const data = ref<Row[]>(
  Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    department: ['技术部', '市场部', '财务部'][i % 3]!,
    amount: (i + 1) * 137.5,
    remark: `第 ${i + 1} 行`,
  })),
)

const tableRef = ref<TableInstanceExpose<Row>>()

const toolbar = {
  exportBtn: true,
  exportOptions: { filename: '用户数据', sheetName: '用户', dataMode: 'all' },
  exportCsvBtn: true,
  printBtn: true,
  printOptions: { pageOrientation: 'landscape', sheetName: '用户报表' },
  importBtn: true,
  importOptions: { mode: 'append', maxRows: 10000 },
}

async function exportSelected() {
  // dataMode: 'selected' 时导出的就是当前选中的行
  const ok = await tableRef.value?.exportExcel({ filename: '选中行', dataMode: 'selected' })
  if (ok)
    ElMessage.success('已导出选中行')
}
</script>

<template>
  <div>
    <AdvTable
      ref="tableRef"
      :columns="columns"
      :data="data"
      :row-config="{ rowKey: 'id', rowSelection: 'multiple' }"
      :toolbar="toolbar"
      :ui-config="{ tableId: 'demo-export-print' }"
    />
    <div style="margin-top: 12px">
      <el-button
        size="small"
        @click="exportSelected"
      >
        自定义导出（选中行）
      </el-button>
    </div>
  </div>
</template>
