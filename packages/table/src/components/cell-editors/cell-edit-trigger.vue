<!--
  @component CellEditTrigger
  @displayName 单元格编辑触发器
  @displayName Cell Edit Trigger
  @description <zh/> 单元格编辑触发器组件，管理编辑器的挂载/卸载生命周期、焦点管理、校验错误展示、键盘导航等
  @description <en/> Cell edit trigger component, manages editor mount/unmount lifecycle, focus management, validation error display, keyboard navigation, etc.
  @category 数据录入 | Data Entry
  @since 1.0.0
-->
<script lang="ts">
import type { Component, PropType } from 'vue'
import type { ProcessedColumn } from '../../types/column'
import type { CellEditorParams, CellEditorType, ValidateError } from '../../types/edit'
import { ElPopover, ElTooltip } from 'element-plus'
import { computed, defineComponent, h, inject, nextTick, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue'
import { advTableEditKey, advTableKey, advTableValidateErrorsKey } from '../../types/injection-keys'
import { devWarn } from '../../utils/dev-warn'
import { isBrowser } from '../../utils/env'
import { getColumnKey } from '../../utils/shared'
import { resolveEditor } from './editor-factory'

/**
 * <zh/> 编辑器实例接口 — 合并 CellEditorExpose 与 CellEditorLifecycle 中本组件实际依赖的方法/属性，用于 editorRef 的类型约束
 * <en/> Editor instance interface — merges methods/properties from CellEditorExpose and CellEditorLifecycle that this component actually depends on, used for editorRef type constraint
 */
interface CellEditorTriggerInstance {
  /** <zh/> 编辑器获得焦点 | <en/> Focus the editor */
  focus: () => void
  /** <zh/> 编辑器挂载后调用，返回 true 取消编辑 | <en/> Called after the editor mounts, returns true to cancel editing */
  isCancelBeforeStart?: () => boolean
  /** <zh/> 提交前调用，返回 true 取消提交 | <en/> Called before commit, returns true to cancel the commit */
  isCancelAfterEnd?: () => boolean
  /** <zh/> 编辑器根 DOM 元素（用于 fallback focus 逻辑） | <en/> Editor root DOM element (used by the fallback focus logic) */
  $el?: HTMLElement
}

export default defineComponent({
  name: 'CellEditTrigger',
  props: {
    /** <zh/> 编辑器组件定义，可以是内置编辑器名称（如 'text'、'select'）、组件对象或 CellEditorType | <en/> Editor component definition, can be built-in editor name (e.g., 'text', 'select'), component object, or CellEditorType */
    editor: { type: [String, Object, Function] as PropType<CellEditorType | string | Component>, required: true },
    /**
     * <zh/> 当前编辑值，支持 v-model 双向绑定
     * <en/> Current edit value, supports v-model two-way binding
     * @remarks
     * <zh/> 值类型由具体编辑器决定（string/number/boolean/Date/对象等），运行时无法用单一构造器表达，故关闭运行时类型检查并以 unknown 推导
     * <en/> Value type is determined by the specific editor (string/number/boolean/Date/object, etc.), cannot be expressed with a single constructor at runtime, so runtime type checking is disabled and inferred as unknown
     * Note: polymorphic-model-value — Vue 运行时类型系统不支持联合构造器表达任意值类型 | Vue's runtime type system doesn't support union constructors expressing arbitrary value types
     */
    modelValue: { type: null as unknown as PropType<unknown>, required: true },
    /**
     * <zh/> 当前行数据
     * <en/> Current row data
     * @remarks
     * <zh/> 行结构由业务方定义，泛型 T 在运行时不可得，使用 Record<string, unknown> 保留基础类型安全
     * <en/> Row structure is defined by the business, generic T is unavailable at runtime, uses Record<string, unknown> to preserve basic type safety
     */
    row: { type: Object as PropType<Record<string, unknown>>, required: true },
    /** <zh/> 当前行索引 | <en/> Current row index */
    rowIndex: { type: Number, required: true },
    /** <zh/> 当前列配置 | <en/> Current column config */
    column: { type: Object as PropType<ProcessedColumn>, required: true },
    /** <zh/> 编辑器额外参数，可为对象或返回对象的函数（接收 { row, rowIndex, column }） | <en/> Editor extra params, can be an object or a function returning an object (receives { row, rowIndex, column }) */
    editorParams: {
      type: [Object, Function] as PropType<CellEditorParams | ((params: { row: Record<string, unknown>, rowIndex: number, column: ProcessedColumn }) => CellEditorParams)>,
      required: true,
    },
    /** <zh/> 自定义弹窗渲染组件（cellEditorPopup 模式下替代默认编辑器） | <en/> Custom popup renderer component (replaces default editor in cellEditorPopup mode) */
    popupRenderer: { type: [Object, Function] as PropType<Component>, default: undefined },
    /** <zh/> 校验当前值（不提交），直传时优先于 editApi.validateCurrentValue | <en/> Validate current value (without submitting), direct prop takes precedence over editApi.validateCurrentValue */
    onValidate: { type: Function as PropType<() => Promise<void>>, default: undefined },
    /** <zh/> 校验触发时机，直传时优先于 column.editorRules.trigger | <en/> Validation trigger timing, direct prop takes precedence over column.editorRules.trigger */
    validateTrigger: { type: String as PropType<string>, default: undefined },
  },
  emits: {
    /** <zh/> 更新模型值（v-model 响应） | <en/> Update model value (v-model response) */
    'update:modelValue': null,
    /** <zh/> 停止编辑，参数依次为：commit（boolean，是否提交）、reason（string，停止原因，如 'cancelBeforeStart'、'cancelAfterEnd' 等） | <en/> Stop editing, params: commit (boolean, whether to submit), reason (string, stop reason, e.g., 'cancelBeforeStart', 'cancelAfterEnd', etc.) */
    'stopEditing': null,
  },
  setup(props, { emit }) {
    const editorRef = ref<CellEditorTriggerInstance | null>(null)
    const wrapperRef = ref<HTMLElement>()
    const resolvedEditor = computed(() => resolveEditor(props.editor))

    let focusRaf: number | null = null
    function cancelFocusRaf(): void {
      if (focusRaf != null) {
        cancelAnimationFrame(focusRaf)
        focusRaf = null
      }
    }
    /** <zh/> 标记编辑是否已显式停止，避免 onBeforeUnmount 重复触发 stopEditing | <en/> Marks whether editing has been explicitly stopped, prevents onBeforeUnmount from triggering stopEditing repeatedly */
    let editStopped = false

    const errors = inject(advTableValidateErrorsKey, ref([]))
    const editApi = inject(advTableEditKey, null)
    /**
     * <zh/> 表格上下文在 setup 顶层一次性注入——`inject` 必须在 setup 同步链调用，
     * <zh/> 写在 `computed` 回调内会在首次求值后因 currentInstance 清空而回退 undefined，
     * <zh/> 导致排序/筛选后错误定位只能走 rowIndex 而错位。
     * <en/> Inject the table context once at setup top level — `inject` must run in the
     * <en/> setup sync chain; inside a `computed` callback it falls back to undefined after
     * <en/> the first evaluation (currentInstance is cleared), misplacing errors by rowIndex
     * <en/> after sort/filter.
     */
    const tableCtx = inject(advTableKey, undefined)

    const errorMessage = computed(() => {
      const columnKey = getColumnKey(props.column)
      // 查找列级错误（含结构化跨字段错误）
      // 优先用 rowKey 匹配（排序/筛选后仍可定位），回退到 rowIndex
      // Find column-level errors (including structured cross-field errors)
      // Prefer rowKey matching (still locates after sort/filter), fall back to rowIndex
      const rowKeyFn = tableCtx?.rowKeyMeta?.value?.keyFn
      const rk = rowKeyFn ? rowKeyFn(props.row) : undefined
      const colError = errors.value.find(
        (e: ValidateError) => (rk != null && e.rowKey != null ? e.rowKey === rk : e.rowIndex === props.rowIndex) && e.columnKey === columnKey,
      )
      return colError?.message || ''
    })

    const resolvedEditorParams = computed(() => {
      const editorParamsValue = props.editorParams
      if (typeof editorParamsValue === 'function') {
        return editorParamsValue({ row: props.row, rowIndex: props.rowIndex, column: props.column })
      }
      return editorParamsValue ?? {}
    })

    onMounted(() => {
      nextTickFocusWithRetry(3)
      nextTick(() => {
        if (editorRef.value && typeof editorRef.value.isCancelBeforeStart === 'function') {
          if (editorRef.value.isCancelBeforeStart()) {
            handleStopEditing(false, 'cancelBeforeStart')
          }
        }
      })
    })

    onBeforeUnmount(() => {
      cancelFocusRaf()
      /**
       * <zh/> 虚拟滚动行回收时，CellEditTrigger 随 VNode 卸载
       * <en/> When virtual scroll row is recycled, CellEditTrigger is unmounted with the VNode
       * @remarks
       * <zh/> 若编辑尚未显式提交/取消（editStopped=false），自动提交以保留用户输入，
       * 避免 isCellEditing 残留导致行滚回视图时编辑器重新挂载但焦点/光标/选区丢失
       * <en/> If editing hasn't been explicitly committed/cancelled (editStopped=false), auto-commit to preserve user input,
       * avoid isCellEditing residual causing editor to remount when row scrolls back but focus/cursor/selection is lost
       *
       * <zh/> fullRow 模式下 onStopEditing 为 undefined（createStopEditingHandler 返回 undefined），
       * emit 无监听者故为空操作，不影响全行编辑状态（由 getCellEditingValue 守卫）
       * <en/> In fullRow mode, onStopEditing is undefined (createStopEditingHandler returns undefined),
       * emit has no listener so it's a no-op, doesn't affect full row editing state (guarded by getCellEditingValue)
       */
      if (!editStopped) {
        emit('stopEditing', true, 'unmount')
      }
    })

    // KeepAlive 停靠不走 unmount：悬挂的聚焦重试 rAF 同样需要取消
    onDeactivated(() => {
      cancelFocusRaf()
    })

    function tryFocusOnce(): boolean {
      if (editorRef.value && typeof editorRef.value.focus === 'function') {
        try {
          editorRef.value.focus()
          // <zh/> focus 返回 void，无法通过返回值判断成功；以 activeElement 校验（SSR 下无 document，直接视为成功交由后续重试链处理）
          // <en/> focus returns void, success checked via activeElement (no document under SSR — treat as success and let the retry chain proceed)
          const active = isBrowser ? document.activeElement as HTMLElement | null : null
          if (active && (active === editorRef.value.$el || editorRef.value.$el?.contains(active) || active.closest('[data-adv-editor]'))) {
            return true
          }
          // 无 activeElement 守卫时认为调用即成功（编辑器内部可能异步聚焦）
          return true
        }
        catch {
          return false
        }
      }
      if (editorRef.value && editorRef.value.$el) {
        const root = editorRef.value.$el as HTMLElement
        const input = root.querySelector<HTMLElement>('[data-adv-editor] input, [data-adv-editor] textarea')
          ?? root.querySelector<HTMLElement>('input,textarea,button,[tabindex]')
        if (input) {
          try {
            input.focus()
            return isBrowser ? document.activeElement === input : true
          }
          catch {
            return false
          }
        }
      }
      return false
    }

    /**
     * <zh/> 带重试的聚焦链——虚拟滚动下编辑器 DOM 可能尚未挂载或未在视口，
     * <zh/> 单次 nextTick+rAF 可能取不到焦点。重试 3 次：nextTick→rAF→校验，失败则继续下一轮，
     * <zh/> 耗尽后 devWarn 提示"focus retry exhausted"。
     * <en/> Focus retry chain  — virtual scroll may not have mounted editor DOM or it's outside viewport,
     * <en/> single nextTick+rAF may miss. Retry 3 times: nextTick→rAF→check, exhausted devWarn "focus retry exhausted".
     */
    function nextTickFocusWithRetry(retries = 3) {
      let attempt = 0
      const run = () => {
        nextTick(() => {
          focusRaf = requestAnimationFrame(() => {
            focusRaf = null
            const ok = tryFocusOnce()
            if (!ok && attempt < retries - 1) {
              attempt++
              run()
            }
            else if (!ok) {
              devWarn(
                `CellEditTrigger focus retry exhausted after ${retries} attempts for column "${getColumnKey(props.column)}" at rowIndex ${props.rowIndex}. `
                + 'Editor DOM may be outside the virtual viewport or not yet mounted.',
              )
            }
          })
        })
      }
      run()
    }

    async function handleStopEditing(commit: boolean, reason?: string) {
      if (editStopped)
        return
      // <zh/> commit=false（取消）时立即标记 editStopped，防止后续 blur/unmount 重复触发 |
      // <en/> commit=false (cancel) immediately marks editStopped to prevent duplicate blur/unmount triggers
      // <zh/> commit=true（提交）时不标记 editStopped——block 模式下校验失败会保持编辑状态，
      // <zh/> 用户修正值后需要能再次提交。useEditorKeyboard 的 committed 标记已防止 blur 重复触发 |
      // <en/> commit=true (submit) does NOT mark editStopped — in block mode, validation failure keeps editing active;
      // <en/> the user needs to re-submit after correcting. useEditorKeyboard's committed flag already prevents duplicate blur triggers
      if (!commit) {
        editStopped = true
      }
      if (commit && editorRef.value && typeof editorRef.value.isCancelAfterEnd === 'function') {
        if (editorRef.value.isCancelAfterEnd()) {
          editStopped = true
          emit('stopEditing', false, 'cancelAfterEnd')
          return
        }
      }
      emit('stopEditing', commit, reason)
    }

    function onHomeEnd(key: 'Home' | 'End') {
      if (!editApi)
        return null
      const rowIndex = props.rowIndex
      if (key === 'Home' && editApi.findFirstEditableCell) {
        return editApi.findFirstEditableCell(rowIndex)
      }
      if (key === 'End' && editApi.findLastEditableCell) {
        return editApi.findLastEditableCell(rowIndex)
      }
      return null
    }

    return () => {
      const trigger = props.validateTrigger ?? props.column?.editorRules?.trigger
      const onValidateFn = props.onValidate ?? editApi?.validateCurrentValue
      const editorVNode = resolvedEditor.value
        ? h(resolvedEditor.value, {
            'ref': editorRef,
            'modelValue': props.modelValue,
            'onUpdate:modelValue': (val: unknown) => emit('update:modelValue', val),
            'row': props.row,
            'rowIndex': props.rowIndex,
            'column': props.column,
            'editorParams': resolvedEditorParams.value,
            'onStopEditing': handleStopEditing,
            'onHomeEnd': onHomeEnd,
            'onValidate': onValidateFn,
            'validateTrigger': trigger,
          })
        : h('span', { class: 'adv-table__cell-editor-error' }, 'Editor not found')

      const hasError = !!errorMessage.value

      const isPopup = !!(props.column?.cellEditorPopup || resolvedEditorParams.value?.popup)

      const wrapper = h('div', {
        ref: wrapperRef,
        class: ['adv-table__cell-editor-wrapper', { 'adv-table__cell-editor-wrapper--has-error': hasError, 'adv-table__cell-editor-wrapper--popup': isPopup }],
        onMousedown: (e: Event) => e.stopPropagation(),
        onClick: (e: Event) => e.stopPropagation(),
      }, isPopup
        ? [h('span', { class: 'adv-table__cell-editor-popup-trigger' }, String(props.modelValue ?? ''))]
        : [editorVNode])

      const tooltipVNode = h(ElTooltip, {
        virtualTriggering: true,
        virtualRef: wrapperRef.value,
        visible: hasError,
        placement: 'bottom-start',
        effect: 'light',
        popperClass: 'adv-table__cell-validate-error',
        showArrow: false,
        offset: 2,
        teleported: false,
      }, {
        content: () => errorMessage.value,
      })

      if (isPopup) {
        const popupWidth = resolvedEditorParams.value?.popupWidth
        const popupPosition = props.column?.cellEditorPopupPosition ?? resolvedEditorParams.value?.popupPosition ?? 'over'
        return [
          h(ElPopover, {
            virtualTriggering: true,
            virtualRef: wrapperRef.value,
            visible: true,
            placement: 'bottom-start',
            width: popupWidth ?? 300,
            trigger: 'click',
            popperClass: [
              'adv-table__cell-editor-popup',
              popupPosition === 'under' ? 'adv-table__cell-editor-popup--under' : 'adv-table__cell-editor-popup--over',
            ],
            showArrow: false,
            offset: popupPosition === 'under' ? 4 : 0,
            teleported: false,
          }, {
            default: () => props.popupRenderer
              ? h(props.popupRenderer, {
                  'modelValue': props.modelValue,
                  'onUpdate:modelValue': (val: unknown) => emit('update:modelValue', val),
                  'row': props.row,
                  'rowIndex': props.rowIndex,
                  'column': props.column,
                  'editorParams': resolvedEditorParams.value,
                  'onStopEditing': handleStopEditing,
                  'onHomeEnd': onHomeEnd,
                  'onValidate': onValidateFn,
                  'validateTrigger': trigger,
                })
              : editorVNode,
          }),
          wrapper,
          tooltipVNode,
        ]
      }

      return [wrapper, tooltipVNode]
    }
  },
})
</script>
