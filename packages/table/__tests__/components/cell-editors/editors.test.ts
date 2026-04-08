/**
 * <zh/> 单元格编辑器单测——桩组件行为契约 + 真实 element-plus 交互（输入/选择/切换/校验/禁用）。
 * <en/> Cell editor tests — stub behavior contracts plus real element-plus interactions.
 */
import { mount } from '@vue/test-utils'
import { ElCheckbox, ElDatePicker, ElInput, ElInputNumber, ElOption, ElSelect, ElSwitch } from 'element-plus'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref as vueRef } from 'vue'
import CheckboxEditor from '../../../src/components/cell-editors/checkbox-editor.vue'
import DateEditor from '../../../src/components/cell-editors/date-editor.vue'
import DatePickerEditor from '../../../src/components/cell-editors/date-picker-editor.vue'
import DatetimeEditor from '../../../src/components/cell-editors/datetime-editor.vue'
import NumberEditor from '../../../src/components/cell-editors/number-editor.vue'
import SelectEditor from '../../../src/components/cell-editors/select-editor.vue'
import SwitchEditor from '../../../src/components/cell-editors/switch-editor.vue'
import TextEditor from '../../../src/components/cell-editors/text-editor.vue'

function stub(name: string, tag = 'div') {
  return defineComponent({
    name,
    // <zh/> 声明 modelValue 使透传值可经 props() 断言（否则落入 attrs 不可见）
    // <en/> Declaring modelValue makes forwarded values assertable via props() (otherwise they sink into attrs)
    props: { modelValue: null },
    setup(_, { expose }) {
      const el = vueRef<HTMLElement>()
      expose({ focus: () => el.value?.focus(), $el: el })
      return () => h(tag, { ref: el })
    },
  })
}

const stubs = {
  ElInput: stub('ElInput', 'input'),
  ElInputNumber: stub('ElInputNumber', 'input'),
  ElSelect: stub('ElSelect'),
  ElOption: stub('ElOption'),
  ElDatePicker: stub('ElDatePicker'),
  ElCheckbox: stub('ElCheckbox'),
  ElSwitch: stub('ElSwitch'),
  ElOptionGroup: stub('ElOptionGroup'),
}

const baseProps = { modelValue: '', editorParams: {} }

function ctx() {
  return { stubs }
}

describe('textEditor', () => {
  it('renders with modelValue', () => {
    const wrapper = mount(TextEditor, { props: { ...baseProps, modelValue: 'hello' }, global: ctx() })
    // <zh/> stub 收不到也要断言透传值，而非仅存在性
    // <en/> Assert the forwarded value, not mere existence
    expect(wrapper.findComponent(stubs.ElInput).props('modelValue')).toBe('hello')
    wrapper.unmount()
  })

  it('emits stopEditing on Escape', async () => {
    const wrapper = mount(TextEditor, { props: { ...baseProps, modelValue: 'text' }, global: ctx() })
    await wrapper.find('input').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('stopEditing')).toHaveLength(1)
    expect(wrapper.emitted('stopEditing')![0]).toEqual([false, 'escape'])
    wrapper.unmount()
  })

  it('emits stopEditing on Enter', async () => {
    const wrapper = mount(TextEditor, { props: { ...baseProps, modelValue: 'text' }, global: ctx() })
    await wrapper.find('input').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('stopEditing')).toHaveLength(1)
    expect(wrapper.emitted('stopEditing')![0]).toEqual([true, 'enter'])
    wrapper.unmount()
  })

  it('emits stopEditing on Tab', async () => {
    const wrapper = mount(TextEditor, { props: { ...baseProps, modelValue: 'text' }, global: ctx() })
    await wrapper.find('input').trigger('keydown', { key: 'Tab' })
    expect(wrapper.emitted('stopEditing')).toHaveLength(1)
    expect(wrapper.emitted('stopEditing')![0]).toEqual([true, 'tab'])
    wrapper.unmount()
  })

  it('emits stopEditing on blur', async () => {
    const wrapper = mount(TextEditor, { props: { ...baseProps, modelValue: 'text' }, global: ctx() })
    await wrapper.find('input').trigger('blur')
    expect(wrapper.emitted('stopEditing')).toHaveLength(1)
    expect(wrapper.emitted('stopEditing')![0]).toEqual([true, undefined])
    wrapper.unmount()
  })

  it('propagates modelValue to child', () => {
    const wrapper = mount(TextEditor, { props: { ...baseProps, modelValue: 'test-data' }, global: ctx() })
    expect(wrapper.find('input').exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders textarea when textarea param is true', () => {
    const wrapper = mount(TextEditor, { props: { ...baseProps, editorParams: { textarea: true } }, global: { stubs: { ...stubs, ElInput: stub('ElInput', 'textarea') } } })
    expect(wrapper.find('textarea').exists()).toBe(true)
    wrapper.unmount()
  })

  it('does not commit on Enter when textarea', async () => {
    const wrapper = mount(TextEditor, { props: { ...baseProps, modelValue: 'text', editorParams: { textarea: true } }, global: { stubs: { ...stubs, ElInput: stub('ElInput', 'textarea') } } })
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('stopEditing')).toBeFalsy()
    wrapper.unmount()
  })
})

describe('selectEditor', () => {
  const editorParams = { options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }

  it('renders with options', () => {
    const wrapper = mount(SelectEditor, { props: { ...baseProps, editorParams }, global: ctx() })
    expect(wrapper.findComponent(stubs.ElSelect).props('modelValue')).toBe('')
    wrapper.unmount()
  })

  it('emits stopEditing on single change', async () => {
    const wrapper = mount(SelectEditor, { props: { ...baseProps, editorParams }, global: ctx() })
    await wrapper.findComponent(stubs.ElSelect).vm.$emit('change', 'a')
    expect(wrapper.emitted('stopEditing')).toHaveLength(1)
    expect(wrapper.emitted('stopEditing')![0]).toEqual([true])
    wrapper.unmount()
  })

  it('does not auto-commit on multiple change', async () => {
    const wrapper = mount(SelectEditor, { props: { ...baseProps, modelValue: [], editorParams: { ...editorParams, multiple: true } }, global: ctx() })
    await wrapper.findComponent(stubs.ElSelect).vm.$emit('change', ['a', 'b'])
    expect(wrapper.emitted('stopEditing')).toBeFalsy()
    wrapper.unmount()
  })

  it('emits stopEditing on Escape', async () => {
    const wrapper = mount(SelectEditor, { props: { ...baseProps, editorParams }, global: ctx() })
    await wrapper.findComponent(stubs.ElSelect).trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('stopEditing')).toHaveLength(1)
    expect(wrapper.emitted('stopEditing')![0]).toEqual([false, 'escape'])
    wrapper.unmount()
  })

  it('emits stopEditing on Tab', async () => {
    const wrapper = mount(SelectEditor, { props: { ...baseProps, editorParams }, global: ctx() })
    await wrapper.findComponent(stubs.ElSelect).trigger('keydown', { key: 'Tab' })
    expect(wrapper.emitted('stopEditing')).toHaveLength(1)
    expect(wrapper.emitted('stopEditing')![0]).toEqual([true, 'tab'])
    wrapper.unmount()
  })
})

describe('numberEditor', () => {
  it('renders with modelValue', () => {
    const wrapper = mount(NumberEditor, { props: { ...baseProps, modelValue: 42 }, global: ctx() })
    expect(wrapper.findComponent(stubs.ElInputNumber).props('modelValue')).toBe(42)
    wrapper.unmount()
  })

  it('emits stopEditing on Escape', async () => {
    const wrapper = mount(NumberEditor, { props: { ...baseProps, modelValue: 5 }, global: ctx() })
    await wrapper.find('input').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('stopEditing')).toHaveLength(1)
    expect(wrapper.emitted('stopEditing')![0]).toEqual([false, 'escape'])
    wrapper.unmount()
  })

  it('emits stopEditing on Enter', async () => {
    const wrapper = mount(NumberEditor, { props: { ...baseProps, modelValue: 5 }, global: ctx() })
    await wrapper.find('input').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('stopEditing')).toHaveLength(1)
    wrapper.unmount()
  })

  it('emits stopEditing on Tab', async () => {
    const wrapper = mount(NumberEditor, { props: { ...baseProps, modelValue: 5 }, global: ctx() })
    await wrapper.find('input').trigger('keydown', { key: 'Tab' })
    expect(wrapper.emitted('stopEditing')).toHaveLength(1)
    wrapper.unmount()
  })

  it('emits stopEditing on blur', async () => {
    const wrapper = mount(NumberEditor, { props: { ...baseProps, modelValue: 5 }, global: ctx() })
    await wrapper.find('input').trigger('blur')
    expect(wrapper.emitted('stopEditing')).toHaveLength(1)
    wrapper.unmount()
  })
})

describe('dateEditor', () => {
  it('renders with modelValue', () => {
    const wrapper = mount(DateEditor, { props: { ...baseProps, modelValue: '2024-01-01' }, global: ctx() })
    expect(wrapper.findComponent(stubs.ElDatePicker).props('modelValue')).toBe('2024-01-01')
    wrapper.unmount()
  })

  it('emits stopEditing on change', async () => {
    const wrapper = mount(DateEditor, { props: { ...baseProps, modelValue: '' }, global: ctx() })
    await wrapper.findComponent(stubs.ElDatePicker).vm.$emit('change', '2024-01-15')
    expect(wrapper.emitted('stopEditing')).toHaveLength(1)
    wrapper.unmount()
  })

  it('emits stopEditing on Escape', async () => {
    const wrapper = mount(DateEditor, { props: { ...baseProps, modelValue: '' }, global: ctx() })
    await wrapper.findComponent(stubs.ElDatePicker).trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('stopEditing')).toHaveLength(1)
    expect(wrapper.emitted('stopEditing')![0]).toEqual([false, 'escape'])
    wrapper.unmount()
  })

  it('emits stopEditing on Tab', async () => {
    const wrapper = mount(DateEditor, { props: { ...baseProps, modelValue: '' }, global: ctx() })
    await wrapper.findComponent(stubs.ElDatePicker).trigger('keydown', { key: 'Tab' })
    expect(wrapper.emitted('stopEditing')).toHaveLength(1)
    wrapper.unmount()
  })

  it('emits stopEditing when visible becomes false', async () => {
    const wrapper = mount(DateEditor, { props: { ...baseProps, modelValue: '' }, global: ctx() })
    await wrapper.findComponent(stubs.ElDatePicker).vm.$emit('visible-change', false)
    expect(wrapper.emitted('stopEditing')).toHaveLength(1)
    wrapper.unmount()
  })
})

describe('datetimeEditor', () => {
  it('renders with modelValue', () => {
    const wrapper = mount(DatetimeEditor, { props: { ...baseProps, modelValue: '2024-01-01 12:00' }, global: ctx() })
    expect(wrapper.findComponent(stubs.ElDatePicker).props('modelValue')).toBe('2024-01-01 12:00')
    wrapper.unmount()
  })

  it('emits stopEditing on change', async () => {
    const wrapper = mount(DatetimeEditor, { props: { ...baseProps, modelValue: '' }, global: ctx() })
    await wrapper.findComponent(stubs.ElDatePicker).vm.$emit('change', '2024-01-15 10:30')
    expect(wrapper.emitted('stopEditing')).toHaveLength(1)
    wrapper.unmount()
  })

  it('emits stopEditing on Escape', async () => {
    const wrapper = mount(DatetimeEditor, { props: { ...baseProps, modelValue: '' }, global: ctx() })
    await wrapper.findComponent(stubs.ElDatePicker).trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('stopEditing')).toHaveLength(1)
    expect(wrapper.emitted('stopEditing')![0]).toEqual([false, 'escape'])
    wrapper.unmount()
  })

  it('emits stopEditing on Tab', async () => {
    const wrapper = mount(DatetimeEditor, { props: { ...baseProps, modelValue: '' }, global: ctx() })
    await wrapper.findComponent(stubs.ElDatePicker).trigger('keydown', { key: 'Tab' })
    expect(wrapper.emitted('stopEditing')).toHaveLength(1)
    wrapper.unmount()
  })

  it('emits stopEditing when visible becomes false', async () => {
    const wrapper = mount(DatetimeEditor, { props: { ...baseProps, modelValue: '' }, global: ctx() })
    await wrapper.findComponent(stubs.ElDatePicker).vm.$emit('visible-change', false)
    expect(wrapper.emitted('stopEditing')).toHaveLength(1)
    wrapper.unmount()
  })
})

describe('checkboxEditor', () => {
  it('renders with modelValue', () => {
    const wrapper = mount(CheckboxEditor, { props: { ...baseProps, modelValue: true }, global: ctx() })
    expect(wrapper.findComponent(stubs.ElCheckbox).props('modelValue')).toBe(true)
    wrapper.unmount()
  })

  it('emits stopEditing on change', async () => {
    const wrapper = mount(CheckboxEditor, { props: { ...baseProps, modelValue: false }, global: ctx() })
    await wrapper.findComponent(stubs.ElCheckbox).vm.$emit('change', true)
    expect(wrapper.emitted('stopEditing')).toHaveLength(1)
    wrapper.unmount()
  })
})

describe('switchEditor', () => {
  it('renders with modelValue', () => {
    const wrapper = mount(SwitchEditor, { props: { ...baseProps, modelValue: true }, global: ctx() })
    expect(wrapper.findComponent(stubs.ElSwitch).props('modelValue')).toBe(true)
    wrapper.unmount()
  })

  it('emits stopEditing on change', async () => {
    const wrapper = mount(SwitchEditor, { props: { ...baseProps, modelValue: false }, global: ctx() })
    await wrapper.findComponent(stubs.ElSwitch).vm.$emit('change', true)
    expect(wrapper.emitted('stopEditing')).toHaveLength(1)
    wrapper.unmount()
  })
})

/**
 * <zh/> 以下用例挂载真实 element-plus 组件，覆盖输入/校验/禁用/清空等脚本分支。
 * <en/> The suites below mount real element-plus components for input/validate/disabled/clear branches.
 */
function mountReal(component: unknown, props: Record<string, unknown> = {}) {
  return mount(component as never, {
    props: { modelValue: '', editorParams: {}, ...props } as never,
  })
}

function dispatchMousedown(el: Element): boolean {
  const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
  el.dispatchEvent(event)
  return event.defaultPrevented
}

describe('textEditor real editing', () => {
  it('types and emits update:modelValue', async () => {
    const wrapper = mountReal(TextEditor, { modelValue: 'a' })
    await wrapper.find('input').setValue('hello')
    expect(wrapper.emitted('update:modelValue')).toEqual([['hello']])
    wrapper.unmount()
  })

  it('validates on every input when trigger is input', async () => {
    const onValidate = vi.fn()
    const wrapper = mountReal(TextEditor, { modelValue: 'a', validateTrigger: 'input', onValidate })
    await wrapper.find('input').setValue('b')
    expect(onValidate).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('validates on change when trigger is change', async () => {
    const onValidate = vi.fn()
    const wrapper = mountReal(TextEditor, { modelValue: 'a', validateTrigger: 'change', onValidate })
    await wrapper.findComponent(ElInput).vm.$emit('change', 'b')
    expect(onValidate).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('skips validation on input by default', async () => {
    const onValidate = vi.fn()
    const wrapper = mountReal(TextEditor, { modelValue: 'a', onValidate })
    await wrapper.find('input').setValue('b')
    expect(onValidate).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('keeps focus when clear button is pressed', async () => {
    const wrapper = mountReal(TextEditor, { modelValue: 'abc' })
    await wrapper.find('.el-input__wrapper').trigger('mouseenter')
    const clear = wrapper.find('.el-input__clear')
    expect(clear.exists()).toBe(true)
    expect(dispatchMousedown(clear.element)).toBe(true)
    wrapper.unmount()
  })

  it('renders disabled input from componentProps', async () => {
    const wrapper = mountReal(TextEditor, {
      modelValue: 'a',
      editorParams: { componentProps: { disabled: true } },
    })
    expect((wrapper.find('input').element as HTMLInputElement).disabled).toBe(true)
    wrapper.unmount()
  })

  it('forwards maxlength and textarea type', async () => {
    const wrapper = mountReal(TextEditor, {
      modelValue: 'a',
      editorParams: { maxlength: 5, textarea: true, componentProps: { rows: 3 } },
    })
    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.findComponent(ElInput).props('maxlength')).toBe(5)
    wrapper.unmount()
  })

  it('exposes focus and getValue', async () => {
    const wrapper = mountReal(TextEditor, { modelValue: 'a' })
    const exposed = wrapper.vm as unknown as { focus: () => void, getValue: () => unknown }
    expect(typeof exposed.focus).toBe('function')
    exposed.focus()
    expect(exposed.getValue()).toBeUndefined()
    wrapper.unmount()
  })

  it('commits on enter and blurs to commit', async () => {
    const wrapper = mountReal(TextEditor, { modelValue: 'a' })
    await wrapper.find('input').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('stopEditing')).toEqual([[true, 'enter']])
    wrapper.unmount()
  })
})

describe('numberEditor real editing', () => {
  it('types and emits update:modelValue', async () => {
    const wrapper = mountReal(NumberEditor, { modelValue: 1 })
    await wrapper.find('input').setValue('7')
    expect(wrapper.emitted('update:modelValue')).toContainEqual([7])
    wrapper.unmount()
  })

  it('clamps above max on blur', async () => {
    const wrapper = mountReal(NumberEditor, { modelValue: 5, editorParams: { min: 0, max: 10 } })
    const input = wrapper.find('input')
    await input.setValue('999')
    await input.trigger('blur')
    const emitted = wrapper.emitted('update:modelValue') as unknown[][]
    expect(emitted.at(-1)).toEqual([10])
    wrapper.unmount()
  })

  it('clamps below min on blur', async () => {
    const wrapper = mountReal(NumberEditor, { modelValue: 5, editorParams: { min: 0, max: 10 } })
    const input = wrapper.find('input')
    await input.setValue('-42')
    await input.trigger('blur')
    const emitted = wrapper.emitted('update:modelValue') as unknown[][]
    expect(emitted.at(-1)).toEqual([0])
    wrapper.unmount()
  })

  it('validates on update when trigger is change or input', async () => {
    const onValidate = vi.fn()
    const wrapper = mountReal(NumberEditor, { modelValue: 1, validateTrigger: 'change', onValidate })
    await wrapper.findComponent(ElInputNumber).vm.$emit('update:model-value', 2)
    expect(wrapper.emitted('update:modelValue')).toEqual([[2]])
    expect(onValidate).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('forwards min max step precision', async () => {
    const wrapper = mountReal(NumberEditor, {
      modelValue: 5,
      editorParams: { min: 1, max: 9, step: 2, precision: 1 },
    })
    expect(wrapper.findComponent(ElInputNumber).props()).toMatchObject({ min: 1, max: 9, step: 2 })
    wrapper.unmount()
  })

  it('keeps focus when stepper is pressed', async () => {
    const wrapper = mountReal(NumberEditor, { modelValue: 5 })
    const button = wrapper.find('.el-input-number__increase')
    expect(button.exists()).toBe(true)
    expect(dispatchMousedown(button.element)).toBe(true)
    wrapper.unmount()
  })

  it('renders disabled input from componentProps', async () => {
    const wrapper = mountReal(NumberEditor, {
      modelValue: 5,
      editorParams: { componentProps: { disabled: true } },
    })
    expect((wrapper.find('input').element as HTMLInputElement).disabled).toBe(true)
    wrapper.unmount()
  })

  it('exposes focus and getValue', async () => {
    const wrapper = mountReal(NumberEditor, { modelValue: 3 })
    const exposed = wrapper.vm as unknown as { focus: () => void, getValue: () => unknown }
    expect(typeof exposed.focus).toBe('function')
    exposed.focus()
    expect(exposed.getValue()).toBeUndefined()
    wrapper.unmount()
  })
})

describe('selectEditor real editing', () => {
  const realOptions = { options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }

  it('selects a single option and commits', async () => {
    const wrapper = mountReal(SelectEditor, { editorParams: realOptions })
    await wrapper.findComponent(ElSelect).vm.$emit('update:model-value', 'a')
    expect(wrapper.emitted('update:modelValue')).toEqual([['a']])
    wrapper.unmount()
    const committed = mountReal(SelectEditor, { editorParams: realOptions })
    await committed.findComponent(ElSelect).vm.$emit('change', 'a')
    expect(committed.emitted('update:modelValue')).toEqual([['a']])
    expect(committed.emitted('stopEditing')).toEqual([[true]])
    committed.unmount()
  })

  it('keeps editing on multiple change', async () => {
    const wrapper = mountReal(SelectEditor, {
      modelValue: [],
      editorParams: { ...realOptions, multiple: true },
    })
    await wrapper.findComponent(ElSelect).vm.$emit('change', ['a'])
    expect(wrapper.emitted('update:modelValue')).toEqual([[['a']]])
    expect(wrapper.emitted('stopEditing')).toBeFalsy()
    wrapper.unmount()
  })

  it('validates on change when trigger is change', async () => {
    const onValidate = vi.fn()
    const wrapper = mountReal(SelectEditor, {
      editorParams: realOptions,
      validateTrigger: 'change',
      onValidate,
    })
    await wrapper.findComponent(ElSelect).vm.$emit('change', 'b')
    expect(onValidate).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('renders options and forwards multiple filterable', async () => {
    const wrapper = mountReal(SelectEditor, {
      editorParams: { ...realOptions, multiple: true, filterable: true },
    })
    expect(wrapper.findAllComponents(ElOption)).toHaveLength(2)
    expect(wrapper.findComponent(ElSelect).props()).toMatchObject({ multiple: true, filterable: true })
    wrapper.unmount()
  })

  it('forwards disabled from componentProps', async () => {
    const wrapper = mountReal(SelectEditor, {
      editorParams: { ...realOptions, componentProps: { disabled: true } },
    })
    expect(wrapper.findComponent(ElSelect).props('disabled')).toBe(true)
    wrapper.unmount()
  })

  it('exposes focus and getValue', async () => {
    const wrapper = mountReal(SelectEditor, { editorParams: realOptions })
    const exposed = wrapper.vm as unknown as { focus: () => void, getValue: () => unknown }
    expect(typeof exposed.focus).toBe('function')
    exposed.focus()
    expect(exposed.getValue()).toBe('')
    wrapper.unmount()
  })

  it('cancels on escape', async () => {
    const wrapper = mountReal(SelectEditor, { editorParams: realOptions })
    await wrapper.findComponent(ElSelect).trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('stopEditing')).toEqual([[false, 'escape']])
    wrapper.unmount()
  })
})

describe('checkboxEditor real editing', () => {
  it('checks and commits', async () => {
    const wrapper = mountReal(CheckboxEditor, { modelValue: false })
    await wrapper.find('input').setChecked(true)
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
    expect(wrapper.emitted('stopEditing')).toEqual([[true]])
    wrapper.unmount()
  })

  it('unchecks and commits', async () => {
    const wrapper = mountReal(CheckboxEditor, { modelValue: true })
    await wrapper.find('input').setChecked(false)
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    expect(wrapper.emitted('stopEditing')).toEqual([[true]])
    wrapper.unmount()
  })

  it('validates on change when trigger is change', async () => {
    const onValidate = vi.fn()
    const wrapper = mountReal(CheckboxEditor, {
      modelValue: false,
      validateTrigger: 'change',
      onValidate,
    })
    await wrapper.findComponent(ElCheckbox).vm.$emit('change', true)
    expect(onValidate).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('stopEditing')).toEqual([[true]])
    wrapper.unmount()
  })

  it('renders disabled state from componentProps', async () => {
    const wrapper = mountReal(CheckboxEditor, {
      modelValue: false,
      editorParams: { componentProps: { disabled: true } },
    })
    expect((wrapper.find('input').element as HTMLInputElement).disabled).toBe(true)
    wrapper.unmount()
  })

  it('exposes focus and getValue', async () => {
    const wrapper = mountReal(CheckboxEditor, { modelValue: false })
    const exposed = wrapper.vm as unknown as { focus: () => void, getValue: () => unknown }
    expect(typeof exposed.focus).toBe('function')
    exposed.focus()
    expect(exposed.getValue()).toBe(false)
    wrapper.unmount()
  })

  it('commits on enter', async () => {
    const wrapper = mountReal(CheckboxEditor, { modelValue: false })
    await wrapper.findComponent(ElCheckbox).trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('stopEditing')).toEqual([[true, 'enter']])
    wrapper.unmount()
  })
})

describe('switchEditor real editing', () => {
  it('toggles on and commits', async () => {
    const wrapper = mountReal(SwitchEditor, { modelValue: false })
    await wrapper.find('input').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
    expect(wrapper.emitted('stopEditing')).toEqual([[true]])
    wrapper.unmount()
  })

  it('toggles off and commits', async () => {
    const wrapper = mountReal(SwitchEditor, { modelValue: true })
    await wrapper.find('input').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    expect(wrapper.emitted('stopEditing')).toEqual([[true]])
    wrapper.unmount()
  })

  it('validates on change when trigger is change', async () => {
    const onValidate = vi.fn()
    const wrapper = mountReal(SwitchEditor, {
      modelValue: false,
      validateTrigger: 'change',
      onValidate,
    })
    await wrapper.findComponent(ElSwitch).vm.$emit('change', true)
    expect(onValidate).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('stopEditing')).toEqual([[true]])
    wrapper.unmount()
  })

  it('blocks toggle when disabled', async () => {
    const wrapper = mountReal(SwitchEditor, {
      modelValue: false,
      editorParams: { componentProps: { disabled: true } },
    })
    await wrapper.find('input').trigger('click')
    expect(wrapper.emitted('stopEditing')).toBeFalsy()
    wrapper.unmount()
  })

  it('exposes focus and getValue', async () => {
    const wrapper = mountReal(SwitchEditor, { modelValue: false })
    const exposed = wrapper.vm as unknown as { focus: () => void, getValue: () => unknown }
    expect(typeof exposed.focus).toBe('function')
    exposed.focus()
    expect(exposed.getValue()).toBeUndefined()
    wrapper.unmount()
  })
})

describe('datePickerEditor real editing', () => {
  it('commits once on change', async () => {
    const wrapper = mountReal(DatePickerEditor, { modelValue: '' })
    const picker = wrapper.findComponent(ElDatePicker)
    await picker.vm.$emit('update:model-value', '2024-01-15')
    expect(wrapper.emitted('update:modelValue')).toEqual([['2024-01-15']])
    await picker.vm.$emit('change', '2024-01-15')
    expect(wrapper.emitted('stopEditing')).toEqual([[true]])
    wrapper.unmount()
  })

  it('ignores panel close after change commit', async () => {
    const wrapper = mountReal(DatePickerEditor, { modelValue: '' })
    const picker = wrapper.findComponent(ElDatePicker)
    await picker.vm.$emit('change', '2024-01-15')
    await picker.vm.$emit('visible-change', false)
    expect(wrapper.emitted('stopEditing')).toHaveLength(1)
    wrapper.unmount()
  })

  it('commits when panel closes without change', async () => {
    const wrapper = mountReal(DatePickerEditor, { modelValue: '' })
    await wrapper.findComponent(ElDatePicker).vm.$emit('visible-change', false)
    expect(wrapper.emitted('stopEditing')).toEqual([[true]])
    wrapper.unmount()
  })

  it('keeps editing while panel stays open', async () => {
    const wrapper = mountReal(DatePickerEditor, { modelValue: '' })
    await wrapper.findComponent(ElDatePicker).vm.$emit('visible-change', true)
    expect(wrapper.emitted('stopEditing')).toBeFalsy()
    wrapper.unmount()
  })

  it('defaults placeholder by picker type', async () => {
    const dateWrapper = mountReal(DatePickerEditor, { modelValue: '' })
    expect(dateWrapper.findComponent(ElDatePicker).props('placeholder')).toBe('Select date')
    dateWrapper.unmount()
    const timeWrapper = mountReal(DatePickerEditor, { modelValue: '', pickerType: 'datetime' })
    expect(timeWrapper.findComponent(ElDatePicker).props('placeholder')).toBe('Select datetime')
    timeWrapper.unmount()
  })

  it('honors custom placeholder', async () => {
    const wrapper = mountReal(DatePickerEditor, {
      modelValue: '',
      editorParams: { placeholder: 'pick one' },
    })
    expect(wrapper.findComponent(ElDatePicker).props('placeholder')).toBe('pick one')
    wrapper.unmount()
  })

  it('exposes focus and getValue', async () => {
    const wrapper = mountReal(DatePickerEditor, { modelValue: '' })
    const exposed = wrapper.vm as unknown as { focus: () => void, getValue: () => unknown }
    expect(typeof exposed.focus).toBe('function')
    exposed.focus()
    expect(exposed.getValue()).toBeUndefined()
    wrapper.unmount()
  })

  it('cancels on escape', async () => {
    const wrapper = mountReal(DatePickerEditor, { modelValue: '' })
    const picker = wrapper.findComponent(ElDatePicker)
    await picker.vm.$emit('keydown', { key: 'Escape', stopPropagation: () => {} })
    expect(wrapper.emitted('stopEditing')).toEqual([[false, 'escape']])
    wrapper.unmount()
  })
})
