<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ElMessage } from 'element-plus'
import { ref } from 'vue'

interface Row {
  id: number
  name: string
  department: string
}

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '姓名', width: 140 },
  { prop: 'department', label: '部门', width: 120 },
  { prop: 'remark', label: '备注', minWidth: 180 },
]

const data = ref<Row[]>(
  Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    department: ['技术部', '市场部', '财务部'][i % 3]!,
    remark: `拖拽我（当前第 ${i + 1} 行）`,
  })),
)

function onRowDragEnd(payload: { sourceRow: Row, sourceIndex: number, targetIndex: number }) {
  ElMessage.success(`${payload.sourceRow.name}：${payload.sourceIndex} → ${payload.targetIndex}`)
}
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id', rowDraggable: true }"
    :ui-config="{ tableId: 'demo-row-draggable' }"
    @row-drag-end="onRowDragEnd"
  />
</template>
