<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import AdvConfigProvider from '@advanced-elements/config-provider'
import { AdvTable } from '@advanced-elements/table'
import { ref } from 'vue'

const columns: AdvColumn[] = [
  { prop: 'name', label: '姓名', width: 140 },
  { prop: 'department', label: '部门', width: 140 },
]

const data = ref(
  Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    department: ['技术部', '市场部', '财务部'][i % 3],
  })),
)
</script>

<template>
  <!-- 父级：每页 4 条；子级只覆盖 pageSize，其余（分页模式等）继续继承父级 -->
  <AdvConfigProvider :config="{ table: { pagination: { mode: 'client', pageSize: 4 } } }">
    <div class="nested-table">
      <p class="nested-label">
        父级 pageSize：4
      </p>
      <AdvTable
        mode="virtual"
        :columns="columns"
        :data="data"
        :row-config="{ rowKey: 'id' }"
        :ui-config="{ tableId: 'demo-config-provider-parent' }"
        :height="150"
      />

      <AdvConfigProvider :config="{ table: { pagination: { pageSize: 2 } } }">
        <p class="nested-label">
          子级 pageSize：2（覆盖父级）
        </p>
        <AdvTable
          mode="virtual"
          :columns="columns"
          :data="data"
          :row-config="{ rowKey: 'id' }"
          :ui-config="{ tableId: 'demo-config-provider-child' }"
          :height="150"
        />
      </AdvConfigProvider>
    </div>
  </AdvConfigProvider>
</template>

<style scoped>
.nested-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nested-label {
  margin: 0;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
</style>
