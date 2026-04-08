<!--
  @component CellTextEditor
  @displayName 文本编辑器
  @displayName Text Editor
  @description <zh/> 基于 ElInput 封装的文本编辑器，用于表格单元格编辑模式，支持 textarea 多行模式和 maxlength 限制
  @description <en/> Text editor based on ElInput, for table cell edit mode, supports textarea multi-line mode and maxlength limit
  @category 数据录入 | Data Entry
  @extends ElInput
  @since 1.0.0
-->
<script setup lang="ts">
import { ElInput } from 'element-plus'
import { onMounted, ref } from 'vue'
import { useEditorKeyboard } from '../../composables/editing/use-editor-keyboard'
import { EP_ANY_INPUT_CLEAR_SELECTOR } from '../../utils/ep-selectors'

defineOptions({ name: 'CellTextEditor' })

const props = defineProps<{
  /** <zh/> 编辑器参数，透传给底层 ElInput | <en/> Editor params, passed through to ElInput */
  editorParams: Record<string, any>
  /** <zh/> Home/End 键回调 | <en/> Home/End key callback */
  onHomeEnd?: (key: 'Home' | 'End') => { rowIndex: number, columnKey: string, prop: string } | null
  /** <zh/> 校验当前值（不提交），供 trigger: 'input'/'change' 时调用 | <en/> Validate current value (without submitting), called for trigger: 'input'/'change' */
  onValidate?: () => Promise<void>
  /** <zh/> 校验触发时机：'blur'（默认）| 'change' | 'input' | <en/> Validation trigger timing: 'blur' (default) | 'change' | 'input' */
  validateTrigger?: 'blur' | 'change' | 'input'
}>()

const emit = defineEmits<{
  /** <zh/> 停止编辑，commit 表示是否提交，reason 为停止原因 | <en/> Stop editing, commit indicates whether to submit, reason is the reason */
  (e: 'stopEditing', commit: boolean, reason?: string): void
}>()

/** <zh/> 编辑值（v-model 双向绑定，与 ElInput 值域一致） | <en/> Edit value (v-model two-way binding, same domain as ElInput) */
const modelValue = defineModel<string>()

const inputRef = ref<InstanceType<typeof ElInput>>()

const { handleKeydown, handleBlur } = useEditorKeyboard(
  (commit, reason) => emit('stopEditing', commit, reason),
  { skipEnter: !!props.editorParams?.textarea, onHomeEnd: props.onHomeEnd },
)

onMounted(() => {
  inputRef.value?.focus()
})

function handleWrapperMousedown(e: MouseEvent) {
  const target = e.target as HTMLElement
  // <zh/> 同 number-editor：EP BEM 主题类防御性使用，点击清空按钮时保持焦点；
  // <zh/> 命名空间无关的子串匹配（见 ep-selectors.ts 注记），失配回退默认行为（见 number-editor.vue 注释）。
  // <en/> Same as number-editor: defensive EP BEM classes to keep focus on clear-button
  // <en/> clicks; namespace-agnostic substring matching (see the ep-selectors.ts note),
  // <en/> mismatches fall back to default behavior (see number-editor.vue).
  if (target.closest(EP_ANY_INPUT_CLEAR_SELECTOR)) {
    e.preventDefault()
  }
}

function handleInput(val: string) {
  modelValue.value = val
  if (props.validateTrigger === 'input') {
    props.onValidate?.()
  }
}

function handleChange(_val: string) {
  if (props.validateTrigger === 'change') {
    props.onValidate?.()
  }
}

defineExpose({
  /** <zh/> 使文本编辑器获得焦点 | <en/> Focus the text editor */
  focus: () => inputRef.value?.focus(),
  /** <zh/> 获取编辑器当前绑定值（ElInput 内部 modelValue） | <en/> Get the editor's current bound value (ElInput internal modelValue) */
  getValue: () => inputRef.value?.modelValue,
})
</script>

<template>
  <!-- <zh/> data-* 聚焦锚点（同 number-editor） | <en/> data-* focus anchor (same as number-editor) -->
  <div
    data-adv-editor="text"
    @mousedown="handleWrapperMousedown"
  >
    <ElInput
      ref="inputRef"
      :model-value="modelValue"
      size="small"
      clearable
      v-bind="editorParams?.componentProps"
      :maxlength="editorParams?.maxlength"
      :type="editorParams?.textarea ? 'textarea' : 'text'"
      @input="handleInput"
      @change="handleChange"
      @keydown="handleKeydown"
      @blur="handleBlur"
    />
  </div>
</template>
