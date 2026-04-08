<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ElMessage } from 'element-plus'
import { ref } from 'vue'

interface Row {
  id: number
  name: string
  startDate: string
  endDate: string
  amount: number
}

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '名称', width: 140, editable: true, cellEditor: 'text' },
  { prop: 'startDate', label: '开始日期', width: 160, editable: true, cellEditor: 'date' },
  { prop: 'endDate', label: '结束日期', width: 160, editable: true, cellEditor: 'date' },
  { prop: 'amount', label: '金额', width: 130, editable: true, cellEditor: 'number' },
]

const data = ref<Row[]>([
  { id: 1, name: '一季度预算', startDate: '2026-01-01', endDate: '2026-03-31', amount: 30000 },
  { id: 2, name: '二季度预算', startDate: '2026-04-01', endDate: '2026-06-30', amount: 32000 },
  { id: 3, name: '三季度预算', startDate: '2026-07-01', endDate: '2026-09-30', amount: 33000 },
])

// 跨字段规则只在整行提交时跑：返回错误数组（columnKey 为 '__row__' 时挂在行首）
function crossFieldValidator({ values }: { values: Record<string, unknown> }) {
  const start = values.startDate as string
  const end = values.endDate as string
  if (start && end && start > end)
    return [{ columnKey: '__row__', message: '开始日期不能晚于结束日期' }]
  return []
}

function onCrossFieldError(payload: { rowIndex: number, errors: string[] }) {
  ElMessage.warning(`第 ${payload.rowIndex + 1} 行：${payload.errors.join('；')}`)
}
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :edit-config="{ editType: 'fullRow', singleClickEdit: true, crossFieldValidator }"
    :ui-config="{ tableId: 'demo-cross-field-validation' }"
    @cross-field-validate-error="onCrossFieldError"
  />
</template>
