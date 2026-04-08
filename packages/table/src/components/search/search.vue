<!--
  @component Search
  @displayName 表格搜索栏
  @displayName Table Search
  @description <zh/> 自包含的表格搜索栏组件，支持字段搜索、折叠/展开、内置按钮及自定义按钮配置
  @description <en/> Self-contained table search bar component, supports field search, collapse/expand, built-in buttons and custom button config
  @category 数据录入 | Data Entry
  @extends ElForm
  @since 1.0.0
-->
<script setup lang="ts">
import type { ButtonProps, FormInstance } from 'element-plus'
import type {
  ButtonConfig,
  ComponentsMap,
  CustomButton,
  FormField,
  ItemRefsMap,
} from './types'
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import { useFullscreen } from '@vueuse/core'
import {
  ElButton,
  ElDatePicker,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
  ElSwitch,
} from 'element-plus'
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, readonly, ref, watch, watchEffect } from 'vue'
import { DEFAULT_SEARCH_DEBOUNCE } from '../../constants'
import { useAdvLocale } from '../../locale'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { useSearchDisabledResolver } from './use-search-disabled-resolver'
import { useSearchLayout } from './use-search-layout'

/**
 * <zh/> 表格搜索表单组件。
 * <en/> Table search form component.
 *
 * <zh/> 支持字段搜索、折叠/展开、内置按钮（查询/重置/新增/全屏）及自定义按钮配置。
 * <en/> Supports field search, collapse/expand, built-in buttons (query/reset/add/fullscreen) and custom button config.
 * <zh/> 具备自适应宽度布局，当表单项超出容器宽度时自动折叠隐藏，并提供展开按钮。
 * <en/> Has an adaptive-width layout that auto-collapses items overflowing the container width and provides an expand button.
 * <zh/> 支持字段动态显隐（hidden / hiddenFunc）、动态禁用（disabledFunc）、自定义组件映射等能力。
 * <en/> Supports dynamic field show/hide (hidden / hiddenFunc), dynamic disable (disabledFunc), and custom component mapping.
 */
defineOptions({
  name: 'QueryForm',
})

/**
 * <zh/> Props 定义，详见各属性行内注释 | <en/> Props definition, see inline comments per property
 */
const props = withDefaults(defineProps<{
  /** <zh/> 搜索表单项配置数组，定义每个字段的类型、属性、显隐逻辑等 | <en/> search form item config array, defines each field's type, props, show/hide logic, etc. */
  fields: FormField[]
  /** <zh/> 按钮配置，支持内置按钮名（query/reset/add/fullscreen）或自定义按钮对象 | <en/> button config, supports built-in button names (query/reset/add/fullscreen) or custom button objects */
  buttons?: ButtonConfig
  /** <zh/> 自定义组件映射，键为字段 type，值为组件，会与内置组件合并 | <en/> custom component map, key is field type, value is component, merged with built-in components */
  components?: ComponentsMap
  /** <zh/> 全屏目标元素的 CSS 选择器，指定后启用全屏切换按钮 | <en/> CSS selector of the fullscreen target element; enables fullscreen toggle button once set */
  fullscreenTarget?: string
  /** <zh/> 表单项之间的间距（像素） | <en/> gap between form items (pixels) */
  itemGap?: number
  /** <zh/> 禁用自适应宽度折叠功能 | <en/> disable adaptive-width collapse */
  disableResize?: boolean
  /** <zh/> 表单标签宽度 | <en/> form label width */
  labelWidth?: number | 'auto'
  /** <zh/> 初始是否折叠（收起超出宽度的表单项） | <en/> initial collapsed state (hide form items overflowing width) */
  collapsed?: boolean
  /** <zh/> 自定义查询按钮文字，默认使用国际化 key | <en/> custom query button text, defaults to i18n key */
  searchText?: string
  /** <zh/> 自定义重置按钮文字，默认使用国际化 key | <en/> custom reset button text, defaults to i18n key */
  resetText?: string
  /** <zh/> 表单数据变化后重新计算布局的防抖延迟（毫秒） | <en/> debounce delay (ms) before recalculating layout after data change */
  debounceTime?: number
}>(), {
  buttons: () => ['query', 'reset'],
  itemGap: 8,
  disableResize: false,
  collapsed: false,
  debounceTime: DEFAULT_SEARCH_DEBOUNCE,
})

/**
 * <zh/> 触发事件：
 * <en/> Emitted events:
 * <zh/> - expand: 展开/折叠状态变化时触发
 * <en/> - expand: triggered when expand/collapse state changes
 * <zh/> - query: 点击查询按钮时触发
 * <en/> - query: triggered when the query button is clicked
 * <zh/> - reset: 点击重置按钮时触发
 * <en/> - reset: triggered when the reset button is clicked
 * <zh/> - add: 点击新增按钮时触发
 * <en/> - add: triggered when the add button is clicked
 * <zh/> - fullscreen: 全屏状态变化时触发
 * <en/> - fullscreen: triggered when fullscreen state changes
 * <zh/> - change: 任意表单项的值变化时触发
 * <en/> - change: triggered when any form item value changes
 * <zh/> - resize: 表单项尺寸变化时触发
 * <en/> - resize: triggered when a form item's size changes
 * <zh/> - fieldChange: 表单项内部事件（如 select 的 change）冒泡时触发
 * <en/> - fieldChange: triggered when a form item's internal event (e.g. select change) bubbles up
 * <zh/> - btnClick: 点击自定义按钮时触发
 * <en/> - btnClick: triggered when a custom button is clicked
 */
const emit = defineEmits<{
  (e: 'expand', val: boolean): void
  (e: 'query', val: Record<string, any>): void
  (e: 'reset'): void
  (e: 'add'): void
  (e: 'fullscreen', val: boolean): void
  (e: 'change', key: string, val: any, formModel: Record<string, any>): void
  (e: 'resize', map: ItemRefsMap): void
  (e: 'fieldChange', key: string, args: any): void
  (e: 'btnClick', type: string, btn: CustomButton): void
}>()

/** <zh/> 搜索表单数据双向绑定 | <en/> two-way binding of search form data */
const model = defineModel<Record<string, any>>({ required: true })
const { t } = useAdvLocale()

const formRef = ref<FormInstance>()
const btnRef = ref<any>()

/** <zh/> 内置组件映射，将字段 type 映射到 Element Plus 组件 | <en/> built-in component map, maps field type to Element Plus components */
const BUILTIN_MAP: ComponentsMap = {
  input: ElInput,
  select: ElSelect,
  datePicker: ElDatePicker,
  switch: ElSwitch,
  number: ElInputNumber,
}

/** <zh/> 合并后的完整组件映射（内置 + 用户自定义），自定义组件会覆盖同名的内置组件 | <en/> merged full component map (built-in + custom); custom components override same-named built-in ones */
const componentMap = computed<ComponentsMap>(() => {
  const custom = props.components
  if (!custom || Object.keys(custom).length === 0)
    return BUILTIN_MAP
  return {
    ...BUILTIN_MAP,
    ...Object.fromEntries(
      Object.entries(custom).map(([key, component]) => [key, markRaw(component)]),
    ),
  }
})

// ── Expand / collapse state ──

const expanded = ref(!props.collapsed)

/**
 * <zh/> 追踪用户是否主动展开——区分「用户点击展开按钮」与「程序自动展开」。
 * <en/> Track whether the user actively expanded — distinguish "user clicked expand" from "program auto-expanded".
 * <zh/> - 用户主动展开时为 true：resize 不会自动折叠，尊重用户意愿
 * <en/> - true when user actively expanded: resize won't auto-collapse, respecting user intent
 * <zh/> - 程序自动展开时为 false：resize 宽度变小时可自动折叠回折叠态
 * <en/> - false when programmatically auto-expanded: resize shrinking allows collapsing back to collapsed state
 * <zh/> - 用户手动折叠时重置为 false：恢复正常折叠行为
 * <en/> - reset to false when user manually collapses: restores normal collapse behavior
 */
const userExpanded = ref(false)

// ── Fullscreen ──

const fullscreenTargetEl = ref<HTMLElement | undefined>(undefined)
onMounted(() => {
  if (props.fullscreenTarget) {
    // SSR 水合后才有 document，守卫避免服务端求值崩溃
    // document exists only after SSR hydration; guard against server-side crashes
    if (typeof document === 'undefined')
      return
    // <zh/> 非法选择器（如 `#123`）抛 SyntaxError——捕获后 dev 告警并回退未定义，全屏挂载在表单根而非中断渲染
    // <en/> Illegal selectors (e.g. `#123`) throw SyntaxError — catch, dev-warn and fall back to undefined so fullscreen mounts on the form root instead of breaking render
    try {
      fullscreenTargetEl.value
        = (document.querySelector(props.fullscreenTarget) as HTMLElement) ?? undefined
    }
    catch {
      devWarn(`[AdvTable] Invalid \`fullscreenTarget\` selector "${props.fullscreenTarget}" — falling back to the search form element.`)
      fullscreenTargetEl.value = undefined
    }
  }
})
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(fullscreenTargetEl)
watch(isFullscreen, val => emit('fullscreen', val))

// ── Shared state (between main component and composables) ──

const formItemRefs: ItemRefsMap = {}
/**
 * <zh/> 组件实例映射（与 formItemRefs 同处声明：上方 fields watcher 在清理时引用，须先定义）
 * <en/> Component instance map (declared alongside formItemRefs: the fields watcher above references it during cleanup, so it must be defined first)
 */
const componentRefs: Record<string, any> = {}
const customHiddenMap = ref<Record<string, boolean>>({})

// ── Layout composable: adaptive width, shadow visibility, ResizeObserver, rAF/debounce ──

const {
  systemHiddenMap,
  initialized,
  getVisibilityClass,
  getVisibilityStyle,
  triggerLayoutRecalc,
  calculateVisibility,
  captureVisibleSnapshot,
  removeField: removeLayoutField,
  resetExpandBtnWidthCache,
  setFormItemWidth,
} = useSearchLayout({
  fields: () => props.fields,
  itemGap: () => props.itemGap,
  disableResize: () => props.disableResize,
  debounceTime: () => props.debounceTime,
  expanded,
  userExpanded,
  customHiddenMap,
  formItemRefs,
  formEl: () => formRef.value?.$el,
  btnRef,
  onExpandChange: (val: boolean) => emit('expand', val),
})

// ── Disabled resolver composable: async disabledFunc with version tracking ──

const {
  resolvedDisabledMap,
  syncDisabledStates,
  removeField: removeDisabledField,
} = useSearchDisabledResolver({
  fields: () => props.fields,
})

// ── Expand / collapse management ──

watch(() => props.collapsed, (val) => {
  expanded.value = !val
  userExpanded.value = !val
  captureVisibleSnapshot()
})

/** <zh/> 设置展开/折叠状态 | <en/> Set the expand/collapse state */
function setExpanded(flag: boolean) {
  expanded.value = flag
  userExpanded.value = flag
  emit('expand', expanded.value)
  captureVisibleSnapshot()
}

/** <zh/> 切换展开/折叠状态 | <en/> toggle expand/collapse state */
function toggleExpanded() {
  setExpanded(!expanded.value)
}

// ── Reactive field visibility + disabled state sync ──

watchEffect(() => {
  const formModel = model.value
  props.fields.forEach((item) => {
    if (item.hidden) {
      customHiddenMap.value[item.prop] = true
    }
    else if (item.hiddenFunc) {
      customHiddenMap.value[item.prop] = item.hiddenFunc(formModel)
    }
    else {
      customHiddenMap.value[item.prop] = false
    }
  })
  syncDisabledStates(formModel)
})

// ── Field lifecycle: cleanup removed fields ──

watch(
  () => props.fields.map(f => f.prop),
  (newProps) => {
    const currentSet = new Set(newProps)
    Object.keys(formItemRefs).forEach((key) => {
      if (!currentSet.has(key)) {
        delete formItemRefs[key]
        delete componentRefs[key]
        removeLayoutField(key)
        removeDisabledField(key)
        delete customHiddenMap.value[key]
      }
    })
    captureVisibleSnapshot()
    resetExpandBtnWidthCache()
    triggerLayoutRecalc()
  },
)

// ── Ref binding helpers ──

function bindFormItemRef(key: string, el: any) {
  if (el) {
    formItemRefs[key] = { el, width: null }
    setFormItemWidth(key, null)
  }
}

/**
 * <zh/> 模板 ref 绑定——卸载时 Vue 回传 null，此时删除条目，避免动态增删字段后
 * <zh/> `getComponentRefs` 拿到已卸载实例。字段移除的兜底清理见上方 fields watcher。
 * <en/> Template ref binding — Vue passes null on unmount; the entry is deleted then,
 * <en/> so `getComponentRefs` never returns an unmounted instance after dynamic field
 * <en/> add/remove. The fields watcher above is the fallback cleanup for removals.
 */
function bindComponentRef(key: string, el: any) {
  if (el)
    componentRefs[key] = el
  else
    delete componentRefs[key]
}
function getComponentRefs(key?: string) {
  return key ? componentRefs[key] : componentRefs
}
onBeforeUnmount(() => {
  for (const key of Object.keys(componentRefs))
    delete componentRefs[key]
})

// ── Event handlers ──

function onModelChange(val: any, prop: string) {
  model.value = {
    ...model.value,
    [prop]: val,
  }
  emit('change', prop, val, model.value)
  nextTick(() => triggerLayoutRecalc())
}

function onFormItemResize(prop: string, itemWidth: number) {
  if (formItemRefs[prop])
    formItemRefs[prop].width = itemWidth
  setFormItemWidth(prop, itemWidth)
  triggerLayoutRecalc()
  emit('resize', formItemRefs)
}

function onFieldChange(prop: string, args: any) {
  emit('fieldChange', prop, args)
}

/**
 * <zh/> 按字段缓存的事件 handler 表——替代模板 `v-for` 内联箭头函数，
 * <zh/> 引用随 fields 变化而更新，而非每次渲染新建。
 * <en/> Per-field cached event handler maps — replace inline arrow functions in template `v-for`;
 * <en/> references update only when fields change, not per render.
 */
const fieldResizeHandlers = computed<Record<string, (val: number) => void>>(() => {
  const map: Record<string, (val: number) => void> = {}
  for (const field of props.fields)
    map[field.prop] = (val: number) => onFormItemResize(field.prop, val)
  return map
})
const fieldChangeHandlers = computed<Record<string, (...args: any[]) => void>>(() => {
  const map: Record<string, (...args: any[]) => void> = {}
  for (const field of props.fields)
    map[field.prop] = (...args: any[]) => onFieldChange(field.prop, args)
  return map
})

function handleQueryEvent() {
  emit('query', { ...model.value })
}

function handleResetEvent() {
  formRef.value?.resetFields()
  emit('reset')
}

function handleAddEvent() {
  emit('add')
}

function handleBtnEvent(btn: CustomButton) {
  emit('btnClick', btn.type, btn)
}

// ── Button config ──

const fullscreenText = computed(() =>
  isFullscreen.value ? t('form.exitFullscreen') : t('form.fullscreen'),
)

const builtInButtons = computed<Record<string, { onClick: () => void, text: string | (() => string), type?: ButtonProps['type'] }>>(() => ({
  query: { onClick: handleQueryEvent, text: props.searchText ?? t('table.query'), type: 'primary' },
  reset: { onClick: handleResetEvent, text: props.resetText ?? t('table.reset') },
  add: { onClick: handleAddEvent, text: t('form.add'), type: 'primary' },
  fullscreen: {
    onClick: toggleFullscreen,
    text: () => fullscreenText.value,
    type: 'primary',
  },
}))

const hasHiddenItems = computed(() => {
  if (props.disableResize)
    return false
  return (
    Object.values(systemHiddenMap.value).some(Boolean)
    || Object.values(customHiddenMap.value).some(Boolean)
    || props.fields.some(item => item.hidden)
  )
})

// ── Dev warnings: duplicate prop detection ──

if (isDev) {
  const duplicateProps = computed(() => {
    const map: Record<string, number> = {}
    props.fields.forEach(item => (map[item.prop] = (map[item.prop] || 0) + 1))
    return Object.keys(map).filter(key => map[key] > 1)
  })
  watch(duplicateProps, (dups) => {
    if (dups.length)
      devWarn(`[QueryForm] 以下字段重复: ${dups.join(', ')}`)
  })
}

defineExpose({
  getComponentRefs,
  resize: calculateVisibility,
  toggleFullscreen,
  setExpanded,
  expanded: readonly(expanded),
})
</script>

<template>
  <ElForm
    ref="formRef"
    class="adv-table-search-form"
    :class="{
      'adv-table-search-form--initialized': initialized,
      'adv-table-search-form--expanded': expanded,
    }"
    :style="{ '--adv-table-search-form-item-gap': `${itemGap}px` }"
    :model="model"
    :inline="true"
    :label-width="labelWidth"
  >
    <!--
      @slot 表单顶部自定义内容（渲染在所有表单项之前）
      @slot Custom content at the form top (rendered before all form items)
    -->
    <slot />
    <ElFormItem
      v-for="(field, index) in fields"
      :key="field.prop"
      v-bind="field.itemProps || {}"
      :ref="(el: any) => bindFormItemRef(field.prop, el)"
      :prop="field.prop"
      class="adv-table-search-form__item"
      :class="getVisibilityClass(field.prop)"
      :style="getVisibilityStyle(field.prop, fields.length - index)"
    >
      <component
        :is="componentMap[field.type]"
        v-bind="field.componentProps || {}"
        :ref="(el: any) => bindComponentRef(field.prop, el)"
        :model-value="model[field.prop]"
        :disabled="resolvedDisabledMap[field.prop] ?? false"
        @update:model-value="onModelChange($event, field.prop)"
        @resize="fieldResizeHandlers[field.prop]"
        @change="fieldChangeHandlers[field.prop]"
      >
        <template v-if="field.type === 'select' && field.componentProps?.options">
          <ElOption
            v-for="opt in field.componentProps.options"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
            :disabled="opt.disabled"
          />
        </template>
      </component>
    </ElFormItem>

    <ElFormItem
      ref="btnRef"
      key="btn"
      prop="adv-btn"
      class="adv-table-search-form__buttons"
    >
      <!--
        @slot 按钮区前置内容（渲染在内置/自定义按钮之前）
        @slot Content prepended to the button area (rendered before built-in/custom buttons)
      -->
      <slot name="buttonsPrepend" />

      <template
        v-for="btn in buttons"
        :key="typeof btn === 'string' ? btn : btn.type"
      >
        <ElButton
          v-if="typeof btn === 'string' && builtInButtons[btn]"
          :type="builtInButtons[btn]?.type"
          @click="builtInButtons[btn].onClick"
        >
          {{ typeof builtInButtons[btn].text === 'function' ? builtInButtons[btn].text() : builtInButtons[btn].text }}
        </ElButton>
        <ElButton
          v-else-if="typeof btn !== 'string'"
          v-bind="btn.props"
          @click="handleBtnEvent(btn)"
        >
          {{ btn.label || btn.type }}
        </ElButton>
      </template>

      <!--
        @slot 按钮区后置内容（渲染在按钮之后、展开按钮之前）
        @slot Content appended to the button area (rendered after buttons, before the expand button)
      -->
      <slot name="buttonsAppend" />

      <ElButton
        v-show="hasHiddenItems"
        data-expand-btn
        link
        type="primary"
        @click="toggleExpanded"
      >
        {{ expanded ? t('form.collapse') : t('form.expand') }}
        <ElIcon class="adv-table-search-form__button-icon">
          <ArrowUp v-show="expanded" />
          <ArrowDown v-show="!expanded" />
        </ElIcon>
      </ElButton>
    </ElFormItem>
  </ElForm>
</template>
