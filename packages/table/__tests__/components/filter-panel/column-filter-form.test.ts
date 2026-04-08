import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import ColumnFilterForm from '../../../src/components/filter-panel/column-filter-form.vue'
import { registerBuiltinFilterTypes } from '../../../src/composables/features/builtin-filters'

/**
 * <zh/> 内置策略前置：表单的 createDefaultFilterValue 经全局注册表解析，生产环境由 useColumnFilter setup 保证已注册；
 * <zh/> 单独挂载表单时需显式初始化，否则 number/date/enum 回退成 text（带 devWarn），模板分支与草稿形状错位。
 * <en/> Built-in strategy precondition: the form resolves createDefaultFilterValue through the global registry,
 * <en/> which useColumnFilter setup guarantees in production; standalone mounts must initialize explicitly,
 * <en/> otherwise number/date/enum fall back to text (with devWarn) and the template branch disagrees with the draft shape.
 */
registerBuiltinFilterTypes()

/**
 * <zh/> 筛选表单单测——真实 EP 控件，覆盖四类型渲染、算子切换、确认重置与草稿同步。
 * <en/> Filter-form tests with real EP controls — four-type render, operator switch, confirm/reset and draft sync.
 */
const t = (key: string) => key

function setupForm(props: Record<string, any> = {}, modelValue: any = undefined) {
  return mount(ColumnFilterForm as any, {
    props: {
      columnKey: 'name',
      filterType: 'text',
      active: true,
      t,
      modelValue,
      ...props,
    },
  })
}

describe('columnFilterForm types', () => {
  it('renders text filters', async () => {
    const wrapper = setupForm()
    await nextTick()
    // <zh/> 文本类型默认 contains 算子：算子下拉 + 值输入框必须同时存在
    // <en/> Text defaults to the contains operator: operator select and value input must both render
    expect(wrapper.findComponent({ name: 'ElSelect' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'ElInput' }).exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders number filters', async () => {
    const wrapper = setupForm({ filterType: 'number' })
    await nextTick()
    expect(wrapper.findComponent({ name: 'ElSelect' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'ElInputNumber' }).exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders date filters', async () => {
    const wrapper = setupForm({ filterType: 'date' })
    await nextTick()
    expect(wrapper.findComponent({ name: 'ElSelect' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'ElDatePicker' }).exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders enum filters with options', async () => {
    const wrapper = setupForm(
      { filterType: 'enum', enumOptions: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }] },
      { type: 'enum', selected: [] },
    )
    await nextTick()
    // <zh/> 空选中激活即全选：全选框必须渲染为已勾选态
    // <en/> Empty selection auto-selects all on activation: the select-all box must render checked
    const boxes = wrapper.findAll('.el-checkbox')
    expect(boxes.length).toBeGreaterThan(0)
    expect(wrapper.find('.adv-table-filter-panel__select-all').classes()).toContain('is-checked')
    wrapper.unmount()
  })
})

describe('columnFilterForm confirm/reset', () => {
  it('writes the draft back on confirm', async () => {
    const wrapper = setupForm({}, { type: 'text', operator: 'contains', value: 'x' })
    await nextTick()
    const confirmBtn = wrapper.findAll('button').find(b => b.text().includes('confirm'))
    expect(confirmBtn).toBeDefined()
    await confirmBtn!.trigger('click')
    const updates = wrapper.emitted('update:modelValue') as any[]
    expect(updates).toBeDefined()
    expect(updates[updates.length - 1][0]).toMatchObject({ type: 'text', value: 'x' })
    expect(wrapper.emitted('confirm')).toBeDefined()
    wrapper.unmount()
  })

  it('clears to defaults on reset', async () => {
    const wrapper = setupForm({}, { type: 'text', operator: 'contains', value: 'x' })
    await nextTick()
    const resetBtn = wrapper.findAll('button').find(b => b.text().includes('reset'))
    expect(resetBtn).toBeDefined()
    await resetBtn!.trigger('click')
    expect(wrapper.emitted('reset')).toBeDefined()
    wrapper.unmount()
  })

  it('syncs external modelValue into the draft', async () => {
    const wrapper = setupForm({}, { type: 'text', operator: 'contains', value: 'x' })
    await wrapper.setProps({ modelValue: undefined } as any)
    await nextTick()
    // <zh/> 外部清空后草稿回退默认值：confirm 回写应为无值的 contains
    // <en/> External clear resets the draft to defaults: confirm write-back is valueless contains
    const confirmBtn = wrapper.findAll('button').find(b => b.text().includes('confirm'))
    await confirmBtn!.trigger('click')
    const updates = wrapper.emitted('update:modelValue') as any[]
    expect(updates[updates.length - 1][0]).toMatchObject({ type: 'text', operator: 'contains' })
    expect(updates[updates.length - 1][0].value).toBeUndefined()
    wrapper.unmount()
  })

  it('resets the draft shape on filterType change', async () => {
    const wrapper = setupForm({ filterType: 'text' })
    await wrapper.setProps({ filterType: 'number' } as any)
    await nextTick()
    // <zh/> 类型切换后草稿应为数字形状：confirm 回写 type 为 number
    // <en/> Draft takes the number shape after type switch: confirm write-back has type number
    const confirmBtn = wrapper.findAll('button').find(b => b.text().includes('confirm'))
    await confirmBtn!.trigger('click')
    const updates = wrapper.emitted('update:modelValue') as any[]
    expect(updates[updates.length - 1][0].type).toBe('number')
    wrapper.unmount()
  })
})

describe('columnFilterForm enum', () => {
  const options = [
    { label: 'Alpha', value: 'a' },
    { label: 'Beta', value: 'b' },
    { label: 'Gamma', value: 'g' },
  ]

  it('auto-selects all on activation when empty', async () => {
    const wrapper = setupForm(
      { filterType: 'enum', enumOptions: options, active: false },
      { type: 'enum', selected: [] },
    )
    await nextTick()
    await wrapper.setProps({ active: true } as any)
    await nextTick()
    // <zh/> 激活时空选中自动全选已写入草稿：confirm 回写必须包含全部选项
    // <en/> Empty selection auto-selects all on activation: confirm write-back must contain every option
    const confirmBtn = wrapper.findAll('button').find(b => b.text().includes('confirm'))
    expect(confirmBtn).toBeDefined()
    await confirmBtn!.trigger('click')
    const updates = wrapper.emitted('update:modelValue') as any[]
    expect(updates[updates.length - 1][0]).toMatchObject({ type: 'enum', selected: ['a', 'b', 'g'] })
    wrapper.unmount()
  })

  it('filters options by search keyword', async () => {
    const wrapper = setupForm(
      { filterType: 'enum', enumOptions: options },
      { type: 'enum', selected: [] },
    )
    await nextTick()
    const search = wrapper.find('input[placeholder*="earch"], input[type="text"]')
    expect(search.exists()).toBe(true)
    await search.setValue('alp')
    await nextTick()
    // <zh/> 搜 alp 后只剩 Alpha：用选项文本断言过滤真实发生
    // <en/> Searching alp leaves only Alpha: assert on option text that filtering really happened
    const visibleLabels = wrapper.findAll('.el-checkbox').map(b => b.text())
    expect(visibleLabels.some(t => t.includes('Alpha'))).toBe(true)
    expect(visibleLabels.some(t => t.includes('Beta') || t.includes('Gamma'))).toBe(false)
    wrapper.unmount()
  })

  it('toggles options through checkboxes', async () => {
    const wrapper = setupForm(
      { filterType: 'enum', enumOptions: options },
      { type: 'enum', selected: [] },
    )
    await nextTick()
    const boxes = wrapper.findAll('.el-checkbox')
    expect(boxes.length).toBeGreaterThan(0)
    await boxes[boxes.length - 1].trigger('click')
    await nextTick()
    wrapper.unmount()
  })
})

/**
 * <zh/> 注：算子切换的旧冒烟用例（仅断言渲染存在）已被下方 handler 覆盖补齐（切换 + 回写断言），此处不再重复。
 * <en/> NOTE: the old operator smoke tests (render-only assertions) are superseded by the handler coverage below (switch + write-back assertions).
 */

/**
 * <zh/> 处理器覆盖——逐个触发模板绑定的 @change/@update 处理器并经 confirm 回写断言。
 * <en/> Handler coverage — triggers each template-bound @change/@update handler and asserts via confirm write-back.
 */
describe('columnFilterForm handler coverage', () => {
  /**
   * <zh/> 点确认按钮并返回最后一次 update:modelValue 载荷
   * <en/> Clicks confirm and returns the last update:modelValue payload
   */
  async function confirmPayload(wrapper: any) {
    const confirmBtn = wrapper.findAll('button').find((b: any) => b.text().includes('confirm'))
    expect(confirmBtn).toBeDefined()
    await confirmBtn!.trigger('click')
    const updates = wrapper.emitted('update:modelValue') as any[]
    expect(updates).toBeDefined()
    return updates[updates.length - 1][0]
  }

  it('changes text operator and writes back on confirm', async () => {
    const wrapper = setupForm({}, { type: 'text', operator: 'contains', value: 'x' })
    await nextTick()
    const selects = wrapper.findAllComponents({ name: 'ElSelect' })
    expect(selects.length).toBeGreaterThan(0)
    await selects[0].vm.$emit('change', 'equals')
    await nextTick()
    expect(await confirmPayload(wrapper)).toMatchObject({ type: 'text', operator: 'equals' })
    wrapper.unmount()
  })

  it('updates text value through input', async () => {
    const wrapper = setupForm({}, { type: 'text', operator: 'contains' })
    await nextTick()
    const input = wrapper.findComponent({ name: 'ElInput' })
    expect(input.exists()).toBe(true)
    await input.vm.$emit('update:model-value', 'hello')
    await nextTick()
    expect(await confirmPayload(wrapper)).toMatchObject({ type: 'text', value: 'hello' })
    wrapper.unmount()
  })

  it('clears text value on empty input', async () => {
    const wrapper = setupForm({}, { type: 'text', operator: 'contains', value: 'x' })
    await nextTick()
    const input = wrapper.findComponent({ name: 'ElInput' })
    await input.vm.$emit('update:model-value', '')
    await nextTick()
    const payload = await confirmPayload(wrapper)
    expect(payload.value).toBeUndefined()
    wrapper.unmount()
  })

  it('drives text second condition (logic + operator + value)', async () => {
    const wrapper = setupForm({}, { type: 'text', operator: 'contains' })
    await nextTick()
    // <zh/> 先给首值，watcher 自动增删 conditions 后出现第二条件区 | <en/> Value first so the watcher adds conditions and the second-condition zone appears
    await wrapper.findComponent({ name: 'ElInput' }).vm.$emit('update:model-value', 'a')
    await nextTick()
    await nextTick()
    const radios = wrapper.findComponent({ name: 'ElRadioGroup' })
    expect(radios.exists()).toBe(true)
    await radios.vm.$emit('change', 'or')
    await nextTick()
    const selects = wrapper.findAllComponents({ name: 'ElSelect' })
    expect(selects.length).toBeGreaterThan(1)
    await selects[1].vm.$emit('change', 'equals')
    await nextTick()
    const inputs = wrapper.findAllComponents({ name: 'ElInput' })
    expect(inputs.length).toBeGreaterThan(1)
    await inputs[1].vm.$emit('update:model-value', 'b')
    await nextTick()
    const payload = await confirmPayload(wrapper)
    expect(payload.conditions.logic).toBe('or')
    expect(payload.conditions.condition.operator).toBe('equals')
    expect(payload.conditions.condition.value).toBe('b')
    wrapper.unmount()
  })

  it('clears text second value on empty input', async () => {
    const wrapper = setupForm({}, {
      type: 'text',
      operator: 'contains',
      value: 'a',
      conditions: { logic: 'and', condition: { operator: 'equals', value: 'b' } },
    })
    await nextTick()
    await nextTick()
    const inputs = wrapper.findAllComponents({ name: 'ElInput' })
    expect(inputs.length).toBeGreaterThan(1)
    await inputs[1].vm.$emit('update:model-value', '')
    await nextTick()
    const payload = await confirmPayload(wrapper)
    expect(payload.conditions.condition.value).toBeUndefined()
    wrapper.unmount()
  })

  it('changes number operator and edits value', async () => {
    const wrapper = setupForm({ filterType: 'number' }, { type: 'number', operator: 'eq', value: 5 })
    await nextTick()
    const selects = wrapper.findAllComponents({ name: 'ElSelect' })
    await selects[0].vm.$emit('change', 'gt')
    await nextTick()
    const numbers = wrapper.findAllComponents({ name: 'ElInputNumber' })
    expect(numbers.length).toBeGreaterThan(0)
    await numbers[0].vm.$emit('update:model-value', 10)
    await nextTick()
    expect(await confirmPayload(wrapper)).toMatchObject({ type: 'number', operator: 'gt', value: 10 })
    wrapper.unmount()
  })

  it('edits number between min/max', async () => {
    const wrapper = setupForm({ filterType: 'number' }, { type: 'number', operator: 'between', min: 1, max: 9 })
    await nextTick()
    const numbers = wrapper.findAllComponents({ name: 'ElInputNumber' })
    // <zh/> watcher 可能已自动补第二条件，首二个恒为 min/max | <en/> The watcher may have auto-added a second condition; the first two stay min/max
    expect(numbers.length).toBeGreaterThanOrEqual(2)
    await numbers[0].vm.$emit('update:model-value', 2)
    await numbers[1].vm.$emit('update:model-value', 8)
    await nextTick()
    expect(await confirmPayload(wrapper)).toMatchObject({ type: 'number', min: 2, max: 8 })
    wrapper.unmount()
  })

  it('drives number second condition (logic + operator + value/min/max)', async () => {
    const wrapper = setupForm({ filterType: 'number' }, {
      type: 'number',
      operator: 'eq',
      value: 5,
      conditions: { logic: 'and', condition: { operator: 'between', min: 1, max: 9 } },
    })
    await nextTick()
    await nextTick()
    const radios = wrapper.findComponent({ name: 'ElRadioGroup' })
    expect(radios.exists()).toBe(true)
    await radios.vm.$emit('change', 'or')
    await nextTick()
    const selects = wrapper.findAllComponents({ name: 'ElSelect' })
    expect(selects.length).toBeGreaterThan(1)
    await selects[1].vm.$emit('change', 'eq')
    await nextTick()
    const numbers = wrapper.findAllComponents({ name: 'ElInputNumber' })
    expect(numbers.length).toBeGreaterThan(1)
    await numbers[numbers.length - 1].vm.$emit('update:model-value', 7)
    await nextTick()
    const payload = await confirmPayload(wrapper)
    expect(payload.conditions.logic).toBe('or')
    wrapper.unmount()
  })

  it('edits number second between min/max', async () => {
    const wrapper = setupForm({ filterType: 'number' }, {
      type: 'number',
      operator: 'eq',
      value: 5,
      conditions: { logic: 'and', condition: { operator: 'between', min: 1, max: 9 } },
    })
    await nextTick()
    await nextTick()
    // <zh/> 第二条件 between 渲染 min/max 两个输入 | <en/> Second-condition between renders min/max inputs
    const numbers = wrapper.findAllComponents({ name: 'ElInputNumber' })
    expect(numbers.length).toBeGreaterThan(2)
    await numbers[numbers.length - 2].vm.$emit('update:model-value', 2)
    await numbers[numbers.length - 1].vm.$emit('update:model-value', 8)
    await nextTick()
    const payload = await confirmPayload(wrapper)
    expect(payload.conditions.condition.min).toBe(2)
    expect(payload.conditions.condition.max).toBe(8)
    wrapper.unmount()
  })

  it('switches date operator and edits single date', async () => {
    const wrapper = setupForm({ filterType: 'date' }, { type: 'date', operator: 'before' })
    await nextTick()
    const selects = wrapper.findAllComponents({ name: 'ElSelect' })
    await selects[0].vm.$emit('change', 'after')
    await nextTick()
    const picker = wrapper.findComponent({ name: 'ElDatePicker' })
    expect(picker.exists()).toBe(true)
    await picker.vm.$emit('update:model-value', '2024-05-01')
    await nextTick()
    expect(await confirmPayload(wrapper)).toMatchObject({ type: 'date', operator: 'after', value: '2024-05-01' })
    wrapper.unmount()
  })

  it('accepts Date objects in single date input', async () => {
    const wrapper = setupForm({ filterType: 'date' }, { type: 'date', operator: 'after' })
    await nextTick()
    const picker = wrapper.findComponent({ name: 'ElDatePicker' })
    await picker.vm.$emit('update:model-value', new Date(2024, 0, 15))
    await nextTick()
    expect(await confirmPayload(wrapper)).toMatchObject({ type: 'date', value: '2024-01-15' })
    wrapper.unmount()
  })

  it('clears single date on empty input', async () => {
    const wrapper = setupForm({ filterType: 'date' }, { type: 'date', operator: 'after', value: '2024-05-01' })
    await nextTick()
    const picker = wrapper.findComponent({ name: 'ElDatePicker' })
    await picker.vm.$emit('update:model-value', undefined)
    await nextTick()
    const payload = await confirmPayload(wrapper)
    expect(payload.value).toBeUndefined()
    wrapper.unmount()
  })

  it('edits date range including partial clearing', async () => {
    const wrapper = setupForm({ filterType: 'date' }, { type: 'date', operator: 'between' })
    await nextTick()
    const picker = wrapper.findComponent({ name: 'ElDatePicker' })
    expect(picker.exists()).toBe(true)
    await picker.vm.$emit('update:model-value', ['2024-01-01', '2024-12-31'])
    await nextTick()
    expect(await confirmPayload(wrapper)).toMatchObject({ type: 'date', startDate: '2024-01-01', endDate: '2024-12-31' })
    await picker.vm.$emit('update:model-value', ['2024-02-01', undefined] as any)
    await nextTick()
    const cleared = await confirmPayload(wrapper)
    expect(cleared.startDate).toBe('2024-02-01')
    expect(cleared.endDate).toBeUndefined()
    await picker.vm.$emit('update:model-value', undefined)
    await nextTick()
    const emptied = await confirmPayload(wrapper)
    expect(emptied.startDate).toBeUndefined()
    expect(emptied.endDate).toBeUndefined()
    wrapper.unmount()
  })

  it('selects enum options through group and select-all both ways', async () => {
    const options = [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }]
    const wrapper = setupForm(
      { filterType: 'enum', enumOptions: options, active: false },
      { type: 'enum', selected: ['a'] },
    )
    await nextTick()
    const group = wrapper.findComponent({ name: 'ElCheckboxGroup' })
    expect(group.exists()).toBe(true)
    await group.vm.$emit('update:model-value', ['a', 'b'])
    await nextTick()
    expect(await confirmPayload(wrapper)).toMatchObject({ type: 'enum', selected: ['a', 'b'] })
    // <zh/> 全选开：补齐缺失项；全选关：只保留过滤范围外 | <en/> Select-all on fills gaps; off keeps only out-of-range
    const all = wrapper.findComponent({ name: 'ElCheckbox' })
    await all.vm.$emit('change', true)
    await nextTick()
    await all.vm.$emit('change', false)
    await nextTick()
    const payload = await confirmPayload(wrapper)
    expect(payload.selected).toEqual([])
    wrapper.unmount()
  })

  it('resolves enum options from function form', async () => {
    const wrapper = setupForm(
      { filterType: 'enum', enumOptions: () => [{ label: 'X', value: 'x' }] },
      { type: 'enum', selected: [] },
    )
    await nextTick()
    expect(wrapper.findAll('.el-checkbox').length).toBeGreaterThan(0)
    wrapper.unmount()
  })
})
