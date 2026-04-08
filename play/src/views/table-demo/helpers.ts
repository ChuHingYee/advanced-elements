import type { RowData } from './types'
/**
 * TableDemo 共享辅助函数与自定义组件。
 *
 * 从 TableDemo.vue 拆出，供各 section 组件按需引用。
 */
import { ElMessage, ElOption, ElSelect } from 'element-plus'
import { h } from 'vue'
import { DEPARTMENTS } from './demo-data'

//  辅助函数
export function handleShowSelection(label: string, ref: any) {
  const rows = ref?.getSelectedRows?.()
  if (rows?.length)
    ElMessage.success(`${label}：已选 ${rows.length} 条 — ${rows.map((r: any) => r.name).join(', ')}`)
  else ElMessage.info(`${label}：未选择`)
}

export function handleGetCurrentPage(label: string, ref: any) {
  const rows = ref?.getCurrentPageData?.()
  if (rows?.length)
    ElMessage.success(`${label}：当前页 ${rows.length} 条`)
  else ElMessage.info(`${label}：当前页无数据`)
}

export function rowClassNameFn({ row, rowIndex }: { row: RowData, rowIndex: number }): string {
  const classes: string[] = []
  if (row.status === 'inactive')
    classes.push('demo-row--inactive')
  if (rowIndex % 2 === 0)
    classes.push('demo-row--even')
  return classes.join(' ')
}

export function summaryMethod({ columns, data }: { columns: any[], data: any[] }) {
  return columns.map((col, idx) => {
    if (idx === 0)
      return '合计'
    const vals = data.map(r => Number(r[col.property])).filter(v => !Number.isNaN(v))
    return vals.length ? `$ ${vals.reduce((a, b) => a + b, 0)}` : 'N/A'
  })
}

/** 通过 table ref API 选中行（推荐方式）——自动过滤 disabled 行 */
export function selectViaApi(tableRef: any, keys: (string | number)[]) {
  tableRef?.selectRowsByKeys?.(keys, true)
}

//  搜索字段 & 自定义组件
export const searchFields = [
  { prop: 'name', type: 'input' as const, componentProps: { placeholder: '请输入姓名', clearable: true }, itemProps: { label: '姓名' } },
  { prop: 'status', type: 'select' as const, componentProps: { style: 'width:100px', placeholder: '请选择状态', clearable: true, options: [{ label: '启用', value: 'active' }, { label: '禁用', value: 'inactive' }, { label: '待审', value: 'pending' }] }, itemProps: { label: '状态' } },
  { prop: 'createdAt', type: 'datePicker' as const, componentProps: { type: 'daterange' as const, startPlaceholder: '开始日期', endPlaceholder: '结束日期', valueFormat: 'YYYY-MM-DD' }, itemProps: { label: '创建时间' } },
]

const CustomGenderSelect = {
  props: { modelValue: String, placeholder: { type: String, default: '请选择' }, clearable: Boolean },
  emits: ['update:modelValue'],
  setup(props: any, { emit }: any) {
    return () => h(ElSelect, { 'modelValue': props.modelValue, 'onUpdate:modelValue': (val: string) => emit('update:modelValue', val), 'placeholder': props.placeholder, 'clearable': props.clearable, 'style': { width: '100%' } }, () => [
      h(ElOption, { label: '男', value: 'male' }),
      h(ElOption, { label: '女', value: 'female' }),
    ])
  },
}

export const customComponents = { customSelect: CustomGenderSelect }

export const customSearchFields = [
  { prop: 'name', type: 'input' as const, componentProps: { placeholder: '请输入姓名', clearable: true }, itemProps: { label: '姓名' } },
  { prop: 'gender', type: 'customSelect' as const, componentProps: { placeholder: '请选择性别', clearable: true }, itemProps: { label: '性别' } },
  { prop: 'status', type: 'select' as const, componentProps: { placeholder: '请选择状态', clearable: true, options: [{ label: '启用', value: 'active' }, { label: '禁用', value: 'inactive' }, { label: '待审', value: 'pending' }] }, itemProps: { label: '状态' } },
  { prop: 'department', type: 'select' as const, componentProps: { placeholder: '请选择部门', clearable: true, options: DEPARTMENTS.map(d => ({ label: d, value: d })) }, itemProps: { label: '部门' } },
]
