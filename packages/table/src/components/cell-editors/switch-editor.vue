<!--
  @component CellSwitchEditor
  @displayName 开关编辑器
  @displayName Switch Editor
  @description <zh/> 基于 ElSwitch 封装的开关编辑器，用于表格单元格编辑模式，值变更时自动提交
  @description <en/> Switch editor based on ElSwitch, for table cell edit mode, auto-submits on value change
  @category 数据录入 | Data Entry
  @extends ElSwitch
  @since 1.0.0
-->
<script setup lang="ts">
import { ElSwitch } from 'element-plus'
import { onMounted, ref } from 'vue'
import { useEditorKeyboard } from '../../composables/editing/use-editor-keyboard'

defineOptions({ name: 'CellSwitchEditor' })

/**
 * <zh/> Props 定义
 * <en/> Props definition
 */
const props = defineProps<{
  /** <zh/> 编辑器额外参数，会透传至 ElSwitch | <en/> Editor extra params, passed through to ElSwitch */
  editorParams: Record<string, any>
  /** <zh/> Home/End 键回调 | <en/> Home/End key callback */
  onHomeEnd?: (key: 'Home' | 'End') => { rowIndex: number, columnKey: string, prop: string } | null
  /** <zh/> 校验当前值（不提交），供 trigger: 'change' 时调用 | <en/> Validate current value (without submitting), called for trigger: 'change' */
  onValidate?: () => Promise<void>
  /** <zh/> 校验触发时机：'blur'（默认）| 'change' | <en/> Validation trigger timing: 'blur' (default) | 'change' */
  validateTrigger?: 'blur' | 'change'
}>()

/**
 * <zh/> 事件定义
 * <en/> Events definition
 */
const emit = defineEmits<{
  (e: 'stopEditing', commit: boolean, reason?: string): void
}>()

/** <zh/> 开关绑定值（v-model 双向绑定，与 ElSwitch 值域一致） | <en/> Switch binding value (v-model two-way binding, same domain as ElSwitch) */
const modelValue = defineModel<boolean | string | number>()

const switchRef = ref<InstanceType<typeof ElSwitch>>()

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

onMounted(() => {
  switchRef.value?.focus()
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
  /** <zh/> 使开关编辑器获得焦点 | <en/> Focus the switch editor */
  focus: () => switchRef.value?.focus(),
  /** <zh/> 获取编辑器当前绑定值（ElSwitch 内部 modelValue） | <en/> Get the editor's current bound value (ElSwitch internal modelValue) */
  getValue: () => switchRef.value?.modelValue,
})
</script>

<template>
  <ElSwitch
    ref="switchRef"
    :model-value="modelValue"
    size="small"
    v-bind="editorParams?.componentProps"
    @update:model-value="modelValue = $event"
    @change="handleChange"
    @keydown="handleKeydown"
    @blur="handleBlur"
  />
</template>
