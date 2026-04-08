import type { ButtonProps, FormItemProps } from 'element-plus'
import type { Component } from 'vue'

export type ButtonAction = 'reset' | 'query' | 'add' | 'fullscreen'

export interface CustomButton {
  type: string
  label: string
  props?: Partial<ButtonProps>
}

export type ButtonConfig = (ButtonAction | CustomButton)[]

export type FormItemType = 'input' | string

export type QueryFormModel = Record<string, any>

export type FormFieldHiddenResolver = (model: QueryFormModel) => boolean
export type FormFieldDisabledResolver = (
  model: QueryFormModel,
) => boolean | Promise<boolean>

export interface FormField {
  prop: string
  type: FormItemType
  componentProps?: Record<string, any>
  itemProps?: Partial<FormItemProps>
  /**
   * <zh/> 排序权重——越大越靠前（降序）。缺省 0。
   * <en/> Sort weight — larger comes first (descending). Defaults to 0.
   */
  order?: number
  hidden?: boolean
  hiddenFunc?: FormFieldHiddenResolver
  disabledFunc?: FormFieldDisabledResolver
  dynamicWidth?: boolean
  /** <zh/> 搜索字段默认值，初始化时自动填入表单 | <en/> default value for the search field, auto-filled into the form on init */
  defaultValue?: any
}

export type ComponentsMap = Record<string, Component>

export type ItemRefsMap = Record<
  string,
  {
    el: any
    width: number | null
  }
>

export interface QueryFormProps {
  /** <zh/> 表单数据模型（支持 v-model 双向绑定） | <en/> Form data model (supports v-model two-way binding) */
  modelValue: Record<string, any>
  /** <zh/> 搜索表单项配置数组，定义每个字段的类型、属性、显隐逻辑等 | <en/> Search form item config array, defines each field's type, props, show/hide logic, etc. */
  fields: FormField[]
  /**
   * <zh/> 按钮配置，支持内置按钮名（query/reset/add/fullscreen）或自定义按钮对象
   * <en/> Button config, supports built-in button names (query/reset/add/fullscreen) or custom button objects
   * @default ['query', 'reset']
   */
  buttons?: ButtonConfig
  /** <zh/> 自定义组件映射，键为字段 type，值为组件，会与内置组件合并 | <en/> Custom component map, key is field type, value is component, merged with built-in components */
  components?: ComponentsMap
  /** <zh/> 全屏目标元素的 CSS 选择器，指定后启用全屏切换按钮 | <en/> CSS selector of the fullscreen target element; enables fullscreen toggle button once set */
  fullscreenTarget?: string
  /**
   * <zh/> 表单项之间的间距（像素）
   * <en/> Gap between form items (pixels)
   * @default 8
   */
  itemGap?: number
  /**
   * <zh/> 禁用自适应宽度折叠功能
   * <en/> Disable adaptive-width collapse
   * @default false
   */
  disableResize?: boolean
  /** <zh/> 表单标签宽度 | <en/> Form label width */
  labelWidth?: number | 'auto'
  /**
   * <zh/> 初始是否折叠（收起超出宽度的表单项）
   * <en/> Initial collapsed state (hide form items overflowing width)
   * @default false
   */
  collapsed?: boolean
  /** <zh/> 自定义查询按钮文字，默认使用国际化 key | <en/> Custom query button text, defaults to i18n key */
  searchText?: string
  /** <zh/> 自定义重置按钮文字，默认使用国际化 key | <en/> Custom reset button text, defaults to i18n key */
  resetText?: string
}
