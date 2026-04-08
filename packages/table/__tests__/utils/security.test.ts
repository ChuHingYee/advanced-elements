import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it, vi } from 'vitest'
import {
  detectPrototypePollution,
  sanitizeDataArray,
  sanitizeRow,
  stripSensitiveColumns,
} from '../../src/utils/security'

/**
 * <zh/> security.ts 单测——覆盖原型污染防御三件套与敏感列剥离咽喉。
 * <en/> security.ts tests — covers the prototype-pollution defense trio and the sensitive-column
 * <en/> stripping chokepoint.
 */
describe('security — prototype pollution defense', () => {
  it('detectPrototypePollution reports dangerous keys and ignores safe rows', () => {
    expect(detectPrototypePollution({ name: 'a', age: 1 })).toEqual([])
    expect(detectPrototypePollution(null)).toEqual([])
    expect(detectPrototypePollution('str')).toEqual([])

    const polluted = JSON.parse('{"__proto__": {"admin": true}, "constructor": 1, "name": "x"}')
    expect(detectPrototypePollution(polluted).sort()).toEqual(['__proto__', 'constructor'])
  })

  it('sanitizeRow strips dangerous keys into a null-prototype copy and fires onDetected', () => {
    const polluted = JSON.parse('{"__proto__": {"admin": true}, "name": "Alice", "token": null}')
    const onDetected = vi.fn()

    const safe = sanitizeRow(polluted, onDetected)

    expect(onDetected).toHaveBeenCalledTimes(1)
    // null 为显式空值予以保留（emptyValue: null 语义），仅 undefined 被跳过
    expect(Object.keys(safe).sort()).toEqual(['name', 'token'])
    expect(safe.token).toBeNull()
    // Object.create(null) 副本：无原型链，constructor 查找不可达 Object.prototype
    expect(Object.getPrototypeOf(safe)).toBeNull()
    expect((safe as any).hasOwnProperty).toBeUndefined()
  })

  it('sanitizeRow returns the same reference for clean rows (zero-change fast path)', () => {
    const row = { name: 'Bob' }
    expect(sanitizeRow(row)).toBe(row)
  })

  it('sanitizeDataArray keeps original array reference when nothing is dirty', () => {
    const data = [{ a: 1 }, { b: 2 }]
    expect(sanitizeDataArray(data)).toBe(data)
  })

  it('sanitizeDataArray replaces only dirty rows and reports their indices', () => {
    const clean = { name: 'ok' }
    const dirty = JSON.parse('{"prototype": 1, "name": "evil"}')
    const onDetected = vi.fn()

    const result = sanitizeDataArray([clean, dirty, clean], onDetected)

    expect(onDetected).toHaveBeenCalledWith(1, ['prototype'])
    // 干净行保持原引用（零变更快路径）
    expect(result[0]).toBe(clean)
    expect(result[2]).toBe(clean)
    // 脏行被替换为无原型安全副本
    expect(Object.getPrototypeOf(result[1])).toBeNull()
    expect(result[1]).toEqual({ name: 'evil' })
  })
})

describe('security — sensitive column stripping', () => {
  const columns = [
    { prop: 'name', label: 'Name' },
    { prop: 'password', label: 'Pwd', sensitive: true },
    { prop: 'age', label: 'Age' },
    { sensitive: true }, // 无 prop 的敏感列不参与剥离（无法按列取值）
  ] as unknown as ProcessedColumn[]

  it('stripSensitiveColumns removes sensitive props and lists them', () => {
    const { safeColumns, strippedProps } = stripSensitiveColumns(columns)

    expect(strippedProps).toEqual(['password'])
    expect(safeColumns.map(c => c.prop)).toEqual(['name', 'age', undefined])
  })

  it('stripSensitiveColumns removes sensitive descendants from grouped columns', () => {
    const password = { prop: 'password', label: 'Password', sensitive: true } as unknown as ProcessedColumn
    const username = { prop: 'username', label: 'Username' } as unknown as ProcessedColumn
    const group = { label: 'Account', children: [password, username] } as unknown as ProcessedColumn
    const { safeColumns, strippedProps } = stripSensitiveColumns([group])

    expect(strippedProps).toEqual(['password'])
    expect(safeColumns).toHaveLength(1)
    expect(safeColumns[0]!.children).toEqual([username])
    expect(safeColumns[0]!.children?.[0]).toBe(username)
  })

  it('stripSensitiveColumns preserves caller column types (no weak-type erasure)', () => {
    // 泛型 C extends object + 内部窄化：调用方拿到的是原始列对象引用
    const { safeColumns } = stripSensitiveColumns(columns)
    expect(safeColumns[0]).toBe(columns[0])
    expect((safeColumns[0] as ProcessedColumn).label).toBe('Name')
  })
})
