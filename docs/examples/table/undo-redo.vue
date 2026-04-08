<script setup lang="ts">
import type { AdvColumn, TableInstanceExpose } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ref } from 'vue'

interface Row {
  id: number
  name: string
  amount: number
}

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '姓名', width: 160, editable: true, cellEditor: 'text' },
  { prop: 'amount', label: '金额', width: 160, editable: true, cellEditor: 'number' },
]

const data = ref<Row[]>([
  { id: 1, name: '张三', amount: 1200 },
  { id: 2, name: '李四', amount: 2400 },
  { id: 3, name: '王五', amount: 3600 },
])

const tableRef = ref<TableInstanceExpose<Row>>()

// canUndo / canRedo 是实例上的 ref，模板里直接解包即可
function undo() {
  tableRef.value?.undo()
}

function redo() {
  tableRef.value?.redo()
}
</script>

<template>
  <div>
    <AdvTable
      ref="tableRef"
      :columns="columns"
      :data="data"
      :row-config="{ rowKey: 'id' }"
      :edit-config="{ singleClickEdit: true, undoMaxStackSize: 50 }"
      :ui-config="{ tableId: 'demo-undo-redo' }"
    />
    <div style="margin-top: 12px; display: flex; gap: 8px">
      <el-button
        size="small"
        :disabled="!tableRef?.canUndo"
        @click="undo"
      >
        撤销
      </el-button>
      <el-button
        size="small"
        :disabled="!tableRef?.canRedo"
        @click="redo"
      >
        重做
      </el-button>
      <span style="align-self: center; color: var(--el-text-color-secondary); font-size: 12px">
        改几个格子再试
      </span>
    </div>
  </div>
</template>
