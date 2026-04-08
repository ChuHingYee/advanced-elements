/**
 * <zh/> 创建搜索字段的辅助函数。
 * <en/> Helpers for building search fields.
 *
 * <zh/> 提供将表格列配置（AdvColumn）转换为搜索表单字段（FormField）的能力，支持字段类型映射、占位符生成、组件属性合并，以及分组列下叶子列的遍历。
 * <en/> Convert table column configs (AdvColumn) into search-form fields (FormField), supporting field-type mapping, placeholder generation, component-prop merging and traversal of leaf columns under group columns.
 */

import type { FormItemProps } from 'element-plus'
import type { FormField } from '../components/search/types'
import type { AdvColumn } from '../types'
import type { Translator } from '../types/translator'
import { traverseLeafColumns } from './column-tree'

/**
 * <zh/> valueType 到 Element Plus 表单组件名的映射表。
 * <en/> Map from valueType to the Element Plus form component name.
 *
 * <zh/> 将表格列的数据类型（text / select / date 等）映射为搜索表单中渲染的组件类型（input / select / datePicker 等）。
 * <en/> Maps a column's data type (text / select / date, etc.) to the component type rendered in the search form (input / select / datePicker, etc.).
 */
const VALUE_TYPE_COMPONENT_MAP: Record<string, string> = {
  text: 'input',
  textarea: 'input',
  money: 'number',
  digit: 'number',
  date: 'datePicker',
  dateTime: 'datePicker',
  dateRange: 'datePicker',
  dateTimeRange: 'datePicker',
  monthRange: 'datePicker',
  year: 'datePicker',
  yearRange: 'datePicker',
  select: 'select',
  switch: 'switch',
}

/**
 * <zh/> 获取搜索字段的占位符文本。
 * <en/> Get the placeholder text for a search field.
 */
function getFieldPlaceholder(column: AdvColumn, t: Translator): string {
  const label = column.label || column.prop || ''
  const selectLike = column.valueType === 'select'
    || column.valueType === 'date'
    || column.valueType === 'dateTime'
    || column.valueType === 'dateRange'
    || column.valueType === 'dateTimeRange'
    || column.valueType === 'monthRange'
    || column.valueType === 'year'
    || column.valueType === 'yearRange'
  return selectLike
    ? `${t('form.selectPlaceholder')}${label}`
    : `${t('form.inputPlaceholder')}${label}`
}

/**
 * <zh/> 获取搜索字段的组件属性。
 * <en/> Get the component props for a search field.
 */
function getFieldProps(column: AdvColumn, t: Translator): Record<string, any> {
  const props: Record<string, any> = {
    placeholder: getFieldPlaceholder(column, t),
    clearable: true,
  }

  if (column.valueType === 'select' && column.valueEnum) {
    props.options = Object.entries(column.valueEnum).map(([value, item]) => ({
      label: typeof item === 'string' ? item : item.text,
      value,
    }))
  }

  if (
    column.valueType === 'dateRange'
    || column.valueType === 'dateTimeRange'
  ) {
    props.type = 'daterange'
  }

  if (
    column.valueType === 'monthRange'
  ) {
    props.type = 'monthrange'
  }

  if (
    column.valueType === 'yearRange'
  ) {
    props.type = 'yearrange'
  }

  if (column.valueType === 'year') {
    props.type = 'year'
  }

  return props
}

/**
 * <zh/> 将列配置转换为搜索表单字段（支持分组列下的叶子列）。
 * <en/> Convert column configs into search-form fields (including leaf columns under group columns).
 *
 * @example
 * columnsToSearchFields([{ prop: 'name', valueType: 'text', search: {} }])
 * // => [{ prop: 'name', type: 'input', componentProps: { placeholder: '请输入名称', clearable: true }, itemProps: { label: undefined } }]
 */
export function columnsToSearchFields<T = any>(
  columns: AdvColumn<T>[],
  t: Translator = (path: string) => path,
): FormField[] {
  const fields: FormField[] = []

  traverseLeafColumns(columns, (col) => {
    const searchConfig = col.search
    if (!searchConfig) {
      return
    }
    if (typeof searchConfig === 'object' && searchConfig.hidden) {
      return
    }

    const formComponent = VALUE_TYPE_COMPONENT_MAP[col.valueType || 'text']
    const searchObj = typeof searchConfig === 'object' ? searchConfig : {}

    const baseComponentProps = getFieldProps(col, t)
    if (searchObj.fieldProps) {
      Object.assign(baseComponentProps, searchObj.fieldProps)
    }

    const baseItemProps: Partial<FormItemProps> = {
      label: col.label,
    }
    if (searchObj.formItemProps) {
      Object.assign(baseItemProps, searchObj.formItemProps)
    }

    const field: FormField = {
      prop: col.prop || '',
      type: formComponent || 'input',
      componentProps: baseComponentProps,
      itemProps: baseItemProps,
    }

    if (searchObj.order !== undefined) {
      field.order = searchObj.order
    }

    if (searchObj.defaultValue !== undefined) {
      field.defaultValue = searchObj.defaultValue
    }

    fields.push(field)
  })

  return fields.sort((a, b) => {
    const orderA = a.order ?? 0
    const orderB = b.order ?? 0
    return orderB - orderA
  })
}
