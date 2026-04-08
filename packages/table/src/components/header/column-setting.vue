<!--
  @component ColumnSettingHeader
  @displayName 列设置触发按钮
  @displayName Column Setting Trigger
  @description <zh/> 在工具栏中渲染列设置图标按钮，点击弹出 ElPopover 展示 ColumnSettingList
  @description <en/> Renders column setting icon button in toolbar, click to show ElPopover with ColumnSettingList
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script lang="ts" setup>
import type { ProcessedColumn as LocalColumn } from '../../types'
import { Setting as IconSetting } from '@element-plus/icons-vue'
import { ElIcon, ElPopover, ElTooltip } from 'element-plus'
import { provide } from 'vue'
import { useColumnSetting } from '../../composables/columns/use-column-setting'
import { useAdvLocale } from '../../locale'
import { advTableColumnActionsKey, advTableColumnSettingListKey } from '../../types/config'
import ColumnSettingList from '../column-setting/column-setting-list.vue'

const props = defineProps<{
  originColumns: LocalColumn[]
  originColumnsFormatMap: Record<string, (...args: unknown[]) => unknown>
  resetColumns: () => void
}>()

const emit = defineEmits<{
  (e: 'columnVisible', payload: { columnKey: string, visible: boolean }): void
}>()

/** <zh/> 列配置双向绑定 | <en/> two-way binding of column config */
const headers = defineModel<LocalColumn[]>('headers', { required: true })

const { t } = useAdvLocale()

const { columnActions, columnSettingList } = useColumnSetting({
  headers,
  resetColumns: () => props.resetColumns(),
  emitColumnVisible: (payload) => { emit('columnVisible', payload) },
})

provide(advTableColumnActionsKey, columnActions)
provide(advTableColumnSettingListKey, columnSettingList)
</script>

<template>
  <ElPopover
    placement="bottom"
    trigger="click"
    width="auto"
  >
    <template #reference>
      <div class="adv-table-column-setting__trigger">
        <ElTooltip
          :content="t('table.columnSetting')"
          effect="light"
        >
          <ElIcon
            :size="18"
            class="adv-table-column-setting__icon"
          >
            <IconSetting />
          </ElIcon>
        </ElTooltip>
      </div>
    </template>
    <ColumnSettingList />
  </ElPopover>
</template>
