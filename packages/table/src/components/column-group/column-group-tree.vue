<!--
  @component ColumnGroupTree
  @displayName 列组管理可拖拽树
  @displayName Column Group Tree
  @description <zh/> 渲染列树的根级列表，支持根级拖拽排序和创建根级分组，子节点通过 ColumnGroupNode 递归渲染
  @description <en/> Renders root-level column tree list, supports root drag sorting and creating root groups, child nodes rendered recursively via ColumnGroupNode
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script setup lang="ts">
import type { ProcessedColumn } from '../../types'
import { Plus } from '@element-plus/icons-vue'
import { ElButton, ElIcon, ElScrollbar } from 'element-plus'
import { computed, inject, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { DRAG_ANIMATION_MS } from '../../constants'
import { useAdvLocale } from '../../locale'
import { advTableColumnGroupKey } from '../../types/injection-keys'
import { getColumnKey } from '../../utils/shared'
import ColumnGroupNode from './column-group-node.vue'

const columnGroupApi = inject(advTableColumnGroupKey, undefined)

/**
 * <zh/> 列树空数组常量 — 当 columnGroupApi 未注入时作为 fallback。
 * <en/> Empty column-tree constant, used as fallback when columnGroupApi is not injected.
 * <zh/> 不使用 Object.freeze 以兼容 VueDraggable modelValue 的 mutable 类型约束。
 * <en/> Object.freeze is not used to satisfy VueDraggable's mutable modelValue type constraint.
 */
const EMPTY_TREE: ProcessedColumn[] = []

/** <zh/> 当前列树（防御 columnGroupApi 未注入场景，确保 modelValue 始终为数组） | <en/> current column tree (guards against un-injected columnGroupApi, ensures modelValue is always an array) */
const tree = computed(() => columnGroupApi?.configTree.value ?? EMPTY_TREE)

const { t } = useAdvLocale()

/** <zh/> 上一个 drop 目标 DOM 引用 | <en/> previous drop target DOM reference */
const lastDropTarget = ref<HTMLElement | null>(null)

/** <zh/> 拖拽 onMove 回调 | <en/> drag onMove callback */
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

/** <zh/> 拖拽 onEnd 回调 | <en/> drag onEnd callback */
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

/** <zh/> 根级列表拖拽更新 | <en/> root-level list drag update */
function handleRootUpdate(newChildren: ProcessedColumn[]) {
  columnGroupApi?.updateList(null, newChildren)
}

/** <zh/> 创建根级分组 | <en/> create root-level group */
function handleCreateRootGroup() {
  columnGroupApi?.createGroup(null, columnGroupApi?.configTree.value.length ?? 0)
}
</script>

<template>
  <div class="adv-table-column-group-tree">
    <ElScrollbar class="adv-table-column-group-tree__scrollbar">
      <VueDraggable
        :model-value="tree"
        class="adv-table-column-group-tree__list"
        :animation="DRAG_ANIMATION_MS"
        ghost-class="adv-table-column-group-node--ghost"
        chosen-class="adv-table-column-group-node--chosen"
        handle=".adv-table-column-group-node__drag-handle"
        :group="{ name: 'column-group-tree', put: true }"
        :on-move="handleMove"
        :on-end="handleEnd"
        @update:model-value="handleRootUpdate($event as ProcessedColumn[])"
      >
        <ColumnGroupNode
          v-for="col in tree"
          :key="getColumnKey(col)"
          :col="col"
          :depth="0"
        />
      </VueDraggable>
    </ElScrollbar>

    <!-- 创建分组按钮 | Create group button -->
    <div
      v-if="columnGroupApi?.options.value.allowCreateGroup"
      class="adv-table-column-group-tree__footer"
    >
      <ElButton
        text
        size="small"
        @click="handleCreateRootGroup"
      >
        <ElIcon class="adv-table-column-group-tree__add-icon">
          <Plus />
        </ElIcon>
        {{ t('table.columnGroup.createGroup') }}
      </ElButton>
    </div>
  </div>
</template>
