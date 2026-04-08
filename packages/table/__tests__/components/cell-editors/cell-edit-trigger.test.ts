import type { PropType } from 'vue'
/**
 * <zh/> 单元格编辑触发器单测——挂载/卸载生命周期、校验错误展示、弹窗模式与键盘导航。
 * <en/> Cell edit trigger tests — mount/unmount lifecycle, error display, popup mode, navigation.
 */
import { mount } from '@vue/test-utils'
import { ElTooltip } from 'element-plus'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, markRaw, ref } from 'vue'
import CellEditTrigger from '../../../src/components/cell-editors/cell-edit-trigger.vue'
import TextEditor from '../../../src/components/cell-editors/text-editor.vue'
import { advTableEditKey, advTableKey, advTableValidateErrorsKey } from '../../../src/types/injection-keys'
import { resetDevWarnCacheForTests } from '../../../src/utils/dev-warn'

const DummyEditor = defineComponent({
  name: 'DummyEditor',
  props: { modelValue: { type: null, required: true } },
  emits: ['update:modelValue', 'stopEditing'],
  setup(props, { emit }) {
    return () => h('input', {
      'data-testid': 'dummy-editor',
      'value': props.modelValue,
      'onInput': (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value),
      'onKeydown': (e: KeyboardEvent) => {
        if (e.key === 'Enter')
          emit('stopEditing', true)
      },
    })
  },
})

const baseProps = {
  editor: DummyEditor,
  modelValue: 'test',
  row: { id: 1 },
  rowIndex: 0,
  column: { prop: 'name', hidden: false },
  editorParams: {},
}

describe('cellEditTrigger', () => {
  it('renders with editor component', () => {
    const wrapper = mount(CellEditTrigger, { props: baseProps })
    expect(wrapper.find('[data-testid="dummy-editor"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('forwards modelValue to editor', () => {
    const wrapper = mount(CellEditTrigger, { props: { ...baseProps, modelValue: 'hello' } })
    const input = wrapper.find('[data-testid="dummy-editor"]')
    expect(input.exists()).toBe(true)
    wrapper.unmount()
  })

  it('emits stopEditing when editor emits it', async () => {
    const wrapper = mount(CellEditTrigger, { props: baseProps })
    await wrapper.find('[data-testid="dummy-editor"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('stopEditing')).toBeTruthy()
    wrapper.unmount()
  })

  it('emits update:modelValue when editor value changes', async () => {
    const wrapper = mount(CellEditTrigger, { props: baseProps })
    await wrapper.find('[data-testid="dummy-editor"]').setValue('new value')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    wrapper.unmount()
  })

  it('shows error when editor is not found', () => {
    const wrapper = mount(CellEditTrigger, { props: { ...baseProps, editor: 'non-existent-editor' } })
    expect(wrapper.text()).toContain('Editor not found')
    wrapper.unmount()
  })

  it('prevents mousedown propagation', async () => {
    // <zh/> 编辑态的 mousedown 若冒泡到行，会误触发行选中——父监听必须收不到
    // <en/> A bubbling mousedown in edit mode would mis-trigger row selection — the parent listener must stay silent
    const onParent = vi.fn()
    const wrapper = mount(defineComponent({
      setup() {
        return () => h('div', { onMousedown: onParent }, [
          h(CellEditTrigger as any, baseProps),
        ])
      },
    }))
    const div = wrapper.find('.adv-table__cell-editor-wrapper')
    expect(div.exists()).toBe(true)
    await div.trigger('mousedown')
    expect(onParent).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('prevents click propagation', async () => {
    const onParent = vi.fn()
    const wrapper = mount(defineComponent({
      setup() {
        return () => h('div', { onClick: onParent }, [
          h(CellEditTrigger as any, baseProps),
        ])
      },
    }))
    const div = wrapper.find('.adv-table__cell-editor-wrapper')
    expect(div.exists()).toBe(true)
    await div.trigger('click')
    expect(onParent).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

/**
 * <zh/> 以下用例覆盖触发器的提交/取消生命周期、错误注入、弹窗模式与导航回调。
 * <en/> The suites below cover the trigger commit/cancel lifecycle, error injection, popup, navigation.
 */
const triggerColumn = { prop: 'name', key: 'name', hidden: false }

const ProbeEditor = markRaw(defineComponent({
  name: 'ProbeEditor',
  props: {
    modelValue: { type: null, required: true },
    row: { type: Object, default: undefined },
    rowIndex: { type: Number, default: undefined },
    column: { type: Object, default: undefined },
    editorParams: { type: Object, default: undefined },
    onStopEditing: { type: Function as PropType<((commit: boolean, reason?: string) => void) | undefined>, default: undefined },
    onHomeEnd: { type: Function as PropType<((key: 'Home' | 'End') => unknown) | undefined>, default: undefined },
    onValidate: { type: Function as PropType<(() => Promise<void>) | undefined>, default: undefined },
    validateTrigger: { type: String as PropType<string | undefined>, default: undefined },
  },
  emits: ['update:modelValue', 'stopEditing'],
  setup(props, { expose }) {
    expose({ focus: () => {}, getValue: () => 'probe' })
    return () => h('div', [
      h('button', { 'data-testid': 'probe-cancel', 'onClick': () => props.onStopEditing?.(false, 'escape') }, 'cancel'),
      h('button', { 'data-testid': 'probe-commit', 'onClick': () => props.onStopEditing?.(true, 'enter') }, 'commit'),
    ])
  },
}))

function mountTrigger(extra: Record<string, unknown> = {}, provide: Record<symbol, unknown> = {}) {
  return mount(CellEditTrigger, {
    props: {
      editor: ProbeEditor,
      modelValue: 'x',
      row: { id: 1 },
      rowIndex: 0,
      column: triggerColumn,
      editorParams: {},
      ...extra,
    },
    global: { provide },
  })
}

function flushFocus() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

describe('cellEditTrigger lifecycle', () => {
  it('auto commits on unmount', async () => {
    const wrapper = mountTrigger()
    await wrapper.vm.$nextTick()
    wrapper.unmount()
    expect(wrapper.emitted('stopEditing')).toEqual([[true, 'unmount']])
  })

  it('emits once after explicit cancel then unmount', async () => {
    const wrapper = mountTrigger()
    await wrapper.findComponent({ name: 'ProbeEditor' }).vm.$emit('stopEditing', false, 'escape')
    await wrapper.vm.$nextTick()
    // <zh/> 先断言显式取消已触发，避免 unmount 清空历史后无法回溯 | <en/> Assert explicit cancel first — VTU unmount clears history before onBeforeUnmount
    expect(wrapper.emitted('stopEditing')).toEqual([[false, 'escape']])
    wrapper.unmount()
    // <zh/> VTU 2.5.1 unmount 前调用 removeEventHistory 清空历史，取消后 editStopped=true 故 unmount 无新增 emit，历史为空即证明未重复触发 | <en/> VTU 2.5.1 clears history before unmount; cancel sets editStopped so no unmount emit — empty history proves no duplicate
    expect(wrapper.emitted('stopEditing')).toBeUndefined()
  })

  it('emits again on unmount after commit', async () => {
    const wrapper = mountTrigger()
    await wrapper.findComponent({ name: 'ProbeEditor' }).vm.$emit('stopEditing', true, 'enter')
    await wrapper.vm.$nextTick()
    // <zh/> 提交不标记 editStopped（block 模式需可重提），先确认首次提交 | <en/> Commit does not mark editStopped (block mode needs re-submit), confirm first commit
    expect(wrapper.emitted('stopEditing')).toEqual([[true, 'enter']])
    wrapper.unmount()
    // <zh/> VTU 清空历史后仅保留 unmount 期间的 emit，此处为 [true, 'unmount'] 即证明第二次触发 | <en/> VTU keeps only unmount-phase emits; [true, 'unmount'] here proves the second trigger
    expect(wrapper.emitted('stopEditing')).toEqual([[true, 'unmount']])
  })

  it('cancels before start when editor vetoes', async () => {
    const editor = markRaw(defineComponent({
      name: 'VetoStartEditor',
      props: { modelValue: { type: null, required: true } },
      emits: ['update:modelValue', 'stopEditing'],
      setup(_, { expose }) {
        expose({ focus: () => {}, isCancelBeforeStart: () => true })
        return () => h('input')
      },
    }))
    const wrapper = mountTrigger({ editor })
    await flushFocus()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('stopEditing')).toEqual([[false, 'cancelBeforeStart']])
    wrapper.unmount()
  })

  it('keeps editing when before-start veto is false', async () => {
    const editor = markRaw(defineComponent({
      name: 'AllowStartEditor',
      props: { modelValue: { type: null, required: true } },
      emits: ['update:modelValue', 'stopEditing'],
      setup(_, { expose }) {
        expose({ focus: () => {}, isCancelBeforeStart: () => false })
        return () => h('input')
      },
    }))
    const wrapper = mountTrigger({ editor })
    await flushFocus()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('stopEditing')).toBeFalsy()
    wrapper.unmount()
  })

  it('cancels after end when editor vetoes commit', async () => {
    const editor = markRaw(defineComponent({
      name: 'VetoEndEditor',
      props: { modelValue: { type: null, required: true } },
      emits: ['update:modelValue', 'stopEditing'],
      setup(_, { expose }) {
        expose({ focus: () => {}, isCancelAfterEnd: () => true })
        return () => h('input')
      },
    }))
    const wrapper = mountTrigger({ editor })
    await wrapper.findComponent(editor).vm.$emit('stopEditing', true, 'enter')
    expect(wrapper.emitted('stopEditing')).toEqual([[false, 'cancelAfterEnd']])
    wrapper.unmount()
  })

  it('resolves function editorParams with cell context', async () => {
    const paramsFn = vi.fn(() => ({}))
    const wrapper = mountTrigger({
      editorParams: paramsFn,
      row: { id: 7 },
      rowIndex: 2,
    })
    await wrapper.vm.$nextTick()
    expect(paramsFn).toHaveBeenCalledWith({
      row: { id: 7 },
      rowIndex: 2,
      column: triggerColumn,
    })
    wrapper.unmount()
  })

  it('forwards validate props to the editor', async () => {
    const onValidate = vi.fn(async () => {})
    const wrapper = mountTrigger({
      editorParams: {},
      validateTrigger: undefined,
      onValidate,
    } as unknown as Record<string, unknown>)
    await wrapper.vm.$nextTick()
    const child = wrapper.findComponent({ name: 'ProbeEditor' })
    expect(child.props('onValidate')).toBe(onValidate)
    wrapper.unmount()
  })

  it('forwards value through a real text editor', async () => {
    const wrapper = mountTrigger({ editor: markRaw(TextEditor) })
    await wrapper.find('input').setValue('typed')
    expect(wrapper.emitted('update:modelValue')).toEqual([['typed']])
    wrapper.unmount()
  })
})

describe('cellEditTrigger validation errors', () => {
  it('shows error style on rowIndex match', async () => {
    const errors = ref([{ rowIndex: 0, columnKey: 'name', prop: 'name', message: 'bad' }])
    const wrapper = mountTrigger({}, { [advTableValidateErrorsKey]: errors })
    await wrapper.vm.$nextTick()
    const box = wrapper.find('.adv-table__cell-editor-wrapper--has-error')
    expect(box.exists()).toBe(true)
    wrapper.unmount()
  })

  it('matches by rowKey when table context resolves keys', async () => {
    const errors = ref([{ rowIndex: 9, rowKey: 'r1', columnKey: 'name', prop: 'name', message: 'bad' }])
    const tableCtx = { rowKeyMeta: computed(() => ({ keyFn: () => 'r1' })) }
    const wrapper = mountTrigger({ row: { id: 1 } }, {
      [advTableValidateErrorsKey]: errors,
      [advTableKey]: tableCtx,
    })
    await wrapper.vm.$nextTick()
    const box = wrapper.find('.adv-table__cell-editor-wrapper--has-error')
    expect(box.exists()).toBe(true)
    wrapper.unmount()
  })

  it('falls back to rowIndex without a key function', async () => {
    const errors = ref([{ rowIndex: 0, columnKey: 'name', prop: 'name', message: 'bad' }])
    const tableCtx = { rowKeyMeta: computed(() => ({})) }
    const wrapper = mountTrigger({}, {
      [advTableValidateErrorsKey]: errors,
      [advTableKey]: tableCtx,
    })
    await wrapper.vm.$nextTick()
    const box = wrapper.find('.adv-table__cell-editor-wrapper--has-error')
    expect(box.exists()).toBe(true)
    wrapper.unmount()
  })

  it('hides error style for other columns', async () => {
    const errors = ref([{ rowIndex: 0, columnKey: 'other', prop: 'other', message: 'bad' }])
    const wrapper = mountTrigger({}, { [advTableValidateErrorsKey]: errors })
    await wrapper.vm.$nextTick()
    const box = wrapper.find('.adv-table__cell-editor-wrapper--has-error')
    expect(box.exists()).toBe(false)
    wrapper.unmount()
  })

  it('toggles tooltip visibility with errors', async () => {
    const errors = ref([{ rowIndex: 0, columnKey: 'name', prop: 'name', message: 'bad' }])
    const wrapper = mountTrigger({}, { [advTableValidateErrorsKey]: errors })
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(ElTooltip).props('visible')).toBe(true)
    errors.value = []
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(ElTooltip).props('visible')).toBe(false)
    wrapper.unmount()
  })
})

describe('cellEditTrigger popup mode', () => {
  it('renders popup trigger text for cellEditorPopup columns', async () => {
    const wrapper = mountTrigger({
      modelValue: 'shown',
      column: { ...triggerColumn, cellEditorPopup: true },
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.adv-table__cell-editor-popup-trigger').text()).toBe('shown')
    wrapper.unmount()
  })

  it('renders popup from editorParams popup flag', async () => {
    const wrapper = mountTrigger({ editorParams: { popup: true } })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.adv-table__cell-editor-popup-trigger').exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders custom popup renderer', async () => {
    const popup = markRaw(defineComponent({
      name: 'PopupRenderer',
      props: { modelValue: { type: null, required: true } },
      emits: ['update:modelValue', 'stopEditing'],
      setup(props) {
        return () => h('button', { 'data-testid': 'popup-btn' }, String(props.modelValue))
      },
    }))
    const wrapper = mountTrigger({
      column: { ...triggerColumn, cellEditorPopup: true },
      popupRenderer: popup,
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="popup-btn"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('uses under position class and width', async () => {
    const wrapper = mountTrigger({
      column: { ...triggerColumn, cellEditorPopup: true, cellEditorPopupPosition: 'under' },
      editorParams: { popupWidth: 420 },
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.html()).toContain('adv-table__cell-editor-popup--under')
    wrapper.unmount()
  })
})

describe('cellEditTrigger navigation and focus', () => {
  it('navigates home and end through edit api', async () => {
    const target = { rowIndex: 0, columnKey: 'name', prop: 'name' }
    const api = {
      findFirstEditableCell: vi.fn(() => target),
      findLastEditableCell: vi.fn(() => target),
      validateCurrentValue: vi.fn(async () => {}),
    }
    const wrapper = mountTrigger({}, { [advTableEditKey]: api })
    await wrapper.vm.$nextTick()
    const child = wrapper.findComponent({ name: 'ProbeEditor' })
    const onHomeEnd = child.props().onHomeEnd as ((key: 'Home' | 'End') => unknown) | undefined
    expect(typeof onHomeEnd).toBe('function')
    expect(onHomeEnd?.('Home')).toBe(target)
    expect(onHomeEnd?.('End')).toBe(target)
    expect(api.findFirstEditableCell).toHaveBeenCalledWith(0)
    expect(api.findLastEditableCell).toHaveBeenCalledWith(0)
    wrapper.unmount()
  })

  it('ignores home and end without edit api', async () => {
    const wrapper = mountTrigger()
    await wrapper.vm.$nextTick()
    const child = wrapper.findComponent({ name: 'ProbeEditor' })
    const onHomeEnd = child.props().onHomeEnd as ((key: 'Home' | 'End') => unknown) | undefined
    expect(onHomeEnd?.('Home')).toBeNull()
    wrapper.unmount()
  })

  it('warns when focus retries exhaust', async () => {
    resetDevWarnCacheForTests()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const editor = markRaw(defineComponent({
      name: 'ThrowFocusEditor',
      props: { modelValue: { type: null, required: true } },
      emits: ['update:modelValue', 'stopEditing'],
      setup(_, { expose }) {
        expose({
          focus: () => {
            throw new Error('no focus')
          },
        })
        return () => h('input')
      },
    }))
    const wrapper = mountTrigger({
      editor,
      column: { ...triggerColumn, key: 'warn-col-a' },
    })
    await flushFocus()
    await wrapper.vm.$nextTick()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
    wrapper.unmount()
  })

  it('falls back to input focus without editor focus', async () => {
    resetDevWarnCacheForTests()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const focusSpy = vi.spyOn(window.HTMLInputElement.prototype, 'focus')
    const editor = markRaw(defineComponent({
      name: 'NoFocusEditor',
      props: { modelValue: { type: null, required: true } },
      emits: ['update:modelValue', 'stopEditing'],
      setup: () => () => h('div', [h('input', { 'data-testid': 'fallback-input' })]),
    }))
    const wrapper = mountTrigger({
      editor,
      column: { ...triggerColumn, key: 'warn-col-b' },
    })
    await flushFocus()
    await wrapper.vm.$nextTick()
    expect(focusSpy).toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
    focusSpy.mockRestore()
    warn.mockRestore()
    wrapper.unmount()
  })
})
