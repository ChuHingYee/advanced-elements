<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ref } from 'vue'

const columns: AdvColumn[] = [
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'age', label: '年龄', width: 80, align: 'center' },
  { prop: 'email', label: '邮箱', minWidth: 200 },
  {
    prop: 'status',
    label: '状态',
    valueType: 'select',
    valueEnum: { 1: '启用', 0: '禁用' },
  },
]

const data = ref([
  { id: '1', name: '张三', age: 28, email: 'zhangsan@example.com', status: 1 },
  { id: '2', name: '李四', age: 32, email: 'lisi@example.com', status: 0 },
  { id: '3', name: '王五', age: 26, email: 'wangwu@example.com', status: 1 },
])
</script>

<template>
  <!-- 文档页同页多表：显式 tableId 让列状态存储键稳定，不受随机实例 id 影响 -->
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :ui-config="{ tableId: 'demo-basic' }"
  />
</template>
