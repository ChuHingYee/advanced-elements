<script setup lang="ts">
import type { AdvColumn, ColumnState } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ref } from 'vue'

interface Row {
  id: number
  name: string
  amount: number
}

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '姓名', width: 140 },
  { prop: 'amount', label: '金额', width: 140, valueType: 'money' },
  { prop: 'remark', label: '备注', minWidth: 200 },
]

const data = ref<Row[]>(
  Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    amount: (i + 1) * 137.5,
    remark: `第 ${i + 1} 行`,
  })),
)

// 自定义适配器：把列状态放进 sessionStorage，关闭标签页即失效
const storage = {
  get: (key: string): ColumnState[] | null => {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) as ColumnState[] : null
  },
  set: (key: string, state: ColumnState[]) => sessionStorage.setItem(key, JSON.stringify(state)),
  remove: (key: string) => sessionStorage.removeItem(key),
}

const columnState = { enabled: true, storage, storageKey: 'demo-custom-storage' }
</script>

<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :column-config="{ sidePanel: true, sidePanelPosition: 'right' }"
    :column-state="columnState"
    :ui-config="{ tableId: 'demo-column-state-storage' }"
  />
</template>
