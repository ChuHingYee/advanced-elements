import type { EnumItem } from '../types'

/**
 * <zh/> 枚举项规范化（单一真源）——字符串补 status:'info'，对象直接透传。
 * <zh/> 渲染（value-enum）与纯文本（resolve-cell-text）共用，避免两处字符级重复分叉。
 * <en/> Single-source enum-item normalizer shared by rendering and plain-text paths.
 */
export function normalizeEnumItem<T extends Pick<EnumItem, 'text'> & Partial<Pick<EnumItem, 'status' | 'color'>>>(item: T | string): T {
  if (typeof item === 'string')
    return { text: item, status: 'info' } as T
  return item
}
