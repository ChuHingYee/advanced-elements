/**
 * <zh/> 共享筛选弹窗 Composable | <en/> Shared filter popover composable
 */
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { ColumnFilterType } from '../../types/column'
import { computed, onBeforeUnmount, onDeactivated, ref, shallowRef, watch } from 'vue'

export interface SharedFilterPopoverApi {
  /** <zh/> 当前激活的列 key（null 表示未打开） | <en/> Active column key (null when not open) */
  readonly activeColumnKey: Readonly<ShallowRef<string | null>>
  /** <zh/> 当前激活列的筛选类型 | <en/> Active column filter type */
  readonly activeFilterType: Readonly<ShallowRef<ColumnFilterType | null>>
  /** <zh/> 弹窗是否可见 | <en/> Whether the popover is visible */
  readonly visible: Readonly<Ref<boolean>>
  /** <zh/> 传给 ElPopover 的响应式 props | <en/> Reactive props for ElPopover */
  readonly popoverProps: ComputedRef<Record<string, unknown>>
  /**
   * <zh/> 打开指定列的筛选面板 | <en/> Open the filter panel for the specified column
   * @param columnKey - <zh/> 列唯一标识 | <en/> column unique key
   * @param el - <zh/> 触发元素（用于 Popper 定位） | <en/> trigger element (for Popper positioning)
   * @param filterType - <zh/> 筛选类型 | <en/> filter type
   */
  open: (columnKey: string, el: HTMLElement, filterType: ColumnFilterType) => void
  /** <zh/> 关闭弹窗 | <en/> Close the popover */
  close: () => void
  /**
   * <zh/> 切换弹窗 | <en/> Toggle the popover
   * @param columnKey - <zh/> 列唯一标识 | <en/> column unique key
   * @param el - <zh/> 触发元素 | <en/> trigger element
   * @param filterType - <zh/> 筛选类型 | <en/> filter type
   */
  toggle: (columnKey: string, el: HTMLElement, filterType: ColumnFilterType) => void
}

export interface UseSharedFilterPopoverOptions {
  /** <zh/> 表格容器是否可见 | <en/> Whether the table container is visible */
  containerVisible: () => boolean
}

/** <zh/> 按筛选类型计算弹窗宽度 | <en/> Calculate popover width by filter type */
function getPopoverWidth(filterType: ColumnFilterType | null): number {
  if (filterType === 'number')
    return 180
  if (filterType === 'date')
    return 260
  return 180
}

/**
 * <zh/> 共享筛选弹窗 composable——整表仅一个弹窗实例，按激活列切换状态（API 各成员说明见 {@linkcode SharedFilterPopoverApi}）。
 * <en/> Shared filter popover composable — a single popover instance per table that switches state by
 * <en/> active column (see {@linkcode SharedFilterPopoverApi} for member-level docs).
 *
 * @param options - <zh/> 弹窗依赖（容器可见性等） | <en/> Popover deps (container visibility, etc.)
 * @returns <zh/> 共享筛选弹窗 API | <en/> The shared filter popover API
 */
export function useSharedFilterPopover(options: UseSharedFilterPopoverOptions): SharedFilterPopoverApi {
  const activeColumnKey = shallowRef<string | null>(null)
  const activeFilterType = shallowRef<ColumnFilterType | null>(null)
  const triggerEl = shallowRef<HTMLElement | null>(null)
  const visible = ref(false)

  function open(columnKey: string, el: HTMLElement, filterType: ColumnFilterType) {
    activeColumnKey.value = columnKey
    activeFilterType.value = filterType
    triggerEl.value = el
    visible.value = true
  }

  function close() {
    visible.value = false
  }

  function toggle(columnKey: string, el: HTMLElement, filterType: ColumnFilterType) {
    if (visible.value && activeColumnKey.value === columnKey) {
      close()
    }
    else {
      open(columnKey, el, filterType)
    }
  }

  function onDocumentClick(e: MouseEvent) {
    if (!visible.value)
      return
    const target = e.target as HTMLElement
    if (!target)
      return
    if (target.closest('.adv-table__filter-popover'))
      return
    if (target.closest('.adv-table__filter-trigger'))
      return
    if (target.closest('.adv-table-floating-filter__input--clickable'))
      return
    close()
  }

  /** <zh/> Escape 键关闭弹窗 | <en/> Close popover on Escape key */
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && visible.value) {
      e.stopPropagation()
      close()
    }
  }

  // ── 锚点存活检测：虚拟滚动回收、列显隐切换等场景下，触发元素可能被 DOM 移除 ──
  // ── Anchor-alive detection: trigger element may be removed by DOM during virtual scroll recycling, column toggle, etc. ──
  //
  // 使用 MutationObserver 监听 DOM 子树变化，替代 setInterval 轮询：
  // - 无空闲 CPU 开销（仅在 DOM 变化时回调）
  // - 即时响应（元素移除后立即触发，无需等待轮询间隔）
  //
  // 观察范围：触发元素最近的表格根容器（自有类名 `.adv-table`），
  // 而非 document.body——避免监听整页 DOM 变化导致的高频回调。
  let anchorObserver: MutationObserver | null = null

  function startAnchorObserver() {
    stopAnchorObserver()
    const el = triggerEl.value
    if (!el || !el.parentNode)
      return

    // <zh/> 观察范围：触发元素最近的表格根容器（自有类名 `.adv-table`，与模式/命名空间无关），
    // <zh/> 而非 document.body——避免监听整页 DOM 变化导致的高频回调。EP 内部类名不在此持有。
    // <en/> Observe the trigger's nearest table root (owned `.adv-table` class, mode/namespace-agnostic),
    // <en/> not document.body — avoids high-frequency callbacks from page-wide DOM churn. No EP-internal class names held here.
    const tableContainer = el.closest('.adv-table')
    const target = tableContainer || el.parentElement || document.body

    anchorObserver = new MutationObserver(() => {
      // <zh/> 每次回调读取最新的 triggerEl，以支持 open 切换列时 trigger 变化
      // <en/> Read the latest triggerEl on each callback to support trigger changes when open switches columns
      const currentEl = triggerEl.value
      if (!currentEl || !currentEl.isConnected) {
        close()
        stopAnchorObserver()
      }
    })

    anchorObserver.observe(target, {
      childList: true,
      subtree: true,
    })
  }

  function stopAnchorObserver() {
    if (anchorObserver) {
      anchorObserver.disconnect()
      anchorObserver = null
    }
  }

  watch(visible, (isVisible, _prev, onCleanup) => {
    if (isVisible) {
      if (typeof document !== 'undefined') {
        document.addEventListener('click', onDocumentClick, true)
        document.addEventListener('keydown', onKeydown, true)
      }
      startAnchorObserver()
      onCleanup(() => {
        if (typeof document !== 'undefined') {
          document.removeEventListener('click', onDocumentClick, true)
          document.removeEventListener('keydown', onKeydown, true)
        }
        stopAnchorObserver()
      })
    }
  })

  watch(() => options.containerVisible(), (isVisible) => {
    if (!isVisible)
      close()
  })

  onBeforeUnmount(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', onDocumentClick, true)
      document.removeEventListener('keydown', onKeydown, true)
    }
    stopAnchorObserver()
  })

  onDeactivated(() => {
    close()
  })

  const popoverProps = computed(() => {
    const containerHidden = options.containerVisible ? !options.containerVisible() : false
    return {
      visible: visible.value && !containerHidden,
      disabled: containerHidden,
      virtualTriggering: true,
      virtualRef: triggerEl.value ?? undefined,
      trigger: 'click' as const,
      placement: 'bottom' as const,
      showArrow: true,
      popperClass: 'adv-table__filter-popover',
      width: getPopoverWidth(activeFilterType.value),
    }
  })

  return {
    activeColumnKey,
    activeFilterType,
    visible,
    popoverProps,
    open,
    close,
    toggle,
  }
}
