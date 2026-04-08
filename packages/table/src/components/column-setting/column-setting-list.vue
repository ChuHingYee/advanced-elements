<!--
  @component ColumnSettingList
  @displayName 列设置列表
  @displayName Column Setting List
  @description <zh/> 展示表格列的分组列表（左固定列、未固定列、右固定列），支持拖拽调整列顺序、复选框切换列显隐、全选/重置
  @description <en/> Displays grouped column list (left fixed, unfixed, right fixed), supports drag reorder, checkbox toggle visibility, select all/reset
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script lang="ts" setup>
import type { ProcessedColumn as LocalColumn } from '../../types'
import { ElButton, ElCheckbox } from 'element-plus'
import { computed, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { useSafeInject } from '../../composables/shared/use-safe-inject'
import { DRAG_ANIMATION_MS } from '../../constants'
import { useAdvLocale } from '../../locale'
import { advTableColumnSettingListKey } from '../../types/config'
import { getColumnKey } from '../../utils/shared'
import ColumnSettingItem from './column-setting-item.vue'

/**
 * <zh/> 防御性 fallback——provider 缺失时返回空列表/无操作回调，避免 undefined 解构崩溃。
 * <en/> Defensive fallback — returns empty lists / no-op callbacks when the provider is missing, avoiding undefined destructuring crashes.
 * <zh/> 正常流程下 provider 必然存在（column-setting-side-panel 由 useColumnSetting 提供上下文）。
 * <en/> In normal flow the provider always exists (column-setting-side-panel provides context via useColumnSetting).
 */
const FALLBACK = {
  leftColumns: computed<LocalColumn[]>(() => []),
  normalColumns: computed<LocalColumn[]>(() => []),
  rightColumns: computed<LocalColumn[]>(() => []),
  isChooseAll: ref(false),
  isIndeterminate: ref(false),
  isPinned: () => false,
  handleHeaderChange: () => {},
  handleColumnMove: () => true,
  handleColumnEnd: () => {},
  handleGroupUpdate: () => {},
}

const {
  leftColumns,
  normalColumns,
  rightColumns,
  isChooseAll,
  isIndeterminate,
  isPinned,
  handleHeaderChange,
  handleColumnMove,
  handleColumnEnd,
  handleGroupUpdate,
} = useSafeInject(advTableColumnSettingListKey, 'ColumnSettingList') ?? FALLBACK

const { t } = useAdvLocale()
</script>

<template>
  <div class="adv-table-column-setting">
    <div class="adv-table-column-setting__header">
      <ElCheckbox
        :model-value="isChooseAll"
        :indeterminate="isIndeterminate"
        size="large"
        @change="handleHeaderChange($event as boolean, 'all')"
      >
        {{ t('table.columnDisplay') }}
      </ElCheckbox>
      <ElButton
        size="large"
        link
        class="adv-table-column-setting__reset"
        @click="handleHeaderChange('none', 'all')"
      >
        {{ t('table.resetColumns') }}
      </ElButton>
    </div>
    <div class="adv-table-column-setting__body">
      <div
        v-if="leftColumns.length > 0"
        class="adv-table-column-setting__group"
      >
        <div class="adv-table-column-setting__group-title">
          {{ t('table.fixedLeft') }}
        </div>
        <VueDraggable
          :model-value="leftColumns"
          class="adv-table-column-setting__group-list"
          :animation="DRAG_ANIMATION_MS"
          ghost-class="adv-table__column-setting-drag-ghost"
          chosen-class="adv-table__column-setting-drag-chosen"
          handle=".adv-table-column-setting-item__drag-handle"
          group="left-columns"
          :on-move="handleColumnMove"
          :on-end="handleColumnEnd"
          @update:model-value="handleGroupUpdate('left', $event as LocalColumn[])"
        >
          <ColumnSettingItem
            v-for="col in leftColumns"
            :key="getColumnKey(col)"
            :col="col"
            group-key="left"
            group-name="left-columns"
            :is-pinned="isPinned"
            :depth="0"
            :draggable="leftColumns.length > 1"
            :is-only-child="leftColumns.length === 1"
            :lock-visible="!!col.lockVisible"
            :lock-position="!!col.lockPosition"
          />
        </VueDraggable>
      </div>
      <div
        v-if="normalColumns.length > 0"
        class="adv-table-column-setting__group"
      >
        <div class="adv-table-column-setting__group-title">
          {{ t('table.unfixed') }}
        </div>
        <VueDraggable
          :model-value="normalColumns"
          class="adv-table-column-setting__group-list"
          :animation="DRAG_ANIMATION_MS"
          ghost-class="adv-table__column-setting-drag-ghost"
          chosen-class="adv-table__column-setting-drag-chosen"
          handle=".adv-table-column-setting-item__drag-handle"
          group="normal-columns"
          :on-move="handleColumnMove"
          :on-end="handleColumnEnd"
          @update:model-value="handleGroupUpdate('normal', $event as LocalColumn[])"
        >
          <ColumnSettingItem
            v-for="col in normalColumns"
            :key="getColumnKey(col)"
            :col="col"
            group-key="normal"
            group-name="normal-columns"
            :is-pinned="isPinned"
            :depth="0"
            :draggable="normalColumns.length > 1"
            :is-only-child="normalColumns.length === 1"
            :lock-visible="!!col.lockVisible"
            :lock-position="!!col.lockPosition"
          />
        </VueDraggable>
      </div>
      <div
        v-if="rightColumns.length > 0"
        class="adv-table-column-setting__group"
      >
        <div class="adv-table-column-setting__group-title">
          {{ t('table.fixedRight') }}
        </div>
        <VueDraggable
          :model-value="rightColumns"
          class="adv-table-column-setting__group-list"
          :animation="DRAG_ANIMATION_MS"
          ghost-class="adv-table__column-setting-drag-ghost"
          chosen-class="adv-table__column-setting-drag-chosen"
          handle=".adv-table-column-setting-item__drag-handle"
          group="right-columns"
          :on-move="handleColumnMove"
          :on-end="handleColumnEnd"
          @update:model-value="handleGroupUpdate('right', $event as LocalColumn[])"
        >
          <ColumnSettingItem
            v-for="col in rightColumns"
            :key="getColumnKey(col)"
            :col="col"
            group-key="right"
            group-name="right-columns"
            :is-pinned="isPinned"
            :depth="0"
            :draggable="rightColumns.length > 1"
            :is-only-child="rightColumns.length === 1"
            :lock-visible="!!col.lockVisible"
            :lock-position="!!col.lockPosition"
          />
        </VueDraggable>
      </div>
    </div>
  </div>
</template>
