<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ref } from 'vue'

interface Row {
  id: number
  name: string
  address: string
  remark: string
}

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '姓名', width: 140 },
  { prop: 'address', label: '地址', minWidth: 220 },
]

const data = ref<Row[]>(
  Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    address: ['北京市朝阳区', '上海市浦东新区', '广州市天河区'][i % 3]!,
    remark: `第 ${i + 1} 行的备注：这条展开内容由 #expand-row 插槽渲染。`,
  })),
)
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :row-expand-config="{ enabled: true, accordion: false }"
    :ui-config="{ tableId: 'demo-row-expand' }"
  >
    <template #expand-row="{ row }">
      <div style="padding: 4px 0; color: var(--el-text-color-regular); font-size: 13px">
        <p>详细地址：{{ row.address }}</p>
        <p>备注：{{ row.remark }}</p>
      </div>
    </template>
  </AdvTable>
</template>
