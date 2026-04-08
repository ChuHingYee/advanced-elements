<!--
  @component CellNumberEditor
  @displayName 数字编辑器
  @displayName Number Editor
  @description <zh/> 基于 ElInputNumber 封装的数字编辑器，用于表格单元格编辑模式，支持精度、步长、最小值/最大值约束
  @description <en/> Number editor based on ElInputNumber, for table cell edit mode, supports precision, step, min/max constraints
  @category 数据录入 | Data Entry
  @extends ElInputNumber
  @since 1.0.0
-->
<script setup lang="ts">
import { ElInputNumber } from 'element-plus'
import { onMounted, ref } from 'vue'
import { useEditorKeyboard } from '../../composables/editing/use-editor-keyboard'
import { EP_ANY_INPUT_STEPPER_SELECTOR } from '../../utils/ep-selectors'

defineOptions({ name: 'CellNumberEditor' })

const props = defineProps<{
  /** <zh/> 编辑器参数 | <en/> Editor parameters */
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

/** <zh/> 编辑器的绑定值（v-model 双向绑定，与 ElInputNumber 值域一致） | <en/> Editor bound value (v-model two-way binding, same domain as ElInputNumber) */
const modelValue = defineModel<number>()

const inputRef = ref<InstanceType<typeof ElInputNumber>>()

const { handleKeydown, handleBlur } = useEditorKeyboard(
  (commit, reason) => emit('stopEditing', commit, reason),
  { onHomeEnd: props.onHomeEnd },
)

onMounted(() => {
  inputRef.value?.focus()
})

function handleWrapperMousedown(e: MouseEvent) {
  const target = e.target as HTMLElement
  // <zh/> 刻意使用 EP BEM 主题类（theme-chalk 公开契约，跨 minor 稳定）：点击步进器时阻止 mousedown
  // <zh/> 默认行为以保持输入框焦点。命名空间无关的子串匹配（见 ep-selectors.ts 注记），任意前缀命中；
  // <zh/> 类名失配时仅回退为默认浏览器行为，无崩溃、无误聚焦，故不引入运行时探测。
  // <en/> EP BEM theme classes are used deliberately (public theme-chalk contract, stable
  // <en/> across minors): preventDefault on stepper mousedown keeps input focus. Namespace-agnostic
  // <en/> substring matching (see the ep-selectors.ts note) hits any prefix; a class mismatch merely
  // <en/> falls back to default browser behavior — no crash risk.
  if (target.closest(EP_ANY_INPUT_STEPPER_SELECTOR)) {
    e.preventDefault()
  }
}

function handleUpdate(val: number | undefined) {
  modelValue.value = val
  if (props.validateTrigger === 'change' || props.validateTrigger === 'input') {
    props.onValidate?.()
  }
}

defineExpose({
  /** <zh/> 使数字编辑器获得焦点 | <en/> Focus the number editor */
  focus: () => inputRef.value?.focus(),
  /** <zh/> 获取编辑器当前绑定值（ElInputNumber 内部 modelValue） | <en/> Get the editor's current bound value (ElInputNumber internal modelValue) */
  getValue: () => inputRef.value?.modelValue,
})
</script>

<template>
  <!-- <zh/> data-* 聚焦锚点——调用方优先按锚点查找输入框，不再依赖 EP 类名嗅探 | <en/> data-* focus anchor — callers locate the input via the anchor first, no EP class sniffing -->
  <div
    data-adv-editor="number"
    @mousedown="handleWrapperMousedown"
  >
    <ElInputNumber
      ref="inputRef"
      :model-value="modelValue"
      size="small"
      controls-position="right"
      v-bind="editorParams?.componentProps"
      :min="editorParams?.min"
      :max="editorParams?.max"
      :step="editorParams?.step"
      :precision="editorParams?.precision"
      @update:model-value="handleUpdate"
      @keydown="handleKeydown"
      @blur="handleBlur"
    />
  </div>
</template>
