/**
 * <zh/> TableDemo 共享常量与数据生成函数
 * <en/> Shared constants and data generators for TableDemo
 *
 * <zh/> 从 TableDemo.vue 拆出，供主组件及各子 demo 页面复用。
 * <en/> Extracted from TableDemo.vue for the main component and sub-demo pages.
 */
import type { ColMergeRow, CompRow, ExpandOrderRow, GroupRow, MergeRow, OrderDetailRow, OrderRow, RowData, TreeNode } from './types'

// <zh/> 基础常量 <en/> Base constants
export const DEPARTMENTS = ['技术部', '产品部', '市场部']
export const ROLES = ['工程师', '经理', '总监', '专员']
export const STATUS_LIST = ['active', 'inactive', 'pending'] as const
export const GENDER_LIST = ['male', 'female'] as const
export const COLORS = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399']
export const DISABLED_IDS = new Set(['5', '8'])

// <zh/> 编辑/校验相关 <en/> Editing / validation
export const SKILL_LIST = ['Vue', 'React', 'Angular', 'TypeScript', 'Node.js', 'Python']

// <zh/> 行分组相关 <en/> Row-grouping related
export const DEPTS = ['技术部', '产品部', '市场部', '运营部']
export const CITIES = ['北京', '上海', '深圳', '杭州']
export const ROLES_LIST = ['工程师', '经理', '总监', '专员']

// <zh/> 动态编辑器参数 <en/> Dynamic editor params
export const COUNTRY_CITY_MAP: Record<string, { label: string, value: string }[]> = {
  china: [
    { label: '北京', value: 'beijing' },
    { label: '上海', value: 'shanghai' },
    { label: '广州', value: 'guangzhou' },
    { label: '深圳', value: 'shenzhen' },
  ],
  usa: [
    { label: '纽约', value: 'newyork' },
    { label: '洛杉矶', value: 'losangeles' },
    { label: '芝加哥', value: 'chicago' },
  ],
  japan: [
    { label: '东京', value: 'tokyo' },
    { label: '大阪', value: 'osaka' },
    { label: '京都', value: 'kyoto' },
  ],
}

// <zh/> 数据生成函数 <en/> Data generator functions
export function genData(count: number, offset = 0): RowData[] {
  return Array.from({ length: count }, (_, i) => {
    const idx = i + offset
    return {
      id: String(idx + 1),
      name: `用户${idx + 1}`,
      age: 20 + (idx % 30),
      status: STATUS_LIST[idx % 3]!,
      gender: GENDER_LIST[idx % 2]!,
      salary: 10000 + idx * 500,
      balance: 50000 + idx * 2000,
      progress: (idx * 7) % 101,
      rate: 3 + (idx % 3),
      isActive: idx % 3 !== 1,
      createdAt: `2024-${String((idx % 12) + 1).padStart(2, '0')}-${String((idx % 28) + 1).padStart(2, '0')} ${String(8 + (idx % 12)).padStart(2, '0')}:${String(idx % 60).padStart(2, '0')}:00`,
      email: `user${idx + 1}@example.com`,
      avatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png',
      color: COLORS[idx % 5]!,
      description: `这是用户${idx + 1}的详细描述信息`,
      tags: [(['员工', '技术部'] as const)[idx % 2]!, (['主管', '产品部', '运营部'] as const)[idx % 3]!],
    }
  })
}

export function genCompData(count: number): CompRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    name: `用户${i + 1}`,
    age: 20 + (i % 30),
    status: STATUS_LIST[i % 3]!,
    gender: i % 2 === 0 ? 'male' : 'female',
    salary: 10000 + i * 500,
    bonus: 2000 + i * 200,
    rate: 3 + (i % 3),
    department: DEPARTMENTS[i % 3]!,
    role: ROLES[i % 4]!,
    email: `user${i + 1}@example.com`,
    phone: `138${String(10000000 + i).slice(1)}`,
    progress: (i * 7) % 101,
    createdAt: `2024-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
  }))
}

// <zh/> 合并数据 <en/> Merge data
export const mergeData: MergeRow[] = [
  { id: '1', department: '技术部', team: '前端组', name: '张三', role: '工程师', salary: 15000 },
  { id: '2', department: '技术部', team: '前端组', name: '李四', role: '工程师', salary: 16000 },
  { id: '3', department: '技术部', team: '前端组', name: '王五', role: '主管', salary: 20000 },
  { id: '4', department: '技术部', team: '后端组', name: '赵六', role: '工程师', salary: 16000 },
  { id: '5', department: '技术部', team: '后端组', name: '孙七', role: '工程师', salary: 17000 },
  { id: '6', department: '产品部', team: '产品一组', name: '周八', role: '产品经理', salary: 18000 },
  { id: '7', department: '产品部', team: '产品一组', name: '吴九', role: '产品经理', salary: 18000 },
  { id: '8', department: '产品部', team: '产品二组', name: '郑十', role: '产品经理', salary: 19000 },
  { id: '9', department: '市场部', team: '市场组', name: '钱十一', role: '经理', salary: 22000 },
  { id: '10', department: '市场部', team: '市场组', name: '陈十二', role: '专员', salary: 12000 },
]

export const colMergeData: ColMergeRow[] = [
  { id: '1', project: 'Alpha', phase: 'Alpha', task: '需求分析', responsible: '张三', status: '进行中' },
  { id: '2', project: 'Alpha', phase: 'Beta', task: 'UI 设计', responsible: '李四', status: '进行中' },
  { id: '3', project: 'Beta', phase: '开发', task: '开发', responsible: '王五', status: '已完成' },
  { id: '4', project: 'Beta', phase: '测试', task: '赵六', responsible: '赵六', status: '待开始' },
  { id: '5', project: 'Gamma', phase: '需求', task: '评审', responsible: '钱七', status: '进行中' },
  { id: '6', project: 'Delta', phase: 'Delta', task: 'Delta', responsible: '孙八', status: '已完成' },
  { id: '7', project: 'Delta', phase: '发布', task: '验收', responsible: '周九', status: '进行中' },
  { id: '8', project: 'Epsilon', phase: 'Epsilon', task: '上线', responsible: '吴十', status: '待开始' },
  { id: '9', project: 'Epsilon', phase: '维护', task: '维护', responsible: '郑十一', status: '进行中' },
  { id: '10', project: 'Zeta', phase: '设计', task: '设计', responsible: '设计组', status: '已完成' },
]

// <zh/> 校验数据 <en/> Validation data
export const validateData: RowData[] = [
  { id: '1', name: '', age: -1, status: 'active', gender: 'male', salary: -500, balance: 50000, progress: 50, rate: 4, isActive: true, createdAt: '2024-01-15 10:30:00', email: 'invalid-email', avatar: '', color: '#409EFF', description: '这是一个超长的描述信息用来测试maxLength校验规则', tags: ['员工'] },
  { id: '2', name: 'A', age: 200, status: '', gender: 'female', salary: 15000, balance: 60000, progress: 70, rate: 5, isActive: true, createdAt: '2024-02-20 14:00:00', email: 'user2@example.com', avatar: '', color: '#67C23A', description: '短描述', tags: ['主管'] },
  { id: '3', name: '张三', age: 30, status: 'active', gender: 'male', salary: 20000, balance: 70000, progress: 80, rate: 3, isActive: false, createdAt: '2024-03-10 09:15:00', email: 'zhangsan@test.com', avatar: '', color: '#E6A23C', description: '正常数据', tags: ['技术部'] },
  { id: '4', name: '', age: 25, status: 'pending', gender: 'female', salary: 12000, balance: 45000, progress: 60, rate: 4, isActive: true, createdAt: '2024-04-05 16:45:00', email: '', avatar: '', color: '#F56C6C', description: '邮箱为空', tags: ['产品部'] },
  { id: '5', name: '李四', age: 28, status: 'inactive', gender: 'male', salary: 18000, balance: 55000, progress: 90, rate: 5, isActive: true, createdAt: '2024-05-22 11:20:00', email: 'lisi@company.com', avatar: '', color: '#909399', description: '正常', tags: ['运营部'] },
]

export const orderData: OrderRow[] = [
  { id: '1', productName: '商品A', quantity: 10, unitPrice: 100, discount: 5, totalAmount: 950 },
  { id: '2', productName: '商品B', quantity: 5, unitPrice: 200, discount: 10, totalAmount: 900 },
  { id: '3', productName: '商品C', quantity: 20, unitPrice: 50, discount: 0, totalAmount: 1000 },
]

// <zh/> 地址数据 <en/> Address data
export const addressData = Array.from({ length: 100 }, (_, i) => ({
  id: String(i + 1),
  date: `2016-05-${String(i + 1).padStart(2, '0')}`,
  name: `Tom ${i + 1}`,
  state: 'California',
  city: 'Los Angeles',
  address: `No. ${189 + i}, Grove St`,
  zip: 'CA 90036',
}))

// <zh/> 员工数据 <en/> Employee data
export const empData = Array.from({ length: 20 }, (_, i) => ({
  id: String(i + 1),
  name: `员工${i + 1}`,
  age: 22 + (i % 30),
  salary: 10000 + i * 500,
  bonus: 2000 + i * 200,
  email: `emp${i + 1}@company.com`,
  phone: `138${String(10000000 + i).slice(1)}`,
  department: DEPARTMENTS[i % 3]!,
  role: ROLES[i % 3]!,
}))

// <zh/> 树形数据 <en/> Tree data
export function genTreeData(): TreeNode[] {
  return [
    {
      id: '1',
      name: '技术部',
      age: 0,
      status: 'active',
      children: [
        {
          id: '1-1',
          name: '前端组',
          age: 0,
          status: 'active',
          children: [
            { id: '1-1-1', name: '张三', age: 28, status: 'active' },
            { id: '1-1-2', name: '李四', age: 25, status: 'pending' },
            { id: '1-1-3', name: '王五', age: 30, status: 'active' },
          ],
        },
        {
          id: '1-2',
          name: '后端组',
          age: 0,
          status: 'active',
          children: [
            { id: '1-2-1', name: '赵六', age: 32, status: 'active' },
            { id: '1-2-2', name: '孙七', age: 27, status: 'inactive' },
          ],
        },
      ],
    },
    {
      id: '2',
      name: '产品部',
      age: 0,
      status: 'active',
      children: [
        {
          id: '2-1',
          name: '产品一组',
          age: 0,
          status: 'active',
          children: [
            { id: '2-1-1', name: '周八', age: 29, status: 'active' },
            { id: '2-1-2', name: '吴九', age: 24, status: 'pending' },
          ],
        },
        {
          id: '2-2',
          name: '产品二组',
          age: 0,
          status: 'inactive',
          children: [
            { id: '2-2-1', name: '郑十', age: 35, status: 'active' },
          ],
        },
      ],
    },
    {
      id: '3',
      name: '市场部',
      age: 0,
      status: 'active',
      children: [
        { id: '3-1', name: '钱十一', age: 26, status: 'active' },
        { id: '3-2', name: '陈十二', age: 31, status: 'inactive' },
      ],
    },
  ]
}

export const asyncTreeData: TreeNode[] = [
  { id: '1', name: '技术部', age: 0, status: 'active' },
  { id: '2', name: '产品部', age: 0, status: 'active' },
  { id: '3', name: '市场部', age: 0, status: 'active' },
]

export async function loadTreeData(row: TreeNode): Promise<TreeNode[]> {
  await new Promise(r => setTimeout(r, 800))
  const childrenMap: Record<string, TreeNode[]> = {
    '1': [
      { id: '1-1', name: '前端组', age: 0, status: 'active' },
      { id: '1-2', name: '后端组', age: 0, status: 'active' },
    ],
    '2': [
      { id: '2-1', name: '产品一组', age: 0, status: 'active' },
      { id: '2-2', name: '产品二组', age: 0, status: 'active' },
    ],
    '3': [
      { id: '3-1', name: '市场一组', age: 0, status: 'active' },
      { id: '3-2', name: '市场二组', age: 0, status: 'active' },
    ],
    '1-1': [
      { id: '1-1-1', name: '张三', age: 28, status: 'active' },
      { id: '1-1-2', name: '李四', age: 25, status: 'active' },
    ],
    '1-2': [
      { id: '1-2-1', name: '王五', age: 30, status: 'active' },
      { id: '1-2-2', name: '赵六', age: 27, status: 'active' },
    ],
    '2-1': [
      { id: '2-1-1', name: '孙七', age: 29, status: 'active' },
      { id: '2-1-2', name: '周八', age: 26, status: 'active' },
    ],
    '2-2': [
      { id: '2-2-1', name: '吴九', age: 31, status: 'active' },
    ],
    '3-1': [
      { id: '3-1-1', name: '郑十', age: 28, status: 'active' },
    ],
    '3-2': [
      { id: '3-2-1', name: '钱十一', age: 32, status: 'active' },
      { id: '3-2-2', name: '陈十二', age: 29, status: 'active' },
    ],
  }
  return childrenMap[row.id] || []
}

// <zh/> 行分组数据 <en/> Row-group data
export function genGroupData(count: number): GroupRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    name: `员工${i + 1}`,
    department: DEPTS[i % DEPTS.length]!,
    role: ROLES_LIST[i % ROLES_LIST.length]!,
    salary: 8000 + i * 1000,
    city: CITIES[i % CITIES.length]!,
  }))
}

// <zh/> 主/明细视图数据 <en/> Master/detail data
export const rowExpandData: ExpandOrderRow[] = [
  { id: '1', orderNo: 'ORD-001', customer: '张三', amount: 1500, status: 'pending', createdAt: '2024-01-15' },
  { id: '2', orderNo: 'ORD-002', customer: '李四', amount: 2800, status: 'shipped', createdAt: '2024-02-20' },
  { id: '3', orderNo: 'ORD-003', customer: '王五', amount: 960, status: 'delivered', createdAt: '2024-03-10' },
  { id: '4', orderNo: 'ORD-004', customer: '赵六', amount: 3200, status: 'pending', createdAt: '2024-04-05' },
  { id: '5', orderNo: 'ORD-005', customer: '孙七', amount: 1750, status: 'shipped', createdAt: '2024-05-22' },
]

export const orderDetailsMap: Record<string, OrderDetailRow[]> = {
  1: [{ id: '1-1', productName: '商品A', quantity: 2, price: 500 }, { id: '1-2', productName: '商品B', quantity: 1, price: 500 }],
  2: [{ id: '2-1', productName: '商品C', quantity: 4, price: 700 }],
  3: [{ id: '3-1', productName: '商品D', quantity: 3, price: 320 }],
  4: [{ id: '4-1', productName: '商品E', quantity: 2, price: 1600 }],
  5: [{ id: '5-1', productName: '商品F', quantity: 5, price: 350 }],
}

// <zh/> 动态编辑器参数数据 <en/> Dynamic editor params data
export const dynamicParamsData = [
  { id: '1', country: 'china', city: 'beijing', note: '首都' },
  { id: '2', country: 'usa', city: 'newyork', note: '最大城市' },
  { id: '3', country: 'japan', city: 'tokyo', note: '首都' },
  { id: '4', country: 'china', city: 'shanghai', note: '经济中心' },
  { id: '5', country: 'usa', city: '', note: '未选择城市' },
]

// <zh/> 多选编辑器数据 <en/> Multi-select editor data
export function genMultiSelectData(): RowData[] {
  return Array.from({ length: 6 }, (_, i) => ({
    id: `ms-${i + 1}`,
    name: `开发者${i + 1}`,
    skills: [SKILL_LIST[i % SKILL_LIST.length]!, SKILL_LIST[(i + 1) % SKILL_LIST.length]!],
    status: '',
    gender: '',
    salary: 0,
    balance: 0,
    progress: 0,
    rate: 0,
    isActive: true,
    createdAt: '',
    email: '',
    avatar: '',
    color: '',
    description: '',
    tags: [],
    age: 0,
  }))
}

// <zh/> 后端请求模拟 <en/> Backend request mocks
/**
 * <zh/> 树形数据请求源：整棵子树一次返回（配合 `:pagination="{ enabled: false }"` 使用 simple 请求模式）
 * <en/> Tree-data request source: returns the whole tree in one call (used with `:pagination="{ enabled: false }"` in simple request mode)
 */
export async function mockTreeRequest(params: Record<string, unknown>, signal?: AbortSignal): Promise<{ data: TreeNode[], total: number }> {
  await new Promise((r) => {
    const timer = setTimeout(r, 300)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      r(undefined)
    })
  })
  const tree = genTreeData()
  return { data: tree, total: tree.length }
}

export async function mockPaginatedRequest(params: Record<string, unknown>) {
  await new Promise(r => setTimeout(r, 200))
  const page = Number(params.page) || 1
  const size = Number(params.size) || 10
  let filtered = genData(100)
  const name = String(params.name || '').toLowerCase()
  const status = String(params.status || '')
  if (name)
    filtered = filtered.filter(r => r.name.toLowerCase().includes(name))
  if (status)
    filtered = filtered.filter(r => r.status === status)
  return { data: filtered.slice((page - 1) * size, page * size), total: filtered.length }
}

export async function mockCustomFormatRequest(params: Record<string, unknown>) {
  await new Promise(r => setTimeout(r, 400))
  const pageNum = Number(params.pageNum) || 1
  const pageSize = Number(params.pageSize) || 10
  let filtered = genData(200)
  const name = String(params.name || '').toLowerCase()
  if (name)
    filtered = filtered.filter(r => r.name.toLowerCase().includes(name))
  return { items: filtered.slice((pageNum - 1) * pageSize, pageNum * pageSize), totalCount: filtered.length }
}

export async function mockCompRequest(params: Record<string, unknown>) {
  await new Promise(r => setTimeout(r, 300))
  const page = Number(params.page) || 1
  const size = Number(params.size) || 10
  const name = String(params.name || '').toLowerCase()
  const status = String(params.status || '')
  const gender = String(params.gender || '')
  const department = String(params.department || '')
  let filtered = genCompData(100)
  if (name)
    filtered = filtered.filter(r => r.name.toLowerCase().includes(name))
  if (status)
    filtered = filtered.filter(r => r.status === status)
  if (gender)
    filtered = filtered.filter(r => r.gender === gender)
  if (department)
    filtered = filtered.filter(r => r.department === department)
  return { data: filtered.slice((page - 1) * size, page * size), total: filtered.length }
}
