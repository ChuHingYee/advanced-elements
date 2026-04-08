/**
 * <zh/> 搜索表单异步 disabled 解析 composable
 * <en/> Search form async disabled resolver composable
 *
 * @remarks
 * <zh/> 职责单一：管理字段的异步 disabledFunc 解析，包含版本追踪防止过期回调写入。
 * <zh/> 自管理生命周期钩子（onBeforeUnmount / onActivated），组件只需调用 syncDisabledStates 并读取 resolvedDisabledMap。
 * <en/> Single responsibility: manages async disabledFunc resolution for fields, with version tracking to prevent stale callback writes.
 * <en/> Self-manages lifecycle hooks (onBeforeUnmount / onActivated); the component only needs to call syncDisabledStates and read resolvedDisabledMap.
 */
import type { Ref } from 'vue'
import type { FormField, QueryFormModel } from './types'
import { onActivated, onBeforeUnmount, ref } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'

export interface UseSearchDisabledResolverDeps {
  /** <zh/> 字段配置（响应式 getter） | <en/> Field config (reactive getter) */
  fields: () => FormField[]
}

export interface UseSearchDisabledResolverReturn {
  /** <zh/> 已解析的 disabled 映射 | <en/> Resolved disabled map */
  resolvedDisabledMap: Ref<Record<string, boolean>>
  /** <zh/> 同步 disabled 状态（遍历所有字段，异步解析 disabledFunc） | <en/> Sync disabled states (iterates all fields, async resolves disabledFunc) */
  syncDisabledStates: (formModel: QueryFormModel) => void
  /** <zh/> 移除已删除字段的 disabled 状态 | <en/> Remove disabled state for a deleted field */
  removeField: (prop: string) => void
}

/**
 * <zh/> 创建搜索表单异步 disabled 解析器
 * <en/> Create search form async disabled resolver
 *
 * @param deps - <zh/> 依赖项 | <en/> Dependencies
 * @returns <zh/> resolvedDisabledMap、syncDisabledStates、removeField | <en/> resolvedDisabledMap, syncDisabledStates, removeField
 */
export function useSearchDisabledResolver(deps: UseSearchDisabledResolverDeps): UseSearchDisabledResolverReturn {
  const resolvedDisabledMap = ref<Record<string, boolean>>({})
  const disabledRequestVersion: Record<string, number> = {}
  /** <zh/> 组件卸载标志：防止卸载后 disabledFunc 异步回调写入已失效的响应式状态 | <en/> unmount flag: prevents disabledFunc async callback from writing to stale reactive state after unmount */
  let isUnmounted = false

  function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
    return typeof (value as Promise<T> | undefined)?.then === 'function'
  }

  function syncDisabledStates(formModel: QueryFormModel) {
    deps.fields().forEach((item) => {
      const requestId = (disabledRequestVersion[item.prop] ?? 0) + 1
      disabledRequestVersion[item.prop] = requestId
      if (!item.disabledFunc) {
        resolvedDisabledMap.value[item.prop] = false
        return
      }
      void resolveDisabledField(item, formModel, requestId)
    })
  }

  async function resolveDisabledField(
    item: FormField,
    formModel: QueryFormModel,
    requestId: number,
  ) {
    try {
      const result = item.disabledFunc!(formModel)
      const disabled = isPromiseLike(result) ? await result : result
      if (isUnmounted || disabledRequestVersion[item.prop] !== requestId)
        return
      resolvedDisabledMap.value[item.prop] = disabled
    }
    catch (error) {
      if (!isUnmounted && disabledRequestVersion[item.prop] === requestId) {
        resolvedDisabledMap.value[item.prop] = false
      }
      if (isDev)
        devWarn(`[QueryForm] disabledFunc 执行失败: ${item.prop}`, error)
    }
  }

  function removeField(prop: string) {
    delete resolvedDisabledMap.value[prop]
    delete disabledRequestVersion[prop]
  }

  onBeforeUnmount(() => {
    isUnmounted = true
  })

  /** <zh/> KeepAlive 重新激活时重置卸载标志，恢复 disabled 解析 | <en/> Reset unmount flag on KeepAlive reactivation, restoring disabled resolution */
  onActivated(() => {
    isUnmounted = false
  })

  return {
    resolvedDisabledMap,
    syncDisabledStates,
    removeField,
  }
}
