<script setup lang="ts">
import type { AdvColumn, TableInstanceExpose } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ref } from 'vue'

interface Row {
  id: number
  name: string
  department: string
}

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '姓名', width: 140 },
  { prop: 'department', label: '部门', width: 140 },
]

const tableRef = ref<TableInstanceExpose<Row>>()

// request.auto: false —— 表格不自动请求，也不预置任何数据，取数时机完全交给宿主。
// 需要首屏数据时，在自己的 onMounted / 路由钩子里调 refresh() 或 setResponseData()。
async function load() {
  await tableRef.value?.refresh()
}
</script>

<template>
  <div>
    <AdvTable
      ref="tableRef"
      :columns="columns"
      :request="{
        auto: false,
        source: async () => ({
          data: [
            { id: 1, name: '张三', department: '技术部' },
            { id: 2, name: '李四', department: '市场部' },
          ],
          total: 2,
        }),
      }"
      :row-config="{ rowKey: 'id' }"
      empty-text="初始为空，点下方按钮触发请求"
      :ui-config="{ tableId: 'demo-manual-request' }"
    />
    <div style="margin-top: 12px">
      <el-button
        size="small"
        type="primary"
        @click="load"
      >
        加载数据
      </el-button>
    </div>
  </div>
</template>
