<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ref } from 'vue'

interface Row {
  id: number
  dept: string
  qty: number
  price: number
  total: number
}

const columns: AdvColumn<Row>[] = [
  { prop: 'dept', label: '部门' },
  // 列级聚合：Grand Total / 分组小计共用该口径，未设置回退 'sum'
  { prop: 'qty', label: '数量', aggFunc: 'sum' },
  { prop: 'price', label: '均价', aggFunc: 'avg' },
  {
    prop: 'total',
    label: '总额',
    valueType: 'money',
    // 自定义归约：(values, rows) => 结果
    aggFunc: values => values.reduce((sum, value) => sum + (Number(value) || 0), 0),
  },
]

const data = ref<Row[]>([
  { id: 1, dept: '技术部', qty: 10, price: 120, total: 1200 },
  { id: 2, dept: '技术部', qty: 5, price: 200, total: 1000 },
  { id: 3, dept: '市场部', qty: 8, price: 90, total: 720 },
  { id: 4, dept: '市场部', qty: 12, price: 150, total: 1800 },
  { id: 5, dept: '财务部', qty: 3, price: 300, total: 900 },
])

const uiConfig = {
  // Grand 总计行位置：top / bottom / pinnedTop / pinnedBottom
  grandTotalRow: 'bottom',
  // 分组小计：统一位置，或按分组回调选择性显示
  groupTotalRow: ({ node }: { node: { level: number } }) => (node.level === 0 ? 'bottom' : undefined),
  // 合计标签：level === -1 为 Grand
  totalValueGetter: ({ isGrandTotal, value }: { isGrandTotal: boolean, value: unknown }) =>
    isGrandTotal ? '总计' : `小计（${value}）`,
  sumText: '合计',
  groupSuppressBlankHeader: true,
}
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :row-group-config="{ field: 'dept', defaultExpandAll: true }"
    :ui-config="uiConfig"
  />
</template>
