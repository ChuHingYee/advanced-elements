<!--
  @component ColumnSettingSidePanel
  @displayName 列设置侧边面板
  @displayName Column Setting Side Panel
  @description <zh/> 列设置侧边面板组件，提供列显隐、固定、排序等配置
  @description <en/> Column setting side panel component, provides column visibility, fixed, sorting config, etc.
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script lang="ts" setup>
import type { ProcessedColumn as LocalColumn } from '../../types'
import { Setting as IconSetting } from '@element-plus/icons-vue'
import { provide } from 'vue'
import { useColumnSetting } from '../../composables/columns/use-column-setting'
import { useAdvLocale } from '../../locale'
import { advTableColumnActionsKey, advTableColumnSettingListKey } from '../../types/config'
import SidePanel from '../shared/side-panel.vue'
import ColumnSettingList from './column-setting-list.vue'

/**
 * <zh/> 列设置侧面板组件。
 * <en/> Column setting side panel component.
 * <zh/> 以侧边栏形式展示所有列的显隐、拖拽排序及分组管理功能。
 * <en/> Displays column visibility, drag sorting, and group management for all columns in a sidebar.
 *
 */
const props = defineProps<{
  /** <zh/> 初始的原始列配置列表，用于重置 | <en/> initial raw column config list, used for reset */
  originColumns: LocalColumn[]
  /** <zh/> 原始列的格式化函数映射表，key 为列 key，value 为格式化函数 | <en/> format function map for raw columns, key is column key, value is the format function */
  originColumnsFormatMap: Record<string, (...args: unknown[]) => unknown>
  /** <zh/> 重置列配置的回调函数 | <en/> callback to reset column config */
  resetColumns: () => void
  /** <zh/> 面板位置 | <en/> panel position */
  position: 'left' | 'right'
}>()

const emit = defineEmits<{
  /** <zh/> 列显隐变更事件 | <en/> column visibility change event */
  (e: 'columnVisible', payload: { columnKey: string, visible: boolean }): void
  /** <zh/> 关闭面板事件 | <en/> close panel event */
  (e: 'close'): void
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

/** <zh/> 关闭面板 | <en/> Close panel */
function handleClose(): void {
  emit('close')
}
</script>

<template>
  <SidePanel
    :position="position"
    :title="t('table.columnSetting')"
    :icon="IconSetting"
    @close="handleClose"
  >
    <ColumnSettingList />
  </SidePanel>
</template>
