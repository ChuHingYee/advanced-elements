/**
 * <zh/> 通用 composable 辅助工具 — 消除各文件间重复的模式
 * <en/> Common composable helpers — eliminates repeated patterns across files
 */
import type { ComputedRef } from 'vue'
import { computed } from 'vue'
import { shallowEqual } from './equality'

/**
 * <zh/> 稳定 computed — 对返回值做浅相等短路，复用上次结果引用
 * <zh/> 替代各处手写的 `if (prev && shallowEqual(prev, result)) return prev` 模式
 * <zh/> T 允许 null——调用方以 null 表示“配置缺席”（如下方行展开/行固定的 trackedConfig），消费者均已判空
 * <en/> Stable computed — shallow-equality short-circuit on return value, reusing previous reference
 * <en/> Replaces hand-written `if (prev && shallowEqual(prev, result)) return prev` patterns everywhere
 * <en/> T allows null — callers use null for "config absent" (e.g. expand/pin trackedConfig below); all consumers null-check
 */
export function useStableComputed<T extends object | null>(
  getter: () => T,
): ComputedRef<T> {
  return computed<T>((prevInner) => {
    const result = getter()
    if (prevInner && shallowEqual(prevInner, result))
      return prevInner
    return result
  })
}
