<!--
  @component FilterPanel
  @displayName 筛选面板
  @displayName Filter Panel
  @description <zh/> 筛选面板侧边栏组件，以侧边面板形式展示所有可筛选列，提供统一的筛选条件输入和重置功能
  @description <en/> Filter panel sidebar component, displays all filterable columns in a side panel, provides unified filter condition input and reset
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script lang="ts" setup>
import type { EnumFilterOption, ProcessedColumn } from '../../types'
/**
 * <zh/> 筛选面板侧边栏组件。
 * <en/> Filter panel sidebar component.
 * <zh/> 以侧边面板形式展示所有可筛选列，提供统一的筛选条件输入和重置功能。
 * <en/> Displays all filterable columns in a side panel, providing unified filter condition input and reset.
 * <zh/> 每个筛选项通过 ElCollapse 支持折叠/展开。
 * <en/> Each filter item supports collapse/expand via ElCollapse.
 */
import type { ColumnFilterType, ColumnFilterValue } from '../../types/filter'
import { Filter } from '@element-plus/icons-vue'
import { ElButton, ElCollapse, ElCollapseItem, ElScrollbar } from 'element-plus'
import { computed, inject } from 'vue'
import { createDefaultFilterValue, normalizeFilterConfig } from '../../composables/data/use-column-filter'
import { advTableFilterSortKey } from '../../types/injection-keys'
import { getColumnKey, isColumnFilterable } from '../../utils/shared'
import SidePanel from '../shared/side-panel.vue'
import ColumnFilterForm from './column-filter-form.vue'

const props = defineProps<{
  /** <zh/> 已处理的列配置列表，用于提取可筛选列。 | <en/> processed column config list, used to extract filterable columns. */
  columns: ProcessedColumn[]
  /** <zh/> 国际化翻译函数，接收 key 返回对应文本。 | <en/> i18n translation function, takes a key and returns the corresponding text. */
  t: (key: string) => string
  /** <zh/> 面板位置 | <en/> panel position */
  position: 'left' | 'right'
}>()

const emit = defineEmits<{
  /** <zh/> 关闭面板事件 | <en/> close panel event */
  (e: 'close'): void
}>()

const filterOps = inject(advTableFilterSortKey, undefined)

const filterableColumns = computed(() => {
  return props.columns.filter(col => isColumnFilterable(col))
})

/** <zh/> 默认展开有筛选条件的项 | <en/> by default expand items that have filter conditions */
const activeCollapseKeys = computed(() => {
  return filterableColumns.value
    .filter(col => isFiltered(getColumnKey(col)))
    .map(col => getColumnKey(col))
})

function getFilterType(col: ProcessedColumn): ColumnFilterType {
  const config = normalizeFilterConfig(col.filter ?? true)
  return config.type
}

function getFilterValue(key: string): ColumnFilterValue {
  return filterOps?.getFilterValue?.(key) ?? createDefaultFilterValue('text')
}

function setFilterValue(key: string, val: ColumnFilterValue) {
  filterOps?.setFilter?.(key, val)
}

function isFiltered(key: string): boolean {
  return filterOps?.isColumnFiltered?.(key) ?? false
}

function getEnumOpts(key: string): EnumFilterOption[] {
  return filterOps?.getEnumOptions?.(key) ?? []
}

function handleResetAll() {
  filterOps?.resetAllFilters?.()
}

/** <zh/> 关闭筛选面板 | <en/> Close filter panel */
function handleClose(): void {
  emit('close')
}
</script>

<template>
  <SidePanel
    :position="position"
    :title="t('table.filter.panelTitle')"
    :icon="Filter"
    @close="handleClose"
  >
    <ElScrollbar>
      <ElCollapse
        :model-value="activeCollapseKeys"
      >
        <ElCollapseItem
          v-for="col in filterableColumns"
          :key="getColumnKey(col)"
          :name="getColumnKey(col)"
        >
          <template #title>
            <span
              class="adv-table-filter-side-panel__item-title"
              :class="{ 'adv-table-filter-side-panel__item-title--active': isFiltered(getColumnKey(col)) }"
            >
              {{ col.label || col.prop }}
            </span>
          </template>
          <ColumnFilterForm
            :column-key="getColumnKey(col)"
            :filter-type="getFilterType(col)"
            :model-value="getFilterValue(getColumnKey(col))"
            :enum-options="() => getEnumOpts(getColumnKey(col))"
            :active="isFiltered(getColumnKey(col))"
            :inline="true"
            :t="filterOps?.filterT ?? (() => '')"
            @update:model-value="(val: ColumnFilterValue | undefined) => val !== undefined && setFilterValue(getColumnKey(col), val)"
          />
        </ElCollapseItem>
      </ElCollapse>
    </ElScrollbar>

    <template #footer>
      <ElButton
        size="small"
        @click="handleResetAll"
      >
        {{ t('table.filter.resetAll') }}
      </ElButton>
    </template>
  </SidePanel>
</template>
