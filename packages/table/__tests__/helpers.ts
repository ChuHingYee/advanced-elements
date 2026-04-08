/**
 * Helpers shared across composable tests / composable 测试共享辅助函数
 */
import type { ProcessedColumn } from '../src/types/column'
import { ref } from 'vue'

/** Helper: Wrap a value as MaybeRefOrGetter for composable options */
export function toMaybeRef<T>(val: T) {
  return ref(val)
}

/** Helper: Create a mock ProcessedColumn */
export function mockColumn(overrides: Partial<ProcessedColumn> = {}): ProcessedColumn {
  return {
    prop: 'test',
    label: 'Test Column',
    width: 150,
    selection: false,
    valueType: 'text',
    hidden: false,
    ...overrides,
  } as unknown as ProcessedColumn
}

/** Helper: Create mock data rows */
export function mockData(count: number, prefix = 'row'): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    name: `Name ${i}`,
    age: 20 + i,
    email: `user${i}@test.com`,
  }))
}

/** Helper: Wait for Vue reactivity to settle */
export async function flush() {
  await nextTick()
}
