import type { AdvConfig } from './types'

/**
 * <zh/> 判断值是否为可深合并的普通对象（非数组、非 null）
 * <en/> Check if a value is a plain object eligible for deep merging (not an array, not null)
 *
 * @param value - <zh/> 待判断的值 | <en/> value to check
 * @returns <zh/> 是否为普通对象 | <en/> whether it is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * <zh/> 递归深合并父子配置（结构共享：未覆盖的子树复用父级引用）
 * <en/> Recursively deep-merge parent/child configs (structural sharing: untouched subtrees reuse parent refs)
 *
 * @param parent - <zh/> 父级配置 | <en/> parent config
 * @param current - <zh/> 子级配置，优先级更高 | <en/> child config, takes precedence
 * @returns <zh/> 合并结果；无实际变化时返回父级引用 | <en/> merged result; parent reference when nothing changed
 */
export function deepMergeConfig<T extends object>(parent: T, current: T): T {
  const parentRecord = parent as Record<string, unknown>
  const currentRecord = current as Record<string, unknown>
  const currentKeys = Object.keys(currentRecord)
  if (currentKeys.length === 0)
    return parent
  let changed = false
  const result: Record<string, unknown> = { ...parentRecord }
  for (const key of currentKeys) {
    // <zh/> 原型污染防护：与 table 侧 mergeConfig 同一姿态，跳过危险键
    // <en/> Prototype-pollution guard: same posture as table-side mergeConfig, skip dangerous keys
    if (key === '__proto__' || key === 'constructor' || key === 'prototype')
      continue
    const pv = parentRecord[key]
    const cv = currentRecord[key]
    if (isPlainObject(cv) && isPlainObject(pv)) {
      const merged = deepMergeConfig(pv, cv)
      result[key] = merged
      if (merged !== pv)
        changed = true
    }
    else if (!Object.is(cv, pv)) {
      result[key] = cv
      changed = true
    }
  }
  // <zh/> 无实际变化时复用父级引用，保持整树引用稳定
  // <en/> Reuse the parent reference when nothing changed, keeping whole-tree stability
  return (changed ? result : parent) as T
}

/**
 * <zh/> 配置深比较（函数按引用，其余按值）
 * <en/> Deep config comparison (functions by reference, everything else by value)
 *
 * @param a - <zh/> 待比较值 | <en/> value to compare
 * @param b - <zh/> 待比较值 | <en/> value to compare
 * @returns <zh/> 内容是否一致 | <en/> whether contents are equal
 */
export function isEqualConfigValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b))
    return true
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
      return false
    return a.every((item, i) => isEqualConfigValue(item, b[i]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length)
      return false
    return aKeys.every(k => isEqualConfigValue(a[k], b[k]))
  }
  return false
}

/**
 * <zh/> 顶层配置比较，内容一致即视为相等
 * <en/> Top-level config comparison, equal when contents match
 *
 * @param a - <zh/> 待比较配置 | <en/> config to compare
 * @param b - <zh/> 待比较配置 | <en/> config to compare
 * @returns <zh/> 内容是否一致 | <en/> whether contents are equal
 */
export function isEqualConfig(a: AdvConfig, b: AdvConfig): boolean {
  return isEqualConfigValue(a, b)
}
