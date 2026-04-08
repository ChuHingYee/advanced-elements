<!--
  @component CellDateEditor
  @displayName 日期编辑器
  @displayName Date Editor
  @description <zh/> 基于 ElDatePicker 封装的日期编辑器，用于表格单元格编辑模式，日期面板关闭时自动提交。实际逻辑由 date-picker-editor.vue 共享基础组件提供
  @description <en/> Date editor based on ElDatePicker, for table cell edit mode, auto-submits when date panel closes. Actual logic provided by shared date-picker-editor.vue base component
  @category 数据录入 | Data Entry
  @extends ElDatePicker
  @since 1.0.0
-->
<script setup lang="ts">
import DatePickerEditor from './date-picker-editor.vue'

defineOptions({ name: 'CellDateEditor' })

defineProps<{
  editorParams: Record<string, any>
  onHomeEnd?: (key: 'Home' | 'End') => { rowIndex: number, columnKey: string, prop: string } | null
}>()

const emit = defineEmits<{
  (e: 'stopEditing', commit: boolean, reason?: string): void
}>()

const modelValue = defineModel<string | number | Date | (string | number | Date)[]>()

/** <zh/> 编辑结束事件转发 | <en/> Stop editing event forwarder */
function handleStopEditing(commit: boolean, reason?: string): void {
  emit('stopEditing', commit, reason)
}
</script>

<template>
  <DatePickerEditor
    v-model="modelValue"
    :editor-params="editorParams"
    :on-home-end="onHomeEnd"
    picker-type="date"
    @stop-editing="handleStopEditing"
  />
</template>
