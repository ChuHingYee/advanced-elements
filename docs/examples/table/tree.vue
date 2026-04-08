<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ref } from 'vue'

interface Row {
  id: string
  name: string
  manager: string
  children?: Row[]
}

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '部门', minWidth: 200 },
  { prop: 'manager', label: '负责人', width: 140 },
]

const treeData = ref<Row[]>([
  {
    id: '1',
    name: '总部',
    manager: '张三',
    children: [
      {
        id: '1-1',
        name: '技术部',
        manager: '李四',
        children: [
          { id: '1-1-1', name: '前端组', manager: '王五' },
          { id: '1-1-2', name: '后端组', manager: '赵六' },
        ],
      },
      { id: '1-2', name: '市场部', manager: '钱七' },
      { id: '1-3', name: '财务部', manager: '孙八' },
    ],
  },
])
</script>

<template>
  <!-- 树形需要全量数据：请用本地数据 + pagination.mode='client'，或直接关掉分页 -->
  <AdvTable
    :columns="columns"
    :data="treeData"
    :row-config="{ rowKey: 'id' }"
    :tree-config="{ children: 'children', defaultExpandAll: false, defaultExpandedRowKeys: ['1', '1-1'], indent: 24 }"
    :ui-config="{ tableId: 'demo-tree' }"
  />
</template>
