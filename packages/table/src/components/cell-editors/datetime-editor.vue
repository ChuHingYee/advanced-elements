<!--
  @component CellDatetimeEditor
  @displayName 日期时间编辑器
  @displayName Datetime Editor
  @description <zh/> 基于 ElDatePicker（type="datetime"）封装的日期时间编辑器，用于表格单元格编辑模式。实际逻辑由 date-picker-editor.vue 共享基础组件提供
  @description <en/> Datetime editor based on ElDatePicker (type="datetime"), for table cell edit mode. Actual logic provided by shared date-picker-editor.vue base component
  @category 数据录入 | Data Entry
  @extends ElDatePicker
  @since 1.0.0
-->
<script setup lang="ts">
import DatePickerEditor from './date-picker-editor.vue'

defineOptions({ name: 'CellDatetimeEditor' })

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
    picker-type="datetime"
    @stop-editing="handleStopEditing"
  />
</template>
