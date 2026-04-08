/**
 * TableDemo 所有列配置定义。
 *
 * 从 TableDemo.vue 拆出，供各 section 组件按需引用。
 * 依赖响应式状态的列配置以工厂函数形式导出。
 */
import type { AdvColumn } from '@advanced-elements/elements'
import type { AddressRow, CityRow, ColMergeRow, CompRow, EmpRow, ExpandOrderRow, GroupRow, MergeRow, OrderDetailRow, OrderRow, RowData, TreeNode } from './types'
import { ElMessage } from 'element-plus'
import { h } from 'vue'
import { COUNTRY_CITY_MAP, DISABLED_IDS, SKILL_LIST, STATUS_LIST } from './demo-data'

//  基础展示

// 基础列：展示所有 valueType
export const allValueTypeColumns: AdvColumn<RowData>[] = [
  { selection: true, selectable: (row: RowData) => !DISABLED_IDS.has(row.id) },
  { prop: 'id', label: 'indexBorder', width: 100, valueType: 'indexBorder' },
  { prop: 'name', label: '文本(text)', width: 130 },
  { prop: 'age', label: '数字(digit)', width: 100, valueType: 'digit', sortable: true },
  {
    prop: 'gender',
    label: '枚举(select)',
    width: 100,
    valueType: 'select',
    valueEnum: { male: { text: '男', status: 'info' }, female: { text: '女', status: 'success' } },
  },
  {
    prop: 'status',
    label: '状态(select)',
    width: 100,
    valueType: 'select',
    valueEnum: { active: { text: '启用', status: 'success' }, inactive: { text: '禁用', status: 'danger' }, pending: { text: '待审', status: 'warning' } },
  },
  { prop: 'salary', label: '金额(money)', width: 120, valueType: 'money' },
  { prop: 'balance', label: '金额+复制', width: 130, valueType: 'money', copyable: true },
  { prop: 'progress', label: '进度(progress)', width: 120, valueType: 'progress' },
  { prop: 'rate', label: '评分(rate)', width: 140, valueType: 'rate' },
  { prop: 'isActive', label: '开关(switch)', width: 100, valueType: 'switch' },
  { prop: 'createdAt', label: '日期(dateTime)', width: 180, valueType: 'dateTime' },
  { prop: 'email', label: '链接(link)', width: 180, valueType: 'link', copyable: true },
  { prop: 'avatar', label: '头像(avatar)', width: 70, valueType: 'avatar' },
  { prop: 'color', label: '颜色(color)', width: 70, valueType: 'color' },
]

// 筛选/排序列
export const filterSortColumns: AdvColumn<RowData>[] = [
  { selection: true },
  { prop: 'id', label: 'ID', width: 70, sortable: true },
  { prop: 'name', label: '姓名', width: 130, filter: 'text' },
  { prop: 'age', label: '年龄', width: 100, valueType: 'digit', filter: { type: 'number' }, sortable: true },
  {
    prop: 'gender',
    label: '性别',
    width: 100,
    valueType: 'select',
    valueEnum: { male: { text: '男', status: 'info' }, female: { text: '女', status: 'success' } },
    filter: { type: 'enum' },
  },
  {
    prop: 'status',
    label: '状态',
    width: 100,
    valueType: 'select',
    valueEnum: { active: { text: '启用', status: 'success' }, inactive: { text: '禁用', status: 'danger' }, pending: { text: '待审', status: 'warning' } },
    filter: { type: 'enum' },
  },
  { prop: 'salary', label: '薪资', width: 120, valueType: 'money', filter: { type: 'number' }, sortable: true },
  { prop: 'progress', label: '进度', width: 120, valueType: 'progress', filter: { type: 'number' } },
  { prop: 'createdAt', label: '创建时间', width: 170, valueType: 'dateTime', sortable: true, filter: { type: 'date' } },
  { label: '操作', valueType: 'option', width: 120, fixed: 'right', actions: [{ label: '编辑', type: 'primary', onClick: () => { } }] },
]

// 虚拟模式 + 多级表头 + 浮动筛选
export const virtualGroupColumns: AdvColumn<RowData>[] = [
  { selection: true, width: 50 },
  {
    label: '基础信息',
    align: 'center',
    children: [
      { prop: 'id', label: 'ID', width: 70, sortable: true },
      { prop: 'name', label: '姓名', width: 130, filter: 'text' },
      {
        prop: 'gender',
        label: '性别',
        width: 100,
        valueType: 'select',
        valueEnum: { male: { text: '男', status: 'info' }, female: { text: '女', status: 'success' } },
        filter: { type: 'enum' },
      },
    ],
  },
  {
    label: '状态与进度',
    align: 'center',
    children: [
      {
        prop: 'status',
        label: '状态',
        width: 100,
        valueType: 'select',
        valueEnum: { active: { text: '启用', status: 'success' }, inactive: { text: '禁用', status: 'danger' }, pending: { text: '待审', status: 'warning' } },
        filter: { type: 'enum' },
      },
      { prop: 'progress', label: '进度', width: 120, valueType: 'progress', filter: { type: 'number' } },
    ],
  },
  {
    label: '财务',
    align: 'center',
    children: [
      { prop: 'age', label: '年龄', width: 100, valueType: 'digit', filter: { type: 'number' }, sortable: true },
      { prop: 'salary', label: '薪资', width: 120, valueType: 'money', filter: { type: 'number' }, sortable: true },
    ],
  },
  { prop: 'createdAt', label: '创建时间', width: 170, valueType: 'dateTime', sortable: true, filter: { type: 'date' } },
  { label: '操作', valueType: 'option', width: 120, fixed: 'right', actions: [{ label: '编辑', type: 'primary', onClick: () => { } }] },
]

// 多级表头 + 可折叠分组
export const groupColumns: AdvColumn<RowData>[] = [
  { prop: 'id', label: 'ID', width: 70, valueType: 'indexBorder' },
  { prop: 'name', label: '姓名', width: 100 },
  {
    label: '财务信息',
    align: 'center',
    children: [
      { prop: 'salary', label: '薪资', width: 110, valueType: 'money', columnGroupShow: 'open' },
      { prop: 'balance', label: '余额', width: 120, valueType: 'money', copyable: true, columnGroupShow: 'closed' },
    ],
  },
  {
    label: '个人信息',
    children: [
      { prop: 'name', label: '姓名', width: 100 },
      { prop: 'age', label: '年龄', width: 70, valueType: 'digit' },
    ],
  },
  {
    label: '评分',
    children: [
      { prop: 'rate', label: '评分', width: 140, valueType: 'rate', columnGroupShow: 'open' },
      { prop: 'progress', label: '进度', width: 120, valueType: 'progress', columnGroupShow: 'closed' },
    ],
  },
]

// 按钮列 (optionHover)
export const optionColumns: AdvColumn<RowData>[] = [
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'name', label: '姓名', minWidth: 120 },
  {
    label: 'Hover(teleport)',
    valueType: 'option',
    width: 160,
    hoverActions: { teleport: true },
    actions: [
      { label: '编辑', type: 'primary', link: true, onClick: ({ row }) => ElMessage.info(`编辑 ${row.name}`) },
      { label: '删除', type: 'danger', link: true, visible: ({ row }) => row.status !== 'pending', onClick: ({ row }) => ElMessage.info(`删除 ${row.name}`) },
    ],
  },
]

// 三层多级表头
export const addressColumns: AdvColumn<AddressRow>[] = [
  { prop: 'date', label: '日期', width: 150 },
  {
    label: '配送信息',
    children: [
      { prop: 'name', label: '姓名', width: 120 },
      {
        label: '地址信息',
        children: [
          { prop: 'state', label: '州', width: 120 },
          { prop: 'city', label: '城市', width: 120 },
          { prop: 'address', label: '地址' },
          { prop: 'zip', label: '邮编', width: 120 },
        ],
      },
    ],
  },
  { label: '操作', valueType: 'option', width: 180, fixed: 'right', hoverActions: { teleport: true }, actions: [{ label: '编辑', type: 'primary', onClick: ({ row }) => ElMessage.info(`编辑 ${row.name}`) }] },
]

// 多级表头 + 高级功能
export const empColumns: AdvColumn<EmpRow>[] = [
  { selection: true },
  { prop: 'name', label: '姓名', width: 100, filter: 'text' },
  {
    label: '个人信息',
    children: [
      { prop: 'age', label: '年龄', width: 80, valueType: 'digit', filter: { type: 'number' }, sortable: true },
      { prop: 'email', label: '邮箱', width: 180, valueType: 'link', copyable: true },
      { prop: 'phone', label: '电话', width: 130, copyable: true },
    ],
  },
  {
    label: '薪资信息',
    children: [
      { prop: 'salary', label: '基本薪资', width: 120, valueType: 'money', filter: { type: 'number' }, sortable: true },
      { prop: 'bonus', label: '奖金', width: 100, valueType: 'money' },
    ],
  },
  {
    label: '组织信息',
    children: [
      { prop: 'department', label: '部门', width: 100, filter: { type: 'enum' } },
      { prop: 'role', label: '角色', width: 100, filter: { type: 'enum' } },
    ],
  },
]

// 综合列
export const compColumns: AdvColumn<CompRow>[] = [
  { selection: true, key: 'selection' },
  { prop: 'progress', label: '进度', width: 120, valueType: 'progress', filter: { type: 'number' } },
  {
    key: 'basic-info',
    label: '基本信息',
    children: [
      { prop: 'name', label: '姓名', width: 100, colSpan: true, filter: 'text' },
      { prop: 'age', label: '年龄', width: 80, valueType: 'digit', sortable: true },
      { prop: 'gender', label: '性别', width: 80, valueType: 'select', valueEnum: { male: { text: '男', status: 'info' }, female: { text: '女', status: 'success' } }, filter: { type: 'enum' } },
      { prop: 'status', label: '状态', width: 90, valueType: 'select', valueEnum: { active: { text: '启用', status: 'success' }, inactive: { text: '禁用', status: 'danger' }, pending: { text: '待审', status: 'warning' } }, filter: { type: 'enum' } },
    ],
  },
  {
    key: 'work-info',
    label: '工作信息',
    children: [
      {
        key: 'salary-composition',
        label: '薪资构成',
        children: [
          { prop: 'salary', label: '基本薪资', width: 120, valueType: 'money', colSpan: (row, leftProp, curProp) => (row as CompRow)[leftProp as keyof CompRow] === (row as CompRow)[curProp as keyof CompRow], sortable: true, filter: { type: 'number' } },
          { prop: 'bonus', label: '奖金', width: 100, valueType: 'money', columnGroupShow: 'open' },
          { prop: 'rate', label: '评分', width: 140, valueType: 'rate', columnGroupShow: 'closed' },
        ],
      },
      { prop: 'department', label: '部门', width: 100, colSpan: true, filter: { type: 'enum' } },
      { prop: 'role', label: '角色', width: 100, filter: { type: 'enum' } },
    ],
  },
  {
    key: 'contact',
    label: '联系方式',
    children: [
      { prop: 'email', label: '邮箱', width: 180, valueType: 'link', copyable: true },
      { prop: 'phone', label: '电话', width: 130, copyable: true },
    ],
  },
  { prop: 'createdAt', label: '创建时间', width: 170, valueType: 'dateTime', sortable: true, filter: { type: 'date' } },
  {
    key: 'action',
    label: '操作',
    valueType: 'option',
    width: 180,
    fixed: 'right',
    hoverActions: { teleport: true },
    actions: [
      { label: '编辑', type: 'primary', onClick: ({ row }) => ElMessage.info(`编辑 ${row.name}`) },
      { label: '详情', type: 'success', visible: ({ row }) => row?.status === 'active', onClick: ({ row }) => ElMessage.info(`详情 ${row.name}`) },
      { label: '删除', type: 'danger', disabled: ({ row }) => row?.status === 'active', onClick: ({ row }) => ElMessage.info(`删除 ${row.name}`) },
    ],
  },
]

//  合并
export const mergeColumns: AdvColumn<MergeRow>[] = [
  { prop: 'id', label: 'ID', width: 70, valueType: 'indexBorder' },
  { prop: 'department', label: '部门(rowspan)', width: 120, spanRows: true },
  { prop: 'team', label: '小组(rowspan)', width: 120, spanRows: true },
  { prop: 'name', label: '姓名', width: 100 },
  { prop: 'role', label: '角色(rowspan)', width: 100, spanRows: true },
  { prop: 'salary', label: '薪资(custom)', width: 120, valueType: 'money', spanRows: (a, b) => (a as MergeRow).salary === (b as MergeRow).salary },
]

export const colMergeColumns: AdvColumn<ColMergeRow>[] = [
  { prop: 'id', label: 'ID', width: 70, valueType: 'indexBorder' },
  { prop: 'project', label: '项目(colspan)', width: 100, colSpan: true },
  { prop: 'phase', label: '阶段(colspan)', width: 100, colSpan: true },
  { prop: 'task', label: '任务(colspan)', width: 100, colSpan: true },
  { prop: 'responsible', label: '负责人', width: 100 },
  { prop: 'status', label: '状态', width: 90 },
]

//  拖拽
export const dragColumns: AdvColumn<RowData>[] = [
  { selection: true },
  {
    label: '排序',
    width: 80,
    cellRenderer: ({ rowIndex }) => h('span', {}, [
      h('span', { class: 'drag-handle', style: 'cursor:grab;margin-right:4px' }, '⠿'),
      String(rowIndex + 1),
    ]),
  },
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'age', label: '年龄', width: 80, valueType: 'digit' },
  { prop: 'salary', label: '薪资', width: 120, valueType: 'money' },
]

export const columnDragColumns: AdvColumn<RowData>[] = [
  { prop: 'id', label: 'ID', width: 70, valueType: 'indexBorder' },
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'age', label: '年龄', width: 80, valueType: 'digit' },
  { prop: 'gender', label: '性别', width: 80, valueType: 'select', valueEnum: { male: { text: '男', status: 'info' }, female: { text: '女', status: 'success' } } },
  { prop: 'status', label: '状态', width: 100, valueType: 'select', valueEnum: { active: { text: '启用', status: 'success' }, inactive: { text: '禁用', status: 'danger' }, pending: { text: '待审', status: 'warning' } } },
  { prop: 'salary', label: '薪资', width: 120, valueType: 'money' },
  { prop: 'progress', label: '进度', width: 120, valueType: 'progress' },
  { prop: 'createdAt', label: '创建时间', width: 170, valueType: 'dateTime' },
  { label: '操作', valueType: 'option', width: 120, fixed: 'right', lockPosition: 'right', actions: [{ label: '编辑', type: 'primary', onClick: () => { } }] },
]

//  编辑
export const editColumns: AdvColumn<RowData>[] = [
  { prop: 'name', label: '姓名(text)', width: 130, editable: true, cellEditor: 'text', cellEditorParams: { placeholder: '请输入姓名' } },
  { prop: 'age', label: '年龄(number)', width: 100, editable: true, valueType: 'digit', cellEditor: 'number', cellEditorParams: { min: 0, max: 150 } },
  { prop: 'gender', label: '性别(select)', width: 100, editable: true, valueType: 'select', valueEnum: { male: { text: '男', status: 'info' }, female: { text: '女', status: 'success' } }, cellEditor: 'select', cellEditorParams: { options: [{ label: '男', value: 'male' }, { label: '女', value: 'female' }] } },
  { prop: 'status', label: '状态(select)', width: 110, editable: true, valueType: 'select', valueEnum: { active: { text: '启用', status: 'success' }, inactive: { text: '禁用', status: 'danger' }, pending: { text: '待审', status: 'warning' } }, cellEditor: 'select', cellEditorParams: { options: [{ label: '启用', value: 'active' }, { label: '禁用', value: 'inactive' }, { label: '待审', value: 'pending' }] } },
  { prop: 'salary', label: '薪资(money)', width: 120, editable: true, valueType: 'money', cellEditor: 'number', cellEditorParams: { min: 0, precision: 2 } },
  { prop: 'email', label: '邮箱(link)', width: 200, editable: true, cellEditor: 'text', cellEditorParams: { placeholder: '请输入邮箱' } },
]

export const tabEnterNavColumns: AdvColumn<RowData>[] = [
  { prop: 'name', label: '姓名(text)', width: 130, editable: true, cellEditor: 'text' },
  { prop: 'age', label: '年龄(number)', width: 110, editable: true, cellEditor: 'number', cellEditorParams: { min: 0, max: 150 } },
  { prop: 'gender', label: '性别(select)', width: 110, editable: true, valueType: 'select', valueEnum: { male: { text: '男' }, female: { text: '女' } }, cellEditor: 'select', cellEditorParams: { options: [{ label: '男', value: 'male' }, { label: '女', value: 'female' }] } },
  { prop: 'salary', label: '薪资(number)', width: 130, editable: true, valueType: 'money', cellEditor: 'number', cellEditorParams: { min: 0, precision: 2 } },
  { prop: 'isActive', label: '启用(switch)', width: 110, editable: true, valueType: 'switch', cellEditor: 'switch' },
  { prop: 'email', label: '邮箱(text)', width: 200, editable: true, cellEditor: 'text' },
]

export const f2BackspaceColumns: AdvColumn<RowData>[] = [
  { prop: 'name', label: '姓名(F2触发)', width: 150, editable: true, cellEditor: 'text' },
  { prop: 'age', label: '年龄(F2触发)', width: 130, editable: true, cellEditor: 'number' },
  { prop: 'email', label: '邮箱(Backspace)', width: 220, editable: true, cellEditor: 'text' },
]

export const clipboardColumns: AdvColumn<RowData>[] = [
  { prop: 'name', label: '姓名', width: 130, editable: true, cellEditor: 'text' },
  { prop: 'age', label: '年龄', width: 100, editable: true, cellEditor: 'number' },
  { prop: 'status', label: '状态', width: 120, editable: true, cellEditor: 'select', cellEditorParams: { options: STATUS_LIST.map(s => ({ label: s, value: s })) } },
  { prop: 'salary', label: '薪资', width: 130, editable: true, cellEditor: 'number' },
]

export const showStatusColumns: AdvColumn<RowData>[] = [
  { prop: 'name', label: '姓名', width: 130, editable: true, cellEditor: 'text' },
  { prop: 'age', label: '年龄', width: 100, editable: true, cellEditor: 'number' },
  { prop: 'email', label: '邮箱', width: 220, editable: true, cellEditor: 'text' },
  { prop: 'salary', label: '薪资', width: 130, editable: true, cellEditor: 'number' },
]

export const lifecycleColumns: AdvColumn<RowData>[] = [
  { prop: 'name', label: '姓名', width: 130, editable: true, cellEditor: 'text' },
  { prop: 'age', label: '年龄', width: 100, editable: true, cellEditor: 'number', editorRules: { min: 0, max: 150 } },
  { prop: 'email', label: '邮箱', width: 220, editable: true, cellEditor: 'text' },
]

export const multiSelectColumns: AdvColumn<RowData>[] = [
  { prop: 'name', label: '姓名', width: 130, editable: true, cellEditor: 'text' },
  {
    prop: 'skills',
    label: '技能(多选)',
    width: 250,
    editable: true,
    cellEditor: 'select',
    cellEditorParams: {
      multiple: true,
      filterable: true,
      options: SKILL_LIST.map(s => ({ label: s, value: s })),
    },
  },
]

export const dynamicParamsColumns: AdvColumn<CityRow>[] = [
  {
    prop: 'country',
    label: '国家(select)',
    width: 140,
    editable: true,
    cellEditor: 'select',
    cellEditorParams: {
      options: [
        { label: '中国', value: 'china' },
        { label: '美国', value: 'usa' },
        { label: '日本', value: 'japan' },
      ],
    },
  },
  {
    prop: 'city',
    label: '城市(联动)',
    width: 140,
    editable: true,
    cellEditor: 'select',
    cellEditorParams: ({ row }: any) => ({
      options: COUNTRY_CITY_MAP[row?.country] || [],
    }),
  },
  { prop: 'note', label: '备注', width: 200, editable: true, cellEditor: 'text' },
]

export const activeMethodColumns: AdvColumn<RowData>[] = [
  { prop: 'name', label: '姓名', width: 130, editable: true, cellEditor: 'text' },
  { prop: 'age', label: '年龄', width: 100, editable: true, cellEditor: 'number' },
  { prop: 'status', label: '状态', width: 100, valueType: 'select', valueEnum: { active: { text: '启用', status: 'success' }, inactive: { text: '禁用', status: 'danger' }, pending: { text: '待审', status: 'warning' } } },
  { prop: 'salary', label: '薪资', width: 130, editable: true, cellEditor: 'number' },
]

export const loseFocusColumns: AdvColumn<RowData>[] = [
  { prop: 'name', label: '姓名', width: 130, editable: true, cellEditor: 'text' },
  { prop: 'age', label: '年龄', width: 100, editable: true, cellEditor: 'number' },
  { prop: 'email', label: '邮箱', width: 200, editable: true, cellEditor: 'text' },
]

export const popupEditColumns: AdvColumn<RowData>[] = [
  { prop: 'name', label: '姓名', width: 130, editable: true, cellEditor: 'text' },
  {
    prop: 'description',
    label: '描述(弹窗编辑)',
    width: 200,
    editable: true,
    cellEditor: 'text',
    cellEditorPopup: true,
    cellEditorParams: { textarea: true, popupWidth: 300 },
  },
]

export const popupPositionColumns: AdvColumn<RowData>[] = [
  { prop: 'name', label: '姓名', width: 130, editable: true, cellEditor: 'text' },
  {
    prop: 'remark',
    label: '备注(over)',
    width: 200,
    editable: true,
    cellEditor: 'text',
    cellEditorPopup: true,
    cellEditorPopupPosition: 'over',
    cellEditorParams: { textarea: true, popupWidth: 300 },
  },
  {
    prop: 'description',
    label: '描述(under)',
    width: 200,
    editable: true,
    cellEditor: 'text',
    cellEditorPopup: true,
    cellEditorPopupPosition: 'under',
    cellEditorParams: { textarea: true, popupWidth: 300 },
  },
]

export const selectorColumns: AdvColumn<RowData>[] = [
  { prop: 'name', label: '姓名', width: 130, editable: true, cellEditor: 'text' },
  {
    prop: 'status',
    label: '状态(动态编辑器)',
    width: 180,
    editable: true,
    cellEditor: 'text',
    cellEditorSelector: ({ row }) => {
      if (row.status === 'active') {
        return {
          component: 'select',
          params: { options: STATUS_LIST.map(s => ({ label: s, value: s })) },
        }
      }
      return 'text'
    },
  },
]

//  校验
export const validateColumns: AdvColumn<RowData>[] = [
  {
    prop: 'name',
    label: '姓名(必填)',
    width: 140,
    editable: true,
    cellEditor: 'text',
    editorRules: { required: '姓名不能为空', minLength: { value: 2, message: '姓名至少2个字符' } },
  },
  {
    prop: 'age',
    label: '年龄(0~150)',
    width: 120,
    editable: true,
    valueType: 'digit',
    cellEditor: 'number',
    editorRules: { required: '年龄不能为空', min: { value: 0, message: '年龄不能为负数' }, max: { value: 150, message: '年龄不能超过150' } },
  },
  {
    prop: 'email',
    label: '邮箱(格式校验)',
    width: 220,
    editable: true,
    cellEditor: 'text',
    editorRules: {
      required: '邮箱不能为空',
      pattern: { regexp: /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/, message: '邮箱格式不正确' },
    },
  },
  {
    prop: 'salary',
    label: '薪资(>=0)',
    width: 130,
    editable: true,
    valueType: 'money',
    cellEditor: 'number',
    editorRules: { min: { value: 0, message: '薪资不能为负数' } },
  },
  {
    prop: 'description',
    label: '描述(最长20)',
    width: 180,
    editable: true,
    cellEditor: 'text',
    editorRules: { maxLength: { value: 20, message: '描述不能超过20个字符' } },
  },
  {
    prop: 'status',
    label: '状态(必填)',
    width: 120,
    editable: true,
    valueType: 'select',
    valueEnum: { active: { text: '启用', status: 'success' }, inactive: { text: '禁用', status: 'danger' }, pending: { text: '待审', status: 'warning' } },
    cellEditor: 'select',
    editorRules: { required: '状态不能为空' },
    cellEditorParams: { options: [{ label: '启用', value: 'active' }, { label: '禁用', value: 'inactive' }, { label: '待审', value: 'pending' }] },
  },
]

export const validateModeColumns: AdvColumn<RowData>[] = [
  { prop: 'name', label: '姓名(必填)', width: 140, editable: true, cellEditor: 'text', editorRules: { required: '姓名不能为空' } },
  { prop: 'age', label: '年龄(0~150)', width: 120, editable: true, valueType: 'digit', cellEditor: 'number', editorRules: { min: { value: 0, message: '年龄不能为负数' }, max: { value: 150, message: '年龄不能超过150' } } },
  { prop: 'salary', label: '薪资(>=0)', width: 130, editable: true, valueType: 'money', cellEditor: 'number', editorRules: { min: { value: 0, message: '薪资不能为负数' } } },
  { prop: 'email', label: '邮箱', width: 200, editable: true, cellEditor: 'text' },
]

export const orderColumns: AdvColumn<OrderRow>[] = [
  { prop: 'productName', label: '商品名称', width: 140, editable: true, cellEditor: 'text', editorRules: { required: '商品名称不能为空' } },
  { prop: 'quantity', label: '数量', width: 100, editable: true, cellEditor: 'number', editorRules: { min: { value: 1, message: '数量至少为1' } } },
  { prop: 'unitPrice', label: '单价', width: 120, editable: true, cellEditor: 'number', valueType: 'money', editorRules: { min: { value: 0, message: '单价不能为负' } } },
  { prop: 'discount', label: '折扣(%)', width: 110, editable: true, cellEditor: 'number' },
  { prop: 'totalAmount', label: '总额', width: 120, editable: true, cellEditor: 'number', valueType: 'money' },
]

//  筛选面板
export const sidePanelColumns: AdvColumn<RowData>[] = [
  { prop: 'name', label: '姓名', width: 130, filter: 'text' },
  { prop: 'age', label: '年龄', width: 100, valueType: 'digit', filter: { type: 'number' }, sortable: true },
  {
    prop: 'gender',
    label: '性别',
    width: 100,
    valueType: 'select',
    valueEnum: { male: { text: '男', status: 'info' }, female: { text: '女', status: 'success' } },
    filter: { type: 'enum' },
  },
  {
    prop: 'status',
    label: '状态',
    width: 100,
    valueType: 'select',
    valueEnum: { active: { text: '启用', status: 'success' }, inactive: { text: '禁用', status: 'danger' }, pending: { text: '待审', status: 'warning' } },
    filter: { type: 'enum' },
  },
  { prop: 'salary', label: '薪资', width: 120, valueType: 'money', filter: { type: 'number' }, sortable: true },
  { prop: 'createdAt', label: '创建时间', width: 170, valueType: 'dateTime', sortable: true, filter: { type: 'date' } },
]

//  列管理
export const presetColumns: AdvColumn<RowData>[] = [
  { prop: 'name', label: '姓名', type: 'textColumn', width: 130 },
  { prop: 'age', label: '年龄', type: 'numericColumn', width: 100 },
  { prop: 'salary', label: '薪资', type: 'numericColumn', width: 130 },
  { prop: 'createdAt', label: '创建时间', type: 'dateColumn', width: 170 },
  { prop: 'description', label: '描述', type: 'nonEditableColumn', width: 200 },
  { label: '操作', type: 'actionColumn', actions: [{ label: '编辑', type: 'primary', link: true, onClick: ({ row }: any) => ElMessage.info(`编辑 ${row.name}`) }] },
]

export const defaultColDefColumns: AdvColumn<RowData>[] = [
  { prop: 'name', label: '姓名(默认宽度120)', type: 'center', cellRender: 'text' },
  { prop: 'age', label: '年龄(默认宽度120)', cellRender: 'text' },
  { prop: 'salary', label: '薪资(100px, 右对齐)', type: 'money', cellRender: 'text' },
  { prop: 'email', label: '邮箱(200px)', width: 200, cellRender: 'text' },
  { prop: 'status', label: '状态(center)', type: 'center', width: 140, cellRender: 'text' },
]

export const resizeCols: AdvColumn<RowData>[] = [
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'name', label: '姓名(拖拽右边框调整宽度)', width: 200 },
  { prop: 'age', label: '年龄', width: 100, valueType: 'digit' },
  { prop: 'salary', label: '薪资', width: 150, valueType: 'money' },
  { prop: 'status', label: '状态', width: 120, valueType: 'select', valueEnum: { active: { text: '启用', status: 'success' }, inactive: { text: '禁用', status: 'danger' }, pending: { text: '待审', status: 'warning' } } },
  { label: '操作', valueType: 'option', width: 140, fixed: 'right', actions: [{ label: '编辑', type: 'primary', onClick: () => { } }] },
]

export const columnStateColumns: AdvColumn<RowData>[] = [
  { prop: 'id', label: 'ID', width: 80, valueType: 'indexBorder' },
  { prop: 'name', label: '姓名', width: 130, filter: 'text' },
  { prop: 'age', label: '年龄', width: 100, valueType: 'digit', filter: { type: 'number' }, sortable: true },
  { prop: 'status', label: '状态', width: 100, valueType: 'select', valueEnum: { active: { text: '启用', status: 'success' }, inactive: { text: '禁用', status: 'danger' }, pending: { text: '待审', status: 'warning' } }, filter: { type: 'enum' } },
  { prop: 'salary', label: '薪资', width: 120, valueType: 'money', filter: { type: 'number' }, sortable: true },
  { prop: 'createdAt', label: '创建时间', width: 170, valueType: 'dateTime', sortable: true },
]

export const cellKeyboardColumns: AdvColumn<RowData>[] = [
  { prop: 'id', label: 'ID', width: 70, valueType: 'indexBorder' },
  { prop: 'name', label: '姓名', width: 130, editable: true, cellEditor: 'text' },
  { prop: 'age', label: '年龄', width: 100, valueType: 'digit', editable: true, cellEditor: 'number' },
  { prop: 'status', label: '状态', width: 100, valueType: 'select', valueEnum: { active: { text: '启用', status: 'success' }, inactive: { text: '禁用', status: 'danger' }, pending: { text: '待审', status: 'warning' } } },
  { prop: 'salary', label: '薪资', width: 120, valueType: 'money' },
]

//  选择
export const highlightColumns: AdvColumn<RowData>[] = [
  { prop: 'id', label: 'ID', width: 70, valueType: 'indexBorder' },
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'age', label: '年龄', width: 80, valueType: 'digit' },
  {
    prop: 'gender',
    label: '性别',
    width: 100,
    valueType: 'select',
    valueEnum: { male: { text: '男', status: 'info' }, female: { text: '女', status: 'success' } },
  },
  {
    prop: 'status',
    label: '状态',
    width: 100,
    valueType: 'select',
    valueEnum: { active: { text: '启用', status: 'success' }, inactive: { text: '禁用', status: 'danger' }, pending: { text: '待审', status: 'warning' } },
  },
  { prop: 'salary', label: '薪资', width: 120, valueType: 'money' },
  { prop: 'createdAt', label: '创建时间', width: 170, valueType: 'dateTime' },
]

export const cellRangeColumns: AdvColumn<RowData>[] = [
  { prop: 'id', label: 'ID', width: 70, valueType: 'indexBorder' },
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'age', label: '年龄', width: 80, valueType: 'digit' },
  { prop: 'status', label: '状态', width: 100, valueType: 'select', valueEnum: { active: { text: '启用', status: 'success' }, inactive: { text: '禁用', status: 'danger' }, pending: { text: '待审', status: 'warning' } } },
  { prop: 'salary', label: '薪资', width: 120, valueType: 'money' },
  { prop: 'createdAt', label: '创建时间', width: 170, valueType: 'dateTime' },
]

//  高级
export const rowClassNameColumns: AdvColumn<RowData>[] = [
  { prop: 'id', label: 'ID', width: 70, valueType: 'indexBorder' },
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'age', label: '年龄', width: 80, valueType: 'digit' },
  { prop: 'status', label: '状态', width: 100, valueType: 'select', valueEnum: { active: { text: '启用', status: 'success' }, inactive: { text: '禁用', status: 'danger' }, pending: { text: '待审', status: 'warning' } } },
  { prop: 'salary', label: '薪资', width: 120, valueType: 'money' },
  { prop: 'description', label: '描述(超长文本测试tooltip)', width: 120, tooltipFormatter: ({ cellValue }) => `📝 ${cellValue}` },
]

export const searchValuesColumns: AdvColumn<RowData>[] = [
  { prop: 'name', label: '姓名', width: 130, search: true },
  {
    prop: 'gender',
    label: '性别',
    width: 100,
    valueType: 'select',
    valueEnum: { male: { text: '男', status: 'info' }, female: { text: '女', status: 'success' } },
    search: { defaultValue: 'male' },
  },
  {
    prop: 'status',
    label: '状态',
    width: 100,
    valueType: 'select',
    valueEnum: { active: { text: '启用', status: 'success' }, inactive: { text: '禁用', status: 'danger' }, pending: { text: '待审', status: 'warning' } },
    search: { defaultValue: 'active' },
  },
  { prop: 'age', label: '年龄', width: 100, valueType: 'digit', search: true },
  { prop: 'salary', label: '薪资', width: 120, valueType: 'money' },
  { prop: 'progress', label: '进度', width: 120, valueType: 'progress' },
]

export const sidePanelComboColumns: AdvColumn<RowData>[] = [
  { prop: 'name', label: '姓名', width: 120, filter: 'text', sortable: true },
  {
    prop: 'gender',
    label: '性别',
    width: 100,
    valueType: 'select',
    valueEnum: { male: { text: '男', status: 'info' }, female: { text: '女', status: 'success' } },
    filter: { type: 'enum' },
  },
  {
    prop: 'status',
    label: '状态',
    width: 100,
    valueType: 'select',
    valueEnum: { active: { text: '启用', status: 'success' }, inactive: { text: '禁用', status: 'danger' }, pending: { text: '待审', status: 'warning' } },
    filter: { type: 'enum' },
  },
  { prop: 'age', label: '年龄', width: 100, valueType: 'digit', filter: { type: 'number' }, sortable: true },
  { prop: 'salary', label: '薪资', width: 120, valueType: 'money', filter: { type: 'number' }, sortable: true },
  { prop: 'createdAt', label: '创建时间', width: 170, valueType: 'dateTime', sortable: true, filter: { type: 'date' } },
]

// Teleport Hover (依赖响应式 zIndex，用工厂函数)
export function createTeleportHoverColumns(zIndex: any): AdvColumn<RowData>[] {
  return [
    { prop: 'id', label: 'ID', width: 70, valueType: 'indexBorder' },
    { prop: 'name', label: '姓名', width: 120 },
    { prop: 'age', label: '年龄', width: 80, valueType: 'digit' },
    { prop: 'status', label: '状态', width: 100, valueType: 'select', valueEnum: { active: { text: '启用', status: 'success' }, inactive: { text: '禁用', status: 'danger' }, pending: { text: '待审', status: 'warning' } } },
    { prop: 'address', label: '地址', minWidth: 200 },
    {
      label: '操作(teleport)',
      valueType: 'option',
      width: 220,
      fixed: 'right',
      hoverActions: { teleport: true, zIndex },
      actions: [
        { label: '编辑', type: 'primary', link: true, onClick: ({ row }) => ElMessage.success(`编辑 ${row.name}`) },
        { label: '详情', type: 'info', link: true, onClick: ({ row }) => ElMessage.info(`详情 ${row.name}`) },
        { label: '删除', type: 'danger', link: true, onClick: ({ row }) => ElMessage.error(`删除 ${row.name}`) },
      ],
    },
  ]
}

export const teleportAutoColsNoFixed: AdvColumn<RowData>[] = [
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'age', label: '年龄', width: 80, valueType: 'digit' },
  {
    label: '操作',
    valueType: 'option',
    width: 160,
    hoverActions: { teleport: 'auto' },
    actions: [
      { label: '编辑', type: 'primary', link: true, onClick: ({ row }) => ElMessage.info(`编辑 ${row.name}`) },
      { label: '删除', type: 'danger', link: true, onClick: ({ row }) => ElMessage.info(`删除 ${row.name}`) },
    ],
  },
]

export const teleportAutoColsWithFixed: AdvColumn<RowData>[] = [
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'age', label: '年龄', width: 80, valueType: 'digit' },
  {
    label: '操作',
    valueType: 'option',
    width: 160,
    fixed: 'right',
    hoverActions: { teleport: 'auto' },
    actions: [
      { label: '编辑', type: 'primary', link: true, onClick: ({ row }) => ElMessage.info(`编辑 ${row.name}`) },
      { label: '删除', type: 'danger', link: true, onClick: ({ row }) => ElMessage.info(`删除 ${row.name}`) },
    ],
  },
]

export const teleportAutoColsAlwaysTeleport: AdvColumn<RowData>[] = [
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'age', label: '年龄', width: 80, valueType: 'digit' },
  {
    label: '操作',
    valueType: 'option',
    width: 160,
    fixed: 'right',
    hoverActions: { teleport: true },
    actions: [
      { label: '编辑', type: 'primary', link: true, onClick: ({ row }) => ElMessage.info(`编辑 ${row.name}`) },
      { label: '删除', type: 'danger', link: true, onClick: ({ row }) => ElMessage.info(`删除 ${row.name}`) },
    ],
  },
]

//  树形与分组
export const treeColumns: AdvColumn<TreeNode>[] = [
  { prop: 'name', label: '名称', minWidth: 200 },
  { prop: 'age', label: '年龄', width: 80, valueType: 'digit' },
  { prop: 'status', label: '状态', width: 100, valueType: 'select', valueEnum: { active: { text: '启用', status: 'success' }, inactive: { text: '禁用', status: 'danger' }, pending: { text: '待审', status: 'warning' } } },
]

export const treeSelectionColumns: AdvColumn<TreeNode>[] = [
  { selection: true },
  { prop: 'name', label: '名称', minWidth: 200 },
  { prop: 'age', label: '年龄', width: 80, valueType: 'digit' },
  { prop: 'status', label: '状态', width: 100, valueType: 'select', valueEnum: { active: { text: '启用', status: 'success' }, inactive: { text: '禁用', status: 'danger' }, pending: { text: '待审', status: 'warning' } } },
]

export const rowGroupColumns: AdvColumn<GroupRow>[] = [
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'department', label: '部门', width: 120 },
  { prop: 'role', label: '角色', width: 120 },
  { prop: 'salary', label: '薪资', width: 120, valueType: 'digit' },
  { prop: 'city', label: '城市', width: 120 },
]

export const rowExpandColumns: AdvColumn<ExpandOrderRow>[] = [
  { prop: 'orderNo', label: '订单号', width: 120 },
  { prop: 'customer', label: '客户', width: 100 },
  { prop: 'amount', label: '金额', width: 100, valueType: 'digit' },
  { prop: 'status', label: '状态', width: 100 },
  { prop: 'createdAt', label: '创建日期', width: 120 },
]

export const rowExpandDetailColumns: AdvColumn<OrderDetailRow>[] = [
  { prop: 'productName', label: '商品名称', width: 150 },
  { prop: 'quantity', label: '数量', width: 80 },
  { prop: 'price', label: '单价', width: 100, valueType: 'digit' },
]

//  导入列
export const importColumns: AdvColumn<RowData>[] = [
  { selection: true },
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'age', label: '年龄', width: 80, valueType: 'digit' },
  { prop: 'status', label: '状态', width: 100, valueType: 'select', valueEnum: { active: { text: '启用', status: 'success' }, inactive: { text: '禁用', status: 'danger' }, pending: { text: '待审', status: 'warning' } } },
  { prop: 'salary', label: '薪资', width: 120, valueType: 'money' },
]
