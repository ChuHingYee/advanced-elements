<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { onMounted, ref } from 'vue'

interface Row {
  id: number
  name: string
  department: string
  amount: number
}

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '姓名', width: 140 },
  { prop: 'department', label: '部门', width: 140 },
  { prop: 'amount', label: '金额', width: 140, valueType: 'money' },
]

const TOTAL = 200
const rows = ref<Row[]>([])

// manual 分页：表格既不切片也不请求，只派发 pageChange，由宿主取数后回写 data。
// total 必须给全量条数——它决定「加载更多」何时消失（不给则按当前 data.length 算，第一页就到底了）。
function loadMore(_page: number, size: number) {
  const start = rows.value.length
  rows.value = [
    ...rows.value,
    ...Array.from({ length: Math.max(Math.min(size, TOTAL - start), 0) }, (_, i) => ({
      id: start + i + 1,
      name: `用户${start + i + 1}`,
      department: ['技术部', '市场部', '财务部'][(start + i) % 3]!,
      amount: (start + i + 1) * 13.7,
    })),
  ]
}

onMounted(() => loadMore(1, 20))
</script>

<template>
  <!-- virtual 模式下 infiniteScroll 会在触底时自动触发 pageChange（reason: loadMore），无需手点按钮 -->
  <AdvTable
    :columns="columns"
    :data="rows"
    :height="380"
    :row-config="{ rowKey: 'id' }"
    :pagination="{ enabled: true, mode: 'manual', pageSize: 20, total: TOTAL, infiniteScroll: true }"
    :ui-config="{ tableId: 'demo-load-more' }"
    @page-change="loadMore"
  />
</template>
