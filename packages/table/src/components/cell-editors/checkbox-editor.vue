<!--
  @component CellCheckboxEditor
  @displayName 复选框编辑器
  @displayName Checkbox Editor
  @description <zh/> 基于 ElCheckbox 封装的复选框编辑器，用于表格单元格编辑模式，值变更时自动提交
  @description <en/> Checkbox editor based on ElCheckbox, for table cell edit mode, auto-submits on value change
  @category 数据录入 | Data Entry
  @extends ElCheckbox
  @since 1.0.0
-->
<script setup lang="ts">
import { ElCheckbox } from 'element-plus'
import { onMounted, ref } from 'vue'
import { useEditorKeyboard } from '../../composables/editing/use-editor-keyboard'

defineOptions({ name: 'CellCheckboxEditor' })

const props = defineProps<CheckboxEditorProps>()

const emit = defineEmits<CheckboxEditorEmits>()

/** <zh/> 当前编辑值（v-model 双向绑定，与 ElCheckbox 值域一致） | <en/> Current value being edited (v-model two-way binding, same domain as ElCheckbox) */
const modelValue = defineModel<boolean | string | number>()

interface CheckboxEditorProps {
  /** <zh/> 编辑器参数 | <en/> Editor parameters */
  editorParams: Record<string, any>
  /** <zh/> Home/End 键按下时的定位回调 | <en/> Home/End key positioning callback */
  onHomeEnd?: (key: 'Home' | 'End') => { rowIndex: number, columnKey: string, prop: string } | null
  /** <zh/> 校验当前值（不提交），供 trigger: 'change' 时调用 | <en/> Validate current value (without submitting), called for trigger: 'change' */
  onValidate?: () => Promise<void>
  /** <zh/> 校验触发时机：'blur'（默认）| 'change' | <en/> Validation trigger timing: 'blur' (default) | 'change' */
  validateTrigger?: 'blur' | 'change'
}

interface CheckboxEditorEmits {
  /** <zh/> 停止编辑，commit 表示是否提交修改，reason 表示停止原因 | <en/> Stop editing, commit indicates whether to submit, reason indicates the reason */
  (e: 'stopEditing', commit: boolean, reason?: string): void
}

const checkboxRef = ref<any>()

/**
 * <zh/> 接入统一键盘导航——Escape 取消、Enter/Tab 提交并导航、Home/End 行首行尾
 * <en/> Integrate unified keyboard navigation — Escape cancel, Enter/Tab commit and navigate, Home/End row edges
 */
const { handleKeydown, handleBlur, markCommitted } = useEditorKeyboard(
  (commit: boolean, reason?: string) => emit('stopEditing', commit, reason),
  {
    onHomeEnd: props.onHomeEnd,
  },
)

function focusCheckbox(): void {
  const inst = checkboxRef.value as unknown as { focus?: () => void, $el?: unknown } | null | undefined
  // ElCheckbox 未 expose focus：优先调实例 focus（未来 EP 若补回），否则聚焦内部 input
  if (inst && typeof inst.focus === 'function') {
    inst.focus()
    return
  }
  try {
    const el = inst?.$el as HTMLElement | undefined
    el?.querySelector?.('input')?.focus?.()
  }
  catch {
    // 聚焦失败静默：不影响编辑功能
  }
}

onMounted(() => {
  focusCheckbox()
})

function handleChange(val: any) {
  modelValue.value = val
  if (props.validateTrigger === 'change') {
    props.onValidate?.()
  }
  markCommitted()
  emit('stopEditing', true)
}

defineExpose({
  /** <zh/> 使复选框编辑器获得焦点 | <en/> Focus the checkbox editor */
  focus: () => focusCheckbox(),
  /** <zh/> 获取编辑器当前绑定值（ElCheckbox 内部 modelValue） | <en/> Get the editor's current bound value (ElCheckbox internal modelValue) */
  getValue: () => checkboxRef.value?.modelValue,
})
</script>

<template>
  <ElCheckbox
    ref="checkboxRef"
    :model-value="modelValue"
    size="small"
    v-bind="editorParams?.componentProps"
    @update:model-value="modelValue = $event"
    @change="handleChange"
    @keydown="handleKeydown"
    @blur="handleBlur"
  />
</template>
