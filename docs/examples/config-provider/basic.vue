<script setup lang="ts">
import type { AdvConfig } from '@advanced-elements/config-provider'
import type { AdvColumn } from '@advanced-elements/table'
import AdvConfigProvider from '@advanced-elements/config-provider'
import { AdvTable } from '@advanced-elements/table'
import { ref } from 'vue'

// <zh/> 全局默认值：组件 props 仍优先于这里的配置
// <en/> Global defaults — component props still win over this config
const config: AdvConfig = {
  table: {
    search: { enabled: true, labelWidth: 'auto' },
    toolbar: { columnSetting: true, refreshBtn: true, pollingBtn: true },
    // 本地数据要 mode: 'client'：默认的 'page' 模式按服务端分页，不传 total 就不出分页器
    // Local data needs mode: 'client' — the default 'page' mode paginates server-side and renders no pager without `total`
    pagination: { mode: 'client', pageSize: 5, pageSizes: [5, 10, 20] },
  },
}

const columns: AdvColumn[] = [
  { prop: 'name', label: '姓名', width: 140, search: true },
  { prop: 'department', label: '部门', width: 140, search: true },
  { prop: 'amount', label: '金额', width: 140, valueType: 'money' },
]

const data = ref(
  Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    department: ['技术部', '市场部', '财务部'][i % 3],
    amount: (i + 1) * 137.5,
  })),
)
</script>

<template>
  <AdvConfigProvider :config="config">
    <!-- 未传任何 props：分页、搜索、工具栏全部走全局配置 -->
    <AdvTable
      :columns="columns"
      :data="data"
      :row-config="{ rowKey: 'id' }"
      :ui-config="{ tableId: 'demo-config-provider-basic' }"
    />
  </AdvConfigProvider>
</template>
