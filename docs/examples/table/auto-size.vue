<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ref } from 'vue'

interface Row {
  id: number
  name: string
  email: string
  remark: string
}

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '姓名', width: 140 },
  { prop: 'email', label: '邮箱', width: 240 },
  // 备注不设宽度：autoSizeColumns 打开后由内容决定，stretch: false 的列除外
  { prop: 'remark', label: '备注' },
]

const data = ref<Row[]>(
  Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    email: `user${i + 1}@example.com`,
    remark: i % 2 ? '短备注' : '这是一段明显更长的备注文本，用来对比自适应列宽前后的差异',
  })),
)
</script>

<template>
  <!-- autoSizeColumns 由渲染器测量内容宽度并等比分配；表头变化或容器宽度变化都会重新测量 -->
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :column-config="{ autoSizeColumns: true }"
    :ui-config="{ tableId: 'demo-auto-size' }"
  />
</template>
