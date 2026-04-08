<script setup lang="ts">
import type { AdvColumn } from '@advanced-elements/table'
import { AdvTable } from '@advanced-elements/table'
import { ElMessage } from 'element-plus'
import { ref } from 'vue'

interface Row {
  id: number
  name: string
  department: string
  amount: number
}

const columns: AdvColumn<Row>[] = [
  { prop: 'name', label: '姓名', width: 140 },
  { prop: 'department', label: '部门', width: 140 },
  { prop: 'amount', label: '金额', width: 140, valueType: 'money' },
  { prop: 'remark', label: '备注', minWidth: 180 },
]

const data = ref<Row[]>(
  Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    department: ['技术部', '市场部', '财务部'][i % 3]!,
    amount: (i + 1) * 137.5,
    remark: '右键试试',
  })),
)

// 内置 code 见 BuiltinMenuCode；二维数组的每个子数组之间自动插入分隔线
const menuConfig = {
  header: {
    enabled: true,
    options: [['sortAsc', 'sortDesc'], ['clearSort', 'clearAllFilters'], ['autoSizeThisColumn', 'autoSizeAllColumns'], ['resetColumns']],
  },
  body: {
    enabled: true,
    options: [['copyCell', 'copyRow'], ['pasteCell', 'clearCell'], ['exportCsv', 'print']],
  },
}

// 弹出前统一鉴权：返回 false 则本次不弹菜单
function visibleMethod({ column }: { column?: { prop?: string } }) {
  return column?.prop !== 'remark'
}

function onContextMenuClick(payload: { menu?: { code?: string }, params?: { row?: Row } }) {
  ElMessage.info(`${payload.menu?.code}：${payload.params?.row?.name ?? '-'}`)
}
</script>

<template>
  <!-- 表头与表体都会弹出菜单；remark 列被 visibleMethod 拦下 -->
  <AdvTable
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
    :menu-config="{ header: menuConfig.header, body: menuConfig.body, visibleMethod }"
    :ui-config="{ tableId: 'demo-context-menu' }"
    @context-menu-click="onContextMenuClick"
  />
</template>
