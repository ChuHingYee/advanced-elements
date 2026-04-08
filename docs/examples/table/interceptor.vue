<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ElMessage } from 'element-plus'
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

// 拦截器在事件/编辑链路前后插入，返回 false 即阻止默认行为
const interceptor = {
  // ESC 默认会关闭编辑器，这里拦住它
  'event.keydown': (params: { event: KeyboardEvent }) => params.event.key !== 'Escape',
  // 提交前兜底校验：姓名为空直接拒绝本次提交
  'edit.commit': ({ prop, newValue }: { prop: string, newValue: unknown }) =>
    prop !== 'name' || String(newValue ?? '').trim() !== '',
}

function onHeaderClick(payload: { column?: { label?: string } }) {
  ElMessage.info(`表头：${payload.column?.label}`)
}
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :edit-config="{ singleClickEdit: true }"
    :interceptor="interceptor"
    :ui-config="{ tableId: 'demo-interceptor' }"
    @header-click="onHeaderClick"
  />
</template>
