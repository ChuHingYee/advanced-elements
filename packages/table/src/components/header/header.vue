<!--
  @component TableHeader
  @displayName 表格工具栏
  @displayName Table Header
  @description <zh/> 表格工具栏组件，提供列设置、刷新、轮询、导出、导入、打印等操作按钮
  @description <en/> Table header toolbar component, provides column setting, refresh, polling, export, import, print, etc.
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script lang="ts" setup>
/**
 * <zh/> 表格工具栏组件，提供列设置、刷新、轮询、导出、导入、打印等按钮
 * <en/> Table header toolbar component, provides column setting, refresh, polling, export, import, print buttons
 */
import type { Component } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { RequiredToolbarConfig } from '../../types/config'
import { Download as IconDownload, Printer as IconPrinter, RefreshRight as IconRefreshRight, Upload as IconUpload } from '@element-plus/icons-vue'
import { ElIcon, ElTooltip } from 'element-plus'
import { computed } from 'vue'
import HeaderColumnSetting from './column-setting.vue'
import HeaderPollingBtn from './polling-btn.vue'

/**
 * <zh/> 工具栏配置类型见 types/config-toolbar#RequiredToolbarConfig（单一源，此处不再另定义）。
 * <en/> Toolbar config type lives at types/config-toolbar#RequiredToolbarConfig (single source, never redefined here).
 */

/**
 * <zh/> 表格顶部操作栏组件，含刷新、列设置、过滤、导出等按钮。
 * <en/> Table top action bar component, includes refresh, column setting, filter, export buttons.
 * <zh/> 根据 toolbar 配置按需渲染各功能按钮及插槽。
 * <en/> Renders each function button and slot on demand based on the toolbar config.
 */
const props = defineProps<{
  /** <zh/> 工具栏配置项 | <en/> toolbar config */
  toolbar: RequiredToolbarConfig
  /** <zh/> 是否存在可配置的列 | <en/> whether there are configurable columns */
  hasColumns: boolean
  /** <zh/> 是否有数据源（用于判断是否显示轮询按钮） | <en/> whether there is a data source (used to decide showing the polling button) */
  hasSource: boolean
  /** <zh/> 是否为手动模式 | <en/> whether in manual mode */
  isManual: boolean
  /** <zh/> 当前列配置列表 | <en/> current column config list */
  columns: ProcessedColumn[]
  /** <zh/> 原始列配置列表（用于重置） | <en/> original column config list (used for reset) */
  originColumns: ProcessedColumn[]
  /** <zh/> 原始列格式化函数的映射表 | <en/> map of original column format functions */
  originColumnsFormatMap: Record<string, (...args: unknown[]) => unknown>
  /** <zh/> 重置列配置的回调函数 | <en/> callback to reset column config */
  resetColumns: () => void
  /** <zh/> 是否正在轮询 | <en/> whether polling is active */
  isPolling: boolean
  /** <zh/> 是否正在导出 Excel | <en/> whether exporting Excel */
  exporting: boolean
  /** <zh/> 是否正在导出 CSV | <en/> whether exporting CSV */
  exportingCsv: boolean
  /** <zh/> 是否正在导入数据 | <en/> whether importing data */
  importing: boolean
  /** <zh/> 是否正在打印 | <en/> whether printing */
  printing: boolean
  /** <zh/> 国际化翻译函数 | <en/> i18n translation function */
  t: (key: string) => string
  /** <zh/> 父组件是否提供了 header-left 插槽（不能通过子组件 useSlots 检测，因父组件始终透传插槽函数） | <en/> whether the parent component provided a header-left slot (cannot be detected via child useSlots, as the parent always passes slot functions through) */
  hasHeaderLeftSlot?: boolean
  /** <zh/> 父组件是否提供了 header-right 插槽 | <en/> whether the parent component provided a header-right slot */
  hasHeaderRightSlot?: boolean
}>()

const emit = defineEmits<{
  /** <zh/> 点击刷新按钮时触发 | <en/> triggered when the refresh button is clicked */
  (e: 'refresh'): void
  /** <zh/> 点击导出 Excel 按钮时触发 | <en/> triggered when the export Excel button is clicked */
  (e: 'exportExcel'): void
  /** <zh/> 点击导出 CSV 按钮时触发 | <en/> triggered when the export CSV button is clicked */
  (e: 'exportCsv'): void
  /** <zh/> 点击导入数据按钮时触发 | <en/> triggered when the import data button is clicked */
  (e: 'importData'): void
  /** <zh/> 点击打印按钮时触发 | <en/> triggered when the print button is clicked */
  (e: 'print'): void
  /** <zh/> 列可见性变化时触发 | <en/> triggered when column visibility changes */
  (e: 'columnVisible', payload: { columnKey: string, visible: boolean }): void
}>()

/** <zh/> 是否正在轮询（v-model:isPolling 双向绑定，默认 false，与 polling-btn 对齐）
 * <zh/> 注意：与上方 defineProps 同名声明构成手工双向（父经 :is-polling 传入 + @update:is-polling 回写），
 * <zh/> 非标准 v-model 简写——改动其中一边时必须同步另一边，勿只改单边。
 * <en/> whether polling is active (v-model:isPolling, defaults to false, aligned with polling-btn)
 * <en/> NOTE: the same-named defineProps entry above forms a manual two-way binding
 * <en/> (parent passes :is-polling + writes back via @update:is-polling), not the standard
 * <en/> v-model shorthand — keep both sides in sync, never change only one. */
const isPolling = defineModel<boolean>('isPolling', { default: false })
/** <zh/> 当前列配置列表（v-model:columns 双向绑定，与上方 isPolling 同受手工双向约束）
 * <en/> current column config list (v-model:columns, same manual two-way constraint as isPolling above) */
const columns = defineModel<ProcessedColumn[]>('columns')

/**
 * <zh/> 判断是否有需要渲染的顶部操作栏内容
 * <zh/> 注意：不能通过 useSlots 检测 header-left/header-right 插槽是否存在，
 * <zh/> 因为父组件 (table.vue) 始终透传 <template #header-left> / <template #header-right>，
 * <zh/> 导致子组件的 slots 对象上始终存在这两个函数（即使内容为空）。
 * <zh/> 因此通过 hasHeaderLeftSlot / hasHeaderRightSlot prop 由父组件传递真实插槽存在性。
 *
 * <en/> Determine whether there is top action bar content to render.
 * <en/> Note: cannot detect header-left/header-right slots via useSlots,
 * <en/> because the parent (table.vue) always passes <template #header-left> / <template #header-right>,
 * <en/> so the child's slots object always has these two functions (even when empty).
 * <en/> Therefore, the parent passes the actual slot existence via hasHeaderLeftSlot / hasHeaderRightSlot props.
 */
const hasHeader = computed(() =>
  [
    props.hasHeaderLeftSlot,
    props.hasHeaderRightSlot,
    props.toolbar.columnSetting && props.hasColumns,
    props.toolbar.refreshBtn,
    props.toolbar.pollingBtn,
    props.toolbar.exportBtn,
    props.toolbar.exportCsvBtn,
    props.toolbar.importBtn,
    props.toolbar.printBtn,
  ].some(Boolean),
)

/** <zh/> 判断是否有数据操作类按钮（导入/导出/打印/刷新） | <en/> determine whether there are data-operation buttons (import/export/print/refresh) */
const hasDataOperations = computed(() =>
  [
    props.toolbar.importBtn,
    props.toolbar.exportBtn,
    props.toolbar.exportCsvBtn,
    props.toolbar.printBtn,
    props.toolbar.refreshBtn,
  ].some(Boolean),
)

/** <zh/> 数据操作按钮配置数组——消除重复的 tooltip+icon 渲染模式 | <en/> Data operation button config array — eliminates repeated tooltip+icon render pattern */
const dataOperationButtons = computed(() => {
  const buttons: Array<{ key: string, icon: Component, label: string, loading: boolean, handler: () => void }> = []
  if (props.toolbar.importBtn)
    buttons.push({ key: 'import', icon: IconUpload, label: props.t('table.import.title'), loading: props.importing, handler: () => emit('importData') })
  if (props.toolbar.exportBtn)
    buttons.push({ key: 'export', icon: IconDownload, label: props.t('table.export.title'), loading: props.exporting, handler: () => emit('exportExcel') })
  if (props.toolbar.exportCsvBtn)
    buttons.push({ key: 'exportCsv', icon: IconDownload, label: props.t('table.export.csvTitle'), loading: props.exportingCsv, handler: () => emit('exportCsv') })
  if (props.toolbar.printBtn)
    buttons.push({ key: 'print', icon: IconPrinter, label: props.t('table.print.title'), loading: props.printing, handler: () => emit('print') })
  if (props.toolbar.refreshBtn)
    buttons.push({ key: 'refresh', icon: IconRefreshRight, label: props.t('table.refresh'), loading: false, handler: () => emit('refresh') })
  return buttons
})

/** <zh/> 处理列配置更新 | <en/> handle column config update */
function handleColumnsUpdate(val: ProcessedColumn[]) {
  columns.value = val
}

/** <zh/> 列可见性变化事件转发 | <en/> Column visibility change event forwarder */
function handleColumnVisible(p: { columnKey: string, visible: boolean }): void {
  emit('columnVisible', p)
}

/** <zh/> 轮询状态更新 | <en/> Polling state update */
function handlePollingUpdate(val: boolean): void {
  isPolling.value = val
}
</script>

<template>
  <div
    v-if="hasHeader"
    class="adv-table__header"
  >
    <div class="adv-table__header-left">
      <slot name="header-left" />
    </div>
    <div class="adv-table__header-right">
      <slot name="header-right" />
      <HeaderPollingBtn
        v-if="toolbar.pollingBtn && hasSource && !isManual"
        :is-polling="isPolling"
        :options="toolbar.pollingOptions"
        @update:is-polling="handlePollingUpdate"
      />
      <span
        v-if="toolbar.pollingBtn && hasSource && !isManual && hasDataOperations"
        class="adv-table__header-divider"
      />
      <template v-if="hasDataOperations">
        <ElTooltip
          v-for="btn in dataOperationButtons"
          :key="btn.key"
          :content="btn.label"
          effect="light"
        >
          <ElIcon
            :size="16"
            class="adv-table__header-ghost-btn"
            :class="[`adv-table__header-${btn.key}`, { 'adv-table__header-ghost-btn--loading': btn.loading }]"
            @click="btn.handler"
          >
            <component :is="btn.icon" />
          </ElIcon>
        </ElTooltip>
      </template>
      <span
        v-if="hasDataOperations && hasColumns && toolbar.columnSetting"
        class="adv-table__header-divider"
      />
      <HeaderColumnSetting
        v-if="hasColumns && toolbar.columnSetting"
        :headers="columns ?? []"
        :origin-columns="originColumns"
        :origin-columns-format-map="originColumnsFormatMap"
        :reset-columns="resetColumns"
        @update:headers="handleColumnsUpdate"
        @column-visible="handleColumnVisible"
      />
    </div>
  </div>
</template>
