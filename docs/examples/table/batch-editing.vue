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
  { prop: 'name', label: '姓名', width: 140, editable: true, cellEditor: 'text' },
  { prop: 'department', label: '部门', width: 140, editable: true, cellEditor: 'text' },
  { prop: 'amount', label: '金额', width: 140, editable: true, cellEditor: 'number' },
]

const data = ref<Row[]>(
  Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    department: ['技术部', '市场部', '财务部'][i % 3]!,
    amount: (i + 1) * 100,
  })),
)

const tableRef = ref<TableInstanceExpose<Row>>()

async function commit() {
  // 批量编辑统一走实例 API 提交：内部逐格跑校验与拦截器，失败格被拒绝而不影响其它格
  await tableRef.value?.commitBatchEdit()
  ElMessage.success('批量修改已提交')
}

function cancel() {
  tableRef.value?.cancelBatchEdit()
  ElMessage.info('已放弃全部暂存修改')
}
</script>

<template>
  <div>
    <AdvTable
      ref="tableRef"
      :columns="columns"
      :data="data"
      :row-config="{ rowKey: 'id' }"
      :edit-config="{ editType: 'batch' }"
      :ui-config="{ tableId: 'demo-batch-editing' }"
    />
    <div style="margin-top: 12px; display: flex; gap: 8px">
      <el-button
        type="primary"
        @click="commit"
      >
        提交批量编辑
      </el-button>
      <el-button @click="cancel">
        放弃修改
      </el-button>
    </div>
  </div>
</template>
