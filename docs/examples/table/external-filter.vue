<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { computed, ref } from 'vue'

interface Row {
  id: number
  name: string
  department: string
}

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '姓名', width: 140 },
  { prop: 'department', label: '部门', width: 140 },
]

const data: Row[] = [
  { id: 1, name: '张三', department: '技术部' },
  { id: 2, name: '李四', department: '技术部' },
  { id: 3, name: '王五', department: '市场部' },
  { id: 4, name: '赵六', department: '市场部' },
  { id: 5, name: '钱七', department: '财务部' },
]

const keyword = ref('')

// 外部筛选是数据管线上的一个阶段：列筛选之后、排序之前
// 两个回调都必须是纯函数——结果会被管线缓存并参与 prev-stability 判断
const externalFilter = computed(() => ({
  isExternalFilterPresent: () => keyword.value !== '',
  doesExternalFilterPass: (row: Row) => row.name.includes(keyword.value),
}))
</script>

<template>
  <div>
    <AdvTable
      :columns="columns"
      :data="data"
      :row-config="{ rowKey: 'id' }"
      :external-filter="externalFilter"
      :ui-config="{ tableId: 'demo-external-filter' }"
    />
    <el-input
      v-model="keyword"
      placeholder="按姓名外部筛选（试试「张」）"
      style="margin-top: 12px; max-width: 280px"
    />
  </div>
</template>
