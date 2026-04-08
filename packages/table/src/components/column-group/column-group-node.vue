<!--
  @component ColumnGroupNode
  @displayName 列组管理树节点
  @displayName Column Group Node
  @description <zh/> 渲染单个列节点（叶子列或分组列），支持拖拽排序、重命名分组、删除空分组
  @description <en/> Renders a single column node (leaf or group column), supports drag sorting, rename group, delete empty group
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script setup lang="ts">
import type { ProcessedColumn } from '../../types'
import { Close, Edit } from '@element-plus/icons-vue'
import { ElIcon, ElInput } from 'element-plus'
import { computed, inject, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { DRAG_ANIMATION_MS } from '../../constants'
import { useAdvLocale } from '../../locale'
import { advTableColumnGroupKey } from '../../types/injection-keys'
import { getColumnKey, isGroupColumn } from '../../utils/shared'
import IconDrag from '../column-setting/icon-drag.vue'

const props = defineProps<{
  /** <zh/> 当前列配置 | <en/> Current column config */
  col: ProcessedColumn
  /** <zh/> 嵌套层级深度 | <en/> Nested level depth */
  depth?: number
}>()

/** <zh/> 拖拽分组配置（模块常量，替代模板内联对象，避免每次渲染新建） | <en/> Drag group config (module constant instead of a template-inline object) */
const COLUMN_GROUP_DRAG_GROUP = { name: 'column-group-tree', put: true } as const

const columnGroupApi = inject(advTableColumnGroupKey, undefined)

const { t } = useAdvLocale()

const isGroup = computed(() => isGroupColumn(props.col) || !!props.col.__isGroup)
const colKey = computed(() => getColumnKey(props.col))
const colLabel = computed(() => (props.col.label ?? colKey.value) as string)
const isEmptyGroup = computed(() => isGroup.value && (!props.col.children || props.col.children.length === 0))
const indentPx = computed(() => `${(props.depth ?? 0) * 20}px`)

/** <zh/> 是否正在重命名 | <en/> Whether renaming is in progress */
const isRenaming = ref(false)
const renameValue = ref('')

/** <zh/> 上一个 drop 目标 DOM 引用 | <en/> Previous drop target DOM reference */
const lastDropTarget = ref<HTMLElement | null>(null)

function startRename() {
  renameValue.value = colLabel.value
  isRenaming.value = true
}

function confirmRename() {
  const name = renameValue.value.trim()
  if (!name)
    return
  columnGroupApi?.renameGroup(colKey.value, name)
  isRenaming.value = false
}

function cancelRename() {
  isRenaming.value = false
}

function handleDelete() {
  if (!isEmptyGroup.value)
    return
  columnGroupApi?.deleteGroup(colKey.value)
}

/** <zh/> 拖拽 onMove 回调——校验 maxDepth 和 lockGroupMembership | <en/> Drag onMove callback — validates maxDepth and lockGroupMembership */
function handleMove(evt: any): boolean | void {
  const draggedEl = evt.dragged as HTMLElement
  const relatedEl = evt.related as HTMLElement

  if (!relatedEl) {
    clearDropTarget()
    return true
  }

  if (draggedEl === relatedEl) {
    draggedEl.classList.add('adv-table-column-group-node--no-drop')
    clearDropTarget()
    return false
  }

  draggedEl.classList.remove('adv-table-column-group-node--no-drop')

  clearDropTarget()
  relatedEl.classList.add('adv-table-column-group-node--drop-target')
  lastDropTarget.value = relatedEl

  return true
}

/** <zh/> 拖拽 onEnd 回调——清理 DOM 状态 | <en/> Drag onEnd callback — cleans up DOM state */
function handleEnd(evt: any) {
  clearDropTarget()
  evt.item?.classList.remove('adv-table-column-group-node--no-drop')
}

function clearDropTarget() {
  if (lastDropTarget.value) {
    lastDropTarget.value.classList.remove('adv-table-column-group-node--drop-target')
    lastDropTarget.value = null
  }
}

/** <zh/> 子列表拖拽更新 | <en/> Child list drag update */
function handleChildrenUpdate(newChildren: ProcessedColumn[]) {
  columnGroupApi?.updateList(colKey.value, newChildren)
}
</script>

<template>
  <div
    class="adv-table-column-group-node"
    :data-key="colKey"
  >
    <div
      class="adv-table-column-group-node__content"
      :style="{ paddingLeft: indentPx }"
    >
      <!-- <zh/> 拖拽手柄 | <en/> Drag handle -->
      <div class="adv-table-column-group-node__drag-handle">
        <IconDrag :size="14" />
      </div>

      <!-- <zh/> 分组图标 | <en/> Group icon -->
      <span
        v-if="isGroup"
        class="adv-table-column-group-node__group-icon"
      >
        ▶
      </span>

      <!-- <zh/> 标签 / 重命名输入 | <en/> Label / rename input -->
      <ElInput
        v-if="isRenaming"
        v-model="renameValue"
        size="small"
        class="adv-table-column-group-node__rename-input"
        @blur="confirmRename"
        @keyup.enter="confirmRename"
        @keyup.escape="cancelRename"
      />
      <span
        v-else
        class="adv-table-column-group-node__label"
        :class="{ 'adv-table-column-group-node__label--group': isGroup }"
      >
        {{ colLabel }}
      </span>

      <!-- <zh/> 空分组标记 | <en/> Empty group marker -->
      <span
        v-if="isEmptyGroup"
        class="adv-table-column-group-node__empty-hint"
      >
        {{ t('table.columnGroup.emptyGroup') }}
      </span>

      <!-- <zh/> 操作按钮 | <en/> Action buttons -->
      <span class="adv-table-column-group-node__actions">
        <!-- <zh/> 重命名（仅分组且允许） | <en/> Rename (group only and allowed) -->
        <ElIcon
          v-if="isGroup && columnGroupApi?.options.value.allowRename && !isRenaming"
          class="adv-table-column-group-node__action-btn"
          :size="14"
          :title="t('table.columnGroup.renameGroup')"
          @click.stop="startRename"
        >
          <Edit />
        </ElIcon>
        <!-- <zh/> 删除（仅空分组且允许） | <en/> Delete (empty group only and allowed) -->
        <ElIcon
          v-if="isEmptyGroup && columnGroupApi?.options.value.allowDeleteGroup"
          class="adv-table-column-group-node__action-btn adv-table-column-group-node__action-btn--danger"
          :size="14"
          :title="t('table.columnGroup.deleteGroup')"
          @click.stop="handleDelete"
        >
          <Close />
        </ElIcon>
      </span>
    </div>

    <!-- <zh/> 分组子节点（递归渲染） | <en/> Group child nodes (recursive rendering) -->
    <VueDraggable
      v-if="isGroup && col.children"
      :model-value="col.children"
      class="adv-table-column-group-node__children"
      :animation="DRAG_ANIMATION_MS"
      ghost-class="adv-table-column-group-node--ghost"
      chosen-class="adv-table-column-group-node--chosen"
      handle=".adv-table-column-group-node__drag-handle"
      :group="COLUMN_GROUP_DRAG_GROUP"
      :on-move="handleMove"
      :on-end="handleEnd"
      @update:model-value="handleChildrenUpdate($event as ProcessedColumn[])"
    >
      <ColumnGroupNode
        v-for="child in col.children"
        :key="getColumnKey(child)"
        :col="child"
        :depth="(depth ?? 0) + 1"
      />
    </VueDraggable>
  </div>
</template>
