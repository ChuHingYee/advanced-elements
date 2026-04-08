<!--
  @component ColumnSettingItem
  @displayName 列设置项
  @displayName Column Setting Item
  @description <zh/> 在列设置面板中渲染单个列的配置项，支持显示/隐藏切换、固定操作、拖拽排序，分组列递归渲染子列
  @description <en/> Renders a single column config item in the column setting panel, supports visibility toggle, pinning, drag sorting, group columns recursively render children
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script setup lang="ts">
import type { ProcessedColumn } from '../../types'
import { Download as IconDownload, RefreshRight as IconRefreshRight, Upload as IconUpload } from '@element-plus/icons-vue'
import { ElCheckbox, ElIcon } from 'element-plus'
import { computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { useSafeInject } from '../../composables/shared/use-safe-inject'
import { DRAG_ANIMATION_MS } from '../../constants'
import { useAdvLocale } from '../../locale'
import { advTableColumnActionsKey } from '../../types/config'
import { getColumnKey, isGroupColumn } from '../../utils/shared'
import IconDrag from './icon-drag.vue'

const props = defineProps<{
  /** <zh/> 列配置对象，包含列的显示、固定状态、子列等信息 | <en/> column config object, includes visibility, pin state, children, etc. */
  col: ProcessedColumn
  /** <zh/> 当前列所在的分组标识：'left'（左侧固定列）| 'normal'（中间普通列）| 'right'（右侧固定列） | <en/> group key the current column belongs to: 'left' (left fixed) | 'normal' (center) | 'right' (right fixed) */
  groupKey: 'left' | 'normal' | 'right'
  /** <zh/> 分组名称，用于 VueDraggable group 配置 | <en/> group name, used for VueDraggable group config */
  groupName: string
  /** <zh/> 判断指定列是否已在指定方向上固定的回调函数 | <en/> callback to determine whether a column is pinned in the given direction */
  isPinned: (col: ProcessedColumn, group: 'left' | 'right') => boolean
  /** <zh/> 嵌套层级深度，用于计算缩进距离（每层 16px + 基础 20px） | <en/> nesting depth, used to compute indent distance (16px per level + 20px base) */
  depth?: number
  /** <zh/> 是否允许拖拽排序（为 false 时隐藏拖拽手柄） | <en/> whether drag sorting is allowed (hide drag handle when false) */
  draggable?: boolean
  /** <zh/> 是否为父分组中的唯一子项（唯一子项不可拖拽，拖拽手柄不可见） | <en/> whether this is the only child in its parent group (only child is not draggable, handle hidden) */
  isOnlyChild?: boolean
  /** <zh/> 是否锁定列的显示状态（锁定后复选框不可操作） | <en/> whether the column's visibility is locked (checkbox disabled when locked) */
  lockVisible?: boolean
  /** <zh/> 是否锁定列的固定位置（锁定后固定操作按钮不可用） | <en/> whether the column's pin position is locked (pin buttons disabled when locked) */
  lockPosition?: boolean
}>()

const actions = useSafeInject(advTableColumnActionsKey, 'ColumnSettingItem') ?? {
  onUpdate: () => {},
  onSetFixed: () => {},
  onUnfix: () => {},
  onChildUpdate: () => {},
}

const { t } = useAdvLocale()

const isGroup = computed(() => isGroupColumn(props.col))
const isHidden = computed(() => props.col.hidden ?? false)

const paddingLeft = computed(() => `${(props.depth ?? 0) * 16 + 20}px`)

const localChildren = computed(() => props.col.children ?? [])

function getColumnLabel(col: ProcessedColumn) {
  return col.label ?? getColumnKey(col)
}

let lastNestedDropTarget: HTMLElement | null = null

function handleNestedColumnMove(evt: any): boolean | void {
  const draggedEl = evt.dragged as HTMLElement
  const relatedEl = evt.related as HTMLElement

  if (!relatedEl) {
    if (lastNestedDropTarget) {
      lastNestedDropTarget.classList.remove('adv-table__column-setting-drag-drop-target')
      lastNestedDropTarget = null
    }
    return true
  }

  if (draggedEl === relatedEl) {
    draggedEl.classList.add('adv-table__column-setting-drag-no-drop')
    if (lastNestedDropTarget) {
      lastNestedDropTarget.classList.remove('adv-table__column-setting-drag-drop-target')
      lastNestedDropTarget = null
    }
    return false
  }

  draggedEl.classList.remove('adv-table__column-setting-drag-no-drop')

  if (lastNestedDropTarget) {
    lastNestedDropTarget.classList.remove('adv-table__column-setting-drag-drop-target')
  }
  relatedEl.classList.add('adv-table__column-setting-drag-drop-target')
  lastNestedDropTarget = relatedEl

  return true
}

function handleNestedColumnEnd(evt: any) {
  if (lastNestedDropTarget) {
    lastNestedDropTarget.classList.remove('adv-table__column-setting-drag-drop-target')
    lastNestedDropTarget = null
  }
  evt.item?.classList.remove('adv-table__column-setting-drag-no-drop')
}
</script>

<template>
  <div>
    <div
      class="adv-table-column-setting-item"
      :data-key="getColumnKey(col)"
      :style="{ paddingLeft }"
    >
      <div
        class="adv-table-column-setting-item__drag-handle"
        :class="{ 'adv-table-column-setting-item__drag-handle--hidden': props.draggable === false || props.isOnlyChild || props.lockPosition }"
      >
        <IconDrag :size="16" />
      </div>
      <ElCheckbox
        :model-value="!isHidden"
        :disabled="props.lockVisible"
        size="large"
        @change="actions.onUpdate(col, !!$event)"
      >
        {{ getColumnLabel(col) }}
      </ElCheckbox>
      <span class="adv-table-column-setting-item__pin-actions">
        <ElIcon
          v-if="(groupKey === 'normal' || groupKey === 'right') && !props.lockPosition"
          class="adv-table-column-setting-item__pin-btn"
          :class="{ 'adv-table-column-setting-item__pin-btn--active adv-table-column-setting-item__pin-btn--right-active': groupKey === 'right' }"
          :size="14"
          :title="t('table.pinToLeft')"
          @click.stop="actions.onSetFixed(col, 'left')"
        >
          <IconUpload />
        </ElIcon>
        <ElIcon
          v-if="(groupKey === 'normal' || groupKey === 'left') && !props.lockPosition"
          class="adv-table-column-setting-item__pin-btn"
          :class="{ 'adv-table-column-setting-item__pin-btn--active': groupKey === 'left' }"
          :size="14"
          :title="t('table.pinToRight')"
          @click.stop="actions.onSetFixed(col, 'right')"
        >
          <IconDownload />
        </ElIcon>
        <ElIcon
          v-if="(groupKey === 'left' || groupKey === 'right') && !props.lockPosition"
          class="adv-table-column-setting-item__pin-btn adv-table-column-setting-item__pin-btn--refresh"
          :size="14"
          :title="isPinned(col, groupKey as 'left' | 'right') ? t('table.pinnedCannotUnpin') : t('table.unpin')"
          :class="{ 'adv-table-column-setting-item__pin-btn--disabled': isPinned(col, groupKey as 'left' | 'right') }"
          @click.stop="actions.onUnfix(col)"
        >
          <IconRefreshRight />
        </ElIcon>
      </span>
    </div>
    <VueDraggable
      v-if="isGroup && col.children && col.children.length > 0"
      :model-value="localChildren"
      class="adv-table-column-setting__nested-list"
      :animation="DRAG_ANIMATION_MS"
      ghost-class="adv-table__column-setting-drag-ghost"
      chosen-class="adv-table__column-setting-drag-chosen"
      handle=".adv-table-column-setting-item__drag-handle"
      :group="{ name: groupName, put: true }"
      :on-move="handleNestedColumnMove"
      :on-end="handleNestedColumnEnd"
      @update:model-value="actions.onChildUpdate(props.col, $event as ProcessedColumn[])"
    >
      <ColumnSettingItem
        v-for="child in localChildren"
        :key="getColumnKey(child)"
        :col="child as ProcessedColumn"
        :group-key="groupKey"
        :group-name="groupName"
        :is-pinned="isPinned"
        :depth="(depth ?? 0) + 1"
        :draggable="props.draggable !== false && localChildren.length > 1"
        :is-only-child="localChildren.length === 1"
        :lock-visible="!!(child as ProcessedColumn).lockVisible"
        :lock-position="!!(child as ProcessedColumn).lockPosition"
      />
    </VueDraggable>
  </div>
</template>
