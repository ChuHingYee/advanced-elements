/**
 * <zh/> 渲染器引用子 composable | <en/> Renderer refs sub-composable
 *
 * <zh/> 从 useAdvTableCore 拆分，管理异步渲染器组件加载、ref 绑定与 activeRenderer 派生。
 * <en/> Extracted from useAdvTableCore, manages async renderer component loading, ref binding, and activeRenderer derivation.
 */
import type { ComputedRef, MaybeRefOrGetter, ShallowRef } from 'vue'
import type { RendererModeName } from '../../types/renderer-caps'
import type { TableRendererExpose } from '../../utils/table-drag'
import type { RendererAdapter } from './use-renderer-adapter'
import { defineAsyncComponent, shallowRef } from 'vue'
import { AsyncChunkLoadError, createChunkLoadOnError } from '../../utils/async-chunk'
import { createRendererAdapter } from './use-renderer-adapter'

export interface UseTableRendererRefsReturn {
  TableRenderer: ReturnType<typeof defineAsyncComponent>
  TableVirtualRenderer: ReturnType<typeof defineAsyncComponent>
  tableRendererRef: ShallowRef<TableRendererExpose | null>
  tableVirtualRendererRef: ShallowRef<TableRendererExpose | null>
  activeRenderer: ComputedRef<TableRendererExpose | null>
  /**
   * <zh/> 渲染器适配器——组件选择/双槽绑定/活跃引用的唯一机械分派点；
   * <zh/> 新增第三种渲染模式时在此扩展，消费方面向 adapter 而非模式布尔量。
   * <en/> Renderer adapter — the single mechanical dispatch point for component selection /
   * <en/> dual-slot binding / active ref; extend here for a third renderer instead of branching on mode booleans.
   */
  rendererAdapter: RendererAdapter
  paginationRef: ShallowRef<any>
}

/**
 * @param mode - <zh/> 当前渲染模式名（决定 activeRenderer 取哪个槽位） | <en/> Current renderer mode name (determines which slot activeRenderer reads)
 * @param namespace - <zh/> EP 命名空间 getter（DOM 适配器据此构造类名） | <en/> EP namespace getter (the DOM adapters build class names from it)
 * @param onLoadError - <zh/> 渲染器 chunk 加载最终失败回调（重试预算用尽后） | <en/> Renderer chunk-load final-failure callback (after retry budget is exhausted)
 */
export function useTableRendererRefs(
  mode: ComputedRef<RendererModeName>,
  namespace: MaybeRefOrGetter<string | undefined>,
  onLoadError?: (source: string, error: unknown) => void,
): UseTableRendererRefsReturn {
  const TableRenderer = defineAsyncComponent({
    loader: () => import('../../components/table-renderer/TableRenderer.vue'),
    onError: createChunkLoadOnError('table-renderer', error => onLoadError?.('table-renderer', error)),
    errorComponent: AsyncChunkLoadError,
  })
  const TableVirtualRenderer = defineAsyncComponent({
    loader: () => import('../../components/table-virtual-renderer/TableVirtualRenderer.vue'),
    onError: createChunkLoadOnError('table-virtual-renderer', error => onLoadError?.('table-virtual-renderer', error)),
    errorComponent: AsyncChunkLoadError,
  })

  const tableRendererRef = shallowRef<TableRendererExpose | null>(null)
  const tableVirtualRendererRef = shallowRef<TableRendererExpose | null>(null)

  // <zh/> 机械分派收敛至适配器；activeRenderer 保持原字段名以兼容既有消费方
  // <en/> Mechanical dispatch consolidated into the adapter; field names kept for consumer compatibility
  const rendererAdapter = createRendererAdapter({
    mode,
    namespace,
    defaultComponent: TableRenderer,
    virtualComponent: TableVirtualRenderer,
    defaultRef: tableRendererRef,
    virtualRef: tableVirtualRendererRef,
  })

  return {
    TableRenderer,
    TableVirtualRenderer,
    tableRendererRef,
    tableVirtualRendererRef,
    activeRenderer: rendererAdapter.active,
    rendererAdapter,
    paginationRef: shallowRef(),
  }
}
