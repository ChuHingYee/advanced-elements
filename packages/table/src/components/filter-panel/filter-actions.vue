<!--
  @component FilterActions
  @displayName 筛选操作按钮
  @displayName Filter Actions
  @description <zh/> 筛选面板底部操作按钮（Reset / Confirm），从 column-filter-form 拆出，4 种筛选类型的操作按钮完全一致
  @description <en/> Filter panel bottom action buttons (Reset / Confirm), extracted from column-filter-form, consistent across all 4 filter types
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script lang="ts" setup>
import { ElButton } from 'element-plus'

defineProps<{
  t: (key: string) => string
}>()

defineEmits<{
  (e: 'reset'): void
  (e: 'confirm'): void
}>()
</script>

<template>
  <div class="adv-table-filter-panel__actions">
    <ElButton
      size="small"
      @click="$emit('reset')"
    >
      {{ t('table.filter.reset') || 'Reset' }}
    </ElButton>
    <ElButton
      type="primary"
      size="small"
      @click="$emit('confirm')"
    >
      {{ t('table.filter.confirm') || 'Confirm' }}
    </ElButton>
  </div>
</template>
