<!--
  @component CellDatePickerEditor
  @displayName 日期选择编辑器（共享基础）
  @displayName Date Picker Editor (Shared Base)
  @description <zh/> 基于 ElDatePicker 封装的日期/日期时间编辑器，通过 pickerType 区分类型，用于表格单元格编辑模式，面板关闭时自动提交
  @description <en/> Date/datetime editor based on ElDatePicker, differentiated by pickerType, for table cell edit mode, auto-submits when panel closes
  @category 数据录入 | Data Entry
  @extends ElDatePicker
  @since 1.0.0
-->
<script setup lang="ts">
import { ElDatePicker } from 'element-plus'
import { onMounted, ref } from 'vue'
import { useEditorKeyboard } from '../../composables/editing/use-editor-keyboard'

defineOptions({ name: 'CellDatePickerEditor', inheritAttrs: false })

const props = withDefaults(defineProps<{
  /** <zh/> 编辑器参数配置，透传给 ElDatePicker。其中 componentProps 会被 v-bind 到组件上，placeholder 作为占位文本 | <en/> Editor params, passed through to ElDatePicker. componentProps v-bind to component, placeholder used as placeholder text */
  editorParams: Record<string, any>
  /** <zh/> Home/End 键回调，返回当前行与列信息，用于键盘导航 | <en/> Home/End key callback, returns current row and column info for keyboard navigation */
  onHomeEnd?: (key: 'Home' | 'End') => { rowIndex: number, columnKey: string, prop: string } | null
  /** <zh/> 日期选择器类型：'date' 为日期，'datetime' 为日期时间 | <en/> Date picker type: 'date' for date, 'datetime' for datetime */
  pickerType?: 'date' | 'datetime'
}>(), {
  pickerType: 'date',
})

const emit = defineEmits<{
  /** <zh/> 结束编辑。commit=true 表示确认编辑内容，false 为取消；reason 附加结束原因 | <en/> End editing. commit=true confirms changes, false cancels; reason provides additional context */
  (e: 'stopEditing', commit: boolean, reason?: string): void
}>()

/** <zh/> 日期值（v-model 双向绑定，与 ElDatePicker 值域一致） | <en/> Date value (v-model two-way binding, same domain as ElDatePicker) */
const modelValue = defineModel<string | number | Date | (string | number | Date)[]>()

const pickerRef = ref<any>()

const { committed, handleKeydown, markCommitted } = useEditorKeyboard(
  (commit, reason) => emit('stopEditing', commit, reason),
  { skipEnter: true, onHomeEnd: props.onHomeEnd },
)

/** <zh/> 根据 pickerType 推导默认 placeholder | <en/> Derive default placeholder from pickerType */
const defaultPlaceholder = props.pickerType === 'datetime' ? 'Select datetime' : 'Select date'

onMounted(() => {
  pickerRef.value?.focus()
})

function handleChange(val: any) {
  modelValue.value = val
  if (!committed.value) {
    markCommitted()
    emit('stopEditing', true)
  }
}

function handleVisibleChange(visible: boolean) {
  if (!visible && !committed.value) {
    markCommitted()
    emit('stopEditing', true)
  }
}

defineExpose({
  /** <zh/> 使日期选择编辑器获得焦点 | <en/> Focus the date picker editor */
  focus: () => pickerRef.value?.focus(),
  /** <zh/> 获取编辑器当前绑定值（ElDatePicker 内部 modelValue） | <en/> Get the editor's current bound value (ElDatePicker internal modelValue) */
  getValue: () => pickerRef.value?.modelValue,
})
</script>

<template>
  <ElDatePicker
    ref="pickerRef"
    :model-value="modelValue"
    :type="pickerType"
    size="small"
    clearable
    v-bind="editorParams?.componentProps"
    :placeholder="editorParams?.placeholder ?? defaultPlaceholder"
    @update:model-value="modelValue = $event"
    @change="handleChange"
    @keydown="handleKeydown"
    @visible-change="handleVisibleChange"
  />
</template>
