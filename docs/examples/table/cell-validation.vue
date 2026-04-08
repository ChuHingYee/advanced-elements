<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ref } from 'vue'

interface Row {
  id: number
  name: string
  age: number
  email: string
}

const columns: AdvColumn<Row>[] = [
  {
    prop: 'name',
    label: '姓名',
    width: 140,
    editable: true,
    cellEditor: 'text',
    editorRules: { required: '姓名不能为空' },
  },
  {
    prop: 'age',
    label: '年龄',
    width: 110,
    editable: true,
    cellEditor: 'number',
    editorRules: {
      required: '年龄不能为空',
      min: { value: 0, message: '年龄不能为负数' },
      max: { value: 150, message: '年龄不能超过 150' },
    },
  },
  {
    prop: 'email',
    label: '邮箱',
    minWidth: 240,
    editable: true,
    cellEditor: 'text',
    editorRules: {
      pattern: { regexp: /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/, message: '邮箱格式不正确' },
    },
  },
]

const data = ref<Row[]>([
  { id: 1, name: '张三', age: 28, email: 'zhangsan@example.com' },
  { id: 2, name: '李四', age: 32, email: 'lisi@example.com' },
  { id: 3, name: '王五', age: 26, email: 'wangwu@example.com' },
])
</script>

<template>
  <!-- 校验在提交时触发：不合法的值会被拒绝并保留编辑态，错误信息落在单元格内 -->
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :edit-config="{ singleClickEdit: false }"
    :ui-config="{ tableId: 'demo-cell-validation' }"
  />
</template>
