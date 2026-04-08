<!--
  @component ColumnGroupSidePanel
  @displayName 列组管理侧面板
  @displayName Column Group Side Panel
  @description <zh/> 以侧边栏形式展示列树的可拖拽编排面板，支持创建/删除/重命名分组、拖拽列跨层级移动
  @description <en/> Draggable column tree side panel, supports create/delete/rename groups, drag columns across levels
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script setup lang="ts">
import { Operation } from '@element-plus/icons-vue'
import { ElButton } from 'element-plus'
import { inject } from 'vue'
import { useAdvLocale } from '../../locale'
import { advTableColumnGroupKey } from '../../types/injection-keys'
import SidePanel from '../shared/side-panel.vue'
import ColumnGroupTree from './column-group-tree.vue'

defineProps<{
  /** <zh/> 面板位置 | <en/> panel position */
  position: 'left' | 'right'
}>()

const emit = defineEmits<{
  /** <zh/> 关闭面板事件 | <en/> close panel event */
  (e: 'close'): void
}>()

const columnGroupApi = inject(advTableColumnGroupKey, undefined)

const { t } = useAdvLocale()

function handleApply() {
  columnGroupApi?.applyConfig()
  emit('close')
}

function handleReset() {
  columnGroupApi?.resetConfig()
}

/** <zh/> 关闭面板 | <en/> Close panel */
function handleClose(): void {
  emit('close')
}
</script>

<template>
  <SidePanel
    :position="position"
    :title="t('table.columnGroup.title')"
    :icon="Operation"
    @close="handleClose"
  >
    <ColumnGroupTree />

    <template #footer>
      <ElButton
        size="small"
        :disabled="!columnGroupApi?.isDirty.value"
        @click="handleReset"
      >
        {{ t('table.columnGroup.reset') }}
      </ElButton>
      <ElButton
        type="primary"
        size="small"
        :disabled="!columnGroupApi?.isDirty.value"
        @click="handleApply"
      >
        {{ t('table.columnGroup.apply') }}
      </ElButton>
    </template>
  </SidePanel>
</template>
