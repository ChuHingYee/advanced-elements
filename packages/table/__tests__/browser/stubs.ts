import type { Component, defineComponent } from 'vue'
import { h } from 'vue'

/**
 * Map element-plus component names to natural HTML elements.
 * Tests using `wrapper.find('button')`, `.find('input')` etc. must still work.
 */
const TAG_MAP: Record<string, string> = {
  ElButton: 'button',
  ElIcon: 'i',
  ElInput: 'input',
  ElInputNumber: 'input',
  ElSelect: 'select',
  ElOption: 'option',
  ElCheckbox: 'input',
  ElRadio: 'input',
  ElSwitch: 'input',
  ElLink: 'a',
  ElAvatar: 'img',
  ElImage: 'img',
  ElProgress: 'progress',
  ElRate: 'span',
  ElBadge: 'span',
  ElTag: 'span',
  ElTooltip: 'span',
  ElPopover: 'span',
  ElTable: 'table',
  ElTableColumn: 'col',
  ElTableV2: 'table',
  ElPagination: 'nav',
  ElForm: 'form',
  ElFormItem: 'div',
  ElCollapse: 'div',
  ElCollapseItem: 'div',
  ElDatePicker: 'input',
  ElScrollbar: 'div',
  ElAutoResizer: 'div',
  ElSpace: 'div',
  ElRow: 'div',
  ElCol: 'div',
  ElDivider: 'hr',
  ElDropdown: 'div',
  ElDropdownMenu: 'ul',
  ElDropdownItem: 'li',
  ElCheckboxGroup: 'div',
  ElRadioGroup: 'div',
}

/** Props shared by many element-plus components. */
const COMMON_PROPS = {
  size: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
}

/** ElTable props sourced from element-plus source. */
const TABLE_PROPS = {
  data: { type: Array, default: () => [] },
  height: { type: [String, Number], default: '' },
  maxHeight: { type: [String, Number], default: '' },
  stripe: { type: Boolean, default: false },
  border: { type: Boolean, default: false },
  size: { type: String, default: '' },
  fit: { type: Boolean, default: true },
  showHeader: { type: Boolean, default: true },
  highlightCurrentRow: { type: Boolean, default: false },
  rowKey: { type: [String, Function], default: '' },
  rowClassName: { type: [String, Function], default: '' },
  rowStyle: { type: [Object, Function], default: () => ({}) },
  cellClassName: { type: [String, Function], default: '' },
  cellStyle: { type: [Object, Function], default: () => ({}) },
  headerRowClassName: { type: [String, Function], default: '' },
  headerRowStyle: { type: [Object, Function], default: () => ({}) },
  headerCellClassName: { type: [String, Function], default: '' },
  headerCellStyle: { type: [Object, Function], default: () => ({}) },
  indent: { type: Number, default: 16 },
  lazy: { type: Boolean, default: false },
  load: { type: Function, default: null },
  treeProps: { type: Object, default: () => ({}) },
  defaultSort: { type: Object, default: () => ({}) },
  emptyText: { type: String, default: '' },
  tooltipEffect: { type: String, default: 'dark' },
  showSummary: { type: Boolean, default: false },
  sumText: { type: String, default: '' },
  summaryMethod: { type: Function, default: null },
  spanMethod: { type: Function, default: null },
  selectOnIndeterminate: { type: Boolean, default: true },
  headerCellClass: { type: [String, Function], default: '' },
}

/** Known class names for stub wrapper elements. */
const WRAPPER_CLASS: Record<string, string> = {
  ElPagination: 'el-pagination',
  ElTable: 'el-table',
  ElTableV2: 'el-table-v2',
  ElTableColumn: 'el-table-column',
  ElFormItem: 'el-form-item',
  ElButton: 'el-button',
}

/**
 * Create a Vue component stub that renders a native HTML element
 * with all incoming attrs forwarded, plus realistic props for
 * components that are introspected (ElTable, ElPagination etc.).
 *
 * Named slots (`#reference`, `#default`) are rendered alongside
 * the default slot when present.
 */
export function stub(name: string, extraProps: Record<string, any> = {}): Component {
  const tag = TAG_MAP[name] ?? 'span'
  const props: Record<string, any> = { ...COMMON_PROPS, ...extraProps }

  if (name === 'ElTable' || name === 'ElTableV2') {
    Object.assign(props, TABLE_PROPS)
  }

  const wrapperClass = WRAPPER_CLASS[name]

  const comp: ReturnType<typeof defineComponent> = {
    name,
    props,
    setup(_: any, { slots, attrs }: any) {
      return () => {
        const children: any[] = []

        // Render named slots first (reference, header, etc.)
        for (const key of Object.keys(slots)) {
          if (key === 'default')
            continue
          const vnodes = slots[key]?.() ?? []
          children.push(...vnodes)
        }

        // Render default slot content last
        const defaultContent = slots.default?.() ?? []
        children.push(...defaultContent)

        const finalAttrs = wrapperClass
          ? { ...attrs, class: [attrs.class, wrapperClass].filter(Boolean).join(' ') }
          : { ...attrs }

        return h(tag, finalAttrs, children.length ? children : null as any)
      }
    },
  }
  return comp
}

/** stubDirective returns a no-op directive object. */
export function stubDirective() {
  return { mounted: () => {}, unmounted: () => {} }
}
