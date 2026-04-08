/**
 * TableDemo 共享类型定义。
 *
 * 从 TableDemo.vue 拆出，供主组件及未来拆分的子 demo 页面复用。
 */

export interface RowData {
  id: string
  name: string
  age: number
  status: string
  gender: string
  salary: number
  balance: number
  progress: number
  rate: number
  isActive: boolean
  createdAt: string
  email: string
  avatar: string
  color: string
  description: string
  tags: string[]
  remark?: string
  skills?: string[]
  address?: string
}

export interface MergeRow { id: string, department: string, team: string, name: string, role: string, salary: number }
export interface ColMergeRow { id: string, project: string, phase: string, task: string, responsible: string, status: string }
export interface AddressRow { id: string, date: string, name: string, state: string, city: string, address: string, zip: string }
export interface EmpRow { id: string, name: string, age: number, salary: number, bonus: number, email: string, phone: string, department: string, role: string }
export interface CompRow { id: string, name: string, age: number, status: string, gender: string, salary: number, bonus: number, rate: number, department: string, role: string, email: string, phone: string, progress: number, createdAt: string }
export interface CityRow { id: string, country: string, city: string, note: string }
export interface OrderRow { id: string, productName: string, quantity: number, unitPrice: number, discount: number, totalAmount: number }
export interface GroupRow { id: string, name: string, department: string, role: string, salary: number, city: string }
export interface TreeNode { id: string, name: string, age: number, status: string, children?: TreeNode[] }
export interface ExpandOrderRow { id: string, orderNo: string, customer: string, amount: number, status: 'pending' | 'shipped' | 'delivered', createdAt: string }
export interface OrderDetailRow { id: string, productName: string, quantity: number, price: number }
