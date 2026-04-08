<!--
  @component CellSelectEditor
  @displayName 下拉选择编辑器
  @displayName Select Editor
  @description <zh/> 基于 ElSelect 封装的下拉选择编辑器，用于表格单元格编辑模式下的单选/多选
  @description <en/> Select editor based on ElSelect, for single/multi-select in table cell edit mode
  @category 数据录入 | Data Entry
  @extends ElSelect
  @since 1.0.0
-->
<script setup lang="ts">
import { ElOption, ElSelect } from 'element-plus'
import { onMounted, ref } from 'vue'
import { useEditorKeyboard } from '../../composables/editing/use-editor-keyboard'

defineOptions({ name: 'CellSelectEditor' })

const props = defineProps<{
  /** <zh/> 编辑器参数 | <en/> Editor parameters */
  editorParams: Record<string, any>
  /** <zh/> Home/End 键回调 | <en/> Home/End key callback */
  onHomeEnd?: (key: 'Home' | 'End') => { rowIndex: number, columnKey: string, prop: string } | null
  /** <zh/> 校验当前值（不提交），供 trigger: 'change' 时调用 | <en/> Validate current value (without submitting), called for trigger: 'change' */
  onValidate?: () => Promise<void>
  /** <zh/> 校验触发时机：'blur'（默认）| 'change' | 'input' | <en/> Validation trigger timing: 'blur' (default) | 'change' | 'input' */
  validateTrigger?: 'blur' | 'change' | 'input'
}>()

const emit = defineEmits<{
  /** <zh/> 停止编辑，commit 表示是否提交，reason 为停止原因 | <en/> Stop editing, commit indicates whether to submit, reason is the reason */
  (e: 'stopEditing', commit: boolean, reason?: string): void
}>()

/** <zh/> 编辑器的当前值（v-model 双向绑定；单选为选项值，多选为选项值数组） | <en/> Editor current value (v-model two-way binding; option value, or array of option values when multiple) */
const modelValue = defineModel<unknown>()

const selectRef = ref<InstanceType<typeof ElSelect>>()

const { handleKeydown, handleBlur, markCommitted } = useEditorKeyboard(
  (commit, reason) => emit('stopEditing', commit, reason),
  { enterCommits: true, onHomeEnd: props.onHomeEnd },
)

onMounted(() => {
  selectRef.value?.focus()
})

function handleChange(val: any) {
  modelValue.value = val
  if (props.validateTrigger === 'change') {
    props.onValidate?.()
  }
  if (!Array.isArray(val)) {
    markCommitted()
    emit('stopEditing', true)
  }
}

defineExpose({
  /** <zh/> 使下拉选择编辑器获得焦点 | <en/> Focus the select editor */
  focus: () => selectRef.value?.focus(),
  /** <zh/> 获取编辑器当前绑定值（ElSelect 内部 modelValue） | <en/> Get the editor's current bound value (ElSelect internal modelValue) */
  getValue: () => selectRef.value?.modelValue,
})
</script>

<template>
  <ElSelect
    ref="selectRef"
    :model-value="modelValue"
    size="small"
    clearable
    v-bind="editorParams?.componentProps"
    :multiple="editorParams?.multiple"
    :filterable="editorParams?.filterable"
    @update:model-value="modelValue = $event"
    @change="handleChange"
    @keydown="handleKeydown"
    @blur="handleBlur"
  >
    <ElOption
      v-for="opt in editorParams?.options ?? []"
      :key="opt.value"
      :label="opt.label"
      :value="opt.value"
    />
  </ElSelect>
</template>
