import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type { AdvTableEmitFn } from '../../types'
import type { ColumnConfig, RowConfig } from '../../types/config'
import type { ColumnContext, RendererContext, RowContext } from '../../types/orchestrator-context'
import { computed, onActivated, onBeforeUnmount, onDeactivated, shallowRef, toValue, watch } from 'vue'
import { createAsyncLoader } from '../../utils/async-feature'

/** <zh/> 拖拽编排器输入 | <en/> Drag orchestrator input */
export interface UseDragOrchestratorOptions<T>
  extends RowContext<T>, ColumnContext, RendererContext {
  mergedSizeConfig: ComputedRef<{ rowHeight: number }>
  mergedRowConfig: ComputedRef<RowConfig<T>>
  mergedColumnConfig: ComputedRef<ColumnConfig<T>>
  reorderData: (newData: T[]) => void
  emit: AdvTableEmitFn
  /**
   * <zh/> 编辑会话探测——透传至行拖拽，有会话时禁用拖拽 | <en/> Editing-session probe — forwarded to row drag
   */
  isEditing?: MaybeRefOrGetter<boolean>
  /**
   * <zh/> 编辑冲突提示——行拖拽被拒绝时调用 | <en/> Edit-conflict hook
   */
  onEditConflict?: () => void
}

/**
 * <zh/> 拖拽编排——行拖拽排序与列拖拽排序，统一管理 dragLocator 的模式切换。
 * <zh/> 同步壳：定位器计算与拖拽状态同步就绪；行/列拖拽实例按门控动态加载。
 * <en/> Drag orchestration — row drag-sort and column drag-sort, centrally manages dragLocator mode switching.
 * <en/> Sync shell: locator computed and drag status ready synchronously; row/column drag instances
 * <en/> load on gate.
 *
 * @remarks
 * <zh/> 从 useInteractionOrchestrator 拆分，将拖拽相关逻辑收敛为单一职责编排器。
 * <zh/> 门控：行列任一可拖拽即加载实现并常驻（不卸载，避免重建竞态）；从未开启则零字节。
 * <en/> Extracted from useInteractionOrchestrator, consolidating drag-related logic into a single-responsibility orchestrator.
 * <en/> Gate: loads on first row/column draggable and stays resident (no teardown races); zero bytes when never enabled.
 */
export function useDragOrchestrator<T>(options: UseDragOrchestratorOptions<T>) {
  const {
    dom,
    tableId,
    mergedSizeConfig,
    mergedRowConfig,
    mergedColumnConfig,
  } = options

  /**
   * <zh/> 拖拽定位器由 DOM 适配器创建——行容器/行键集合/拖拽行/指示线容器的选择器
   * <zh/> 全部来自适配器，本编排器不再选择具体实现（原 `isVirtual ? v2 : el` 分派已移除）。
   * <en/> The drag locator is created by the DOM adapter — all selectors (row container, row keys,
   * <en/> draggable rows, indicator container) come from the adapter, so this orchestrator no longer
   * <en/> picks an implementation (the former `isVirtual ? v2 : el` dispatch is gone).
   */
  const dragLocator = computed(() =>
    toValue(dom).createDragLocator(tableId.value, mergedSizeConfig.value.rowHeight),
  )

  /** <zh/> 行拖拽进行中（虚拟滚动看门狗据此暂停） | <en/> Row drag in progress (the virtual-scroll watchdog pauses on it) */
  const isRowDragging = shallowRef(false)

  const loader = createAsyncLoader(() => import('./drag-impl').then(m => m.createDragImpl({ ...options, dragLocator })))
  let unmounted = false
  let bound = false

  async function ensureDragLoaded(): Promise<void> {
    let impl: Awaited<ReturnType<typeof loader.load>>
    try {
      impl = await loader.load()
    }
    catch (err) {
      // <zh/> 卸载/环境 teardown 与动态 import 竞态（如 vitest 文件收尾、HMR 热替）：
      // <zh/> 已卸载则加载结果已无处安放，静默丢弃；未卸载则是真实加载失败，原样抛出以便发现。
      // <en/> Unmount/env-teardown racing the dynamic import (vitest file teardown, HMR): drop silently
      // <en/> when already unmounted; otherwise it is a real load failure, rethrown as-is.
      if (!unmounted)
        throw err
      return
    }
    if (unmounted) {
      impl.destroy()
      return
    }
    if (bound)
      return
    bound = true
    // <zh/> 对齐加载窗口内已发生的拖拽状态 | <en/> Adopt drag state changed during the load window
    isRowDragging.value = impl.isRowDragging.value
    watch(impl.isRowDragging, (v) => {
      isRowDragging.value = v
    })
  }

  // <zh/> 门控：行列任一可拖拽即加载（读调用时值，配置变更后生效）
  // <en/> Gate: load when either row or column dragging is enabled (read at call time so later config changes take effect)
  watch(
    () => (mergedRowConfig.value.rowDraggable ?? false) || (mergedColumnConfig.value.columnDraggable ?? false),
    (enabled) => {
      if (enabled)
        void ensureDragLoaded()
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    unmounted = true
    loader.current.value?.destroy()
  })
  onDeactivated(() => loader.current.value?.suspend())
  onActivated(() => loader.current.value?.resume())

  return {
    dragLocator,
    /** <zh/> 行拖拽进行中（虚拟滚动看门狗据此暂停） | <en/> Row drag in progress (the virtual-scroll watchdog pauses on it) */
    isRowDragging,
  }
}
