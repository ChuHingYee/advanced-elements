/**
 * <zh/> 列拖拽排序 — 通过拖拽列头调整列顺序
 * <en/> Column drag sort — reorder columns by dragging column headers
 *
 * @remarks
 * <zh/> 复用 vue-draggable-plus（SortableJS 封装），在表头行（thead tr / header-row）上初始化拖拽实例，拖拽结束后重排列配置并通知父组件
 * <en/> Uses vue-draggable-plus (SortableJS wrapper), initializes drag instance on header row (thead tr / header-row), reorders column config after drag and notifies parent
 *
 * <zh/>
 * - 仅操作叶子列的顺序，分组列结构不变
 * - 固定列（fixed: left/right）只能在同侧内拖拽
 * - lockPosition 列不参与拖拽
 * - 列级 columnDraggable 优先级高于表格级 columnConfig.columnDraggable
 *
 * <en/>
 * - Only reorders leaf columns, group column structure remains unchanged
 * - Fixed columns (fixed: left/right) can only be dragged within the same side
 * - lockPosition columns do not participate in dragging
 * - Column-level columnDraggable takes priority over table-level columnConfig.columnDraggable
 */
import type { MaybeRefOrGetter, Ref } from 'vue'
import type { IRendererDomAdapter } from '../../components/renderer-core/dom-adapter'
import type { ProcessedColumn } from '../../types'
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, toValue, watch } from 'vue'
import { useDraggable } from 'vue-draggable-plus'
import { resolveDragContainer } from '../../utils/drag-container-resolver'
import { rafSchedule } from '../../utils/raf'
import { getColumnFixedGroup, getColumnKey } from '../../utils/shared'
import { ADV_TABLE_COLUMN_KEY_ATTR } from '../../utils/table-drag'

export interface UseColumnDragOptions {
  /** <zh/> 列拖拽是否启用（表格级开关） | <en/> Whether column dragging is enabled (table-level toggle) */
  columnDraggable: MaybeRefOrGetter<boolean>
  /** <zh/> 当前列配置 | <en/> Current column config */
  columns: Ref<ProcessedColumn[]>
  /** <zh/> 列顺序变更回调 | <en/> Column order change callback */
  onColumnsReordered: (newColumns: ProcessedColumn[]) => void
  /** <zh/> 获取列拖拽容器 DOM | <en/> Get column drag container DOM */
  getColumnDragContainer: () => HTMLElement | null
  /** <zh/> 获取已渲染列 key 列表 | <en/> Get rendered column key list */
  getRenderedColumnKeys: () => string[]
  /** <zh/> 获取列拖拽手柄选择器 | <en/> Get column drag handle selector */
  getDefaultColumnDragHandle: () => string
  /** <zh/> 获取列拖拽 draggable 选择器（匹配列容器的直接子元素） | <en/> Get column drag draggable selector (matches direct children of column container) */
  getColumnDraggableSelector: () => string
  /** <zh/> 表格 ID，用于 MutationObserver 定位 | <en/> Table ID, used for MutationObserver positioning */
  tableId?: string
  /**
   * <zh/> 当前模式 DOM 适配器——列拖拽容器观察目标经其 `getHeaderSelector` 解析（命名空间化）。
   * <zh/> 缺省时观察目标回退到表格根元素（`resolveDragContainer` 内置回退，正确性不变，仅观察范围变宽）。
   * <en/> Current-mode DOM adapter — resolves the column-drag container observe target via
   * <en/> `getHeaderSelector` (namespace-aware). Without it the observe target falls back to
   * <en/> the table root element (built-in fallback in `resolveDragContainer`, same correctness).
   */
  dom?: MaybeRefOrGetter<IRendererDomAdapter | null | undefined>
  /**
   * <zh/> 自动注册生命周期（卸载/失活/激活）——延迟初始化（setup 之后创建）时传 false，由壳在 setup 期转发
   * <en/> Auto-register lifecycle (unmount/deactivate/activate) — pass false for deferred post-setup init; the shell forwards from setup
   * @default true
   */
  autoLifecycle?: boolean
}

/**
 * <zh/> 判断列是否可拖拽
 * <en/> Check if a column is draggable
 *
 * @remarks
 * <zh/> - lockPosition 为 true/'left'/'right' 时不可拖拽
 * <zh/> - selection 列不可拖拽
 * <en/> - Not draggable when lockPosition is true/'left'/'right'
 * <en/> - Selection columns are not draggable
 * @internal
 */
export function isColumnDraggable(col: ProcessedColumn, tableLevelDraggable: boolean): boolean {
  if (col.lockPosition)
    return false
  if (col.selection)
    return false
  if (col.columnDraggable !== undefined)
    return col.columnDraggable
  return tableLevelDraggable
}

/**
 * <zh/> 判断列是否属于固定侧（left/right）——单一真相在 `utils/shared#getColumnFixedGroup`，
 * <zh/> 此处 re-export 保持既有深 imports 兼容。
 * <en/> Check if a column belongs to a fixed side (left/right) — single source in
 * <en/> `utils/shared#getColumnFixedGroup`; re-exported here for existing deep-import compat.
 * @internal
 */
export { getColumnFixedGroup }

/**
 * 根据已渲染的 DOM 列 key 顺序重排列配置
 *
 * @param currentColumns - 当前列配置
 * @param renderedKeys - DOM 中已渲染的列 key 顺序
 * @param tableLevelDraggable - 表格级拖拽开关
 * @returns 重排后的列配置（若无变更返回原引用）
 * @internal
 */
export function reorderColumnsByRenderedKeys(
  currentColumns: ProcessedColumn[],
  renderedKeys: string[],
  tableLevelDraggable: boolean,
): ProcessedColumn[] {
  if (renderedKeys.length === 0)
    return currentColumns

  // <zh/> 守卫：表格级关闭且无任何列声明可拖拽时，不可能发生过真实拖拽，直接放行原配置。
  // <zh/> （SortableJS 只在拖拽启用时创建，正常路径不会进入此处；此为纯函数的防御性闸门。）
  // <en/> Guard: with table-level dragging off AND no column declaring itself draggable, no real
  // <en/> drag could have happened — pass the config through. (SortableJS is only instantiated
  // <en/> when dragging is enabled; this is a defensive gate in the pure function.)
  if (!tableLevelDraggable && !currentColumns.some(col => isColumnDraggable(col, false)))
    return currentColumns

  const keyToCol = new Map<string, ProcessedColumn>()
  for (const col of currentColumns) {
    keyToCol.set(getColumnKey(col), col)
  }

  // 仅保留顶层列 key（防御性过滤：DOM 可能返回分组内子列/分组头的 key，不在顶层 keyToCol 中）
  // Keep top-level keys only (defensive filter: DOM may return child/group keys not in top-level keyToCol)
  const renderedTopLevelKeys = renderedKeys.filter(key => keyToCol.has(key))

  /**
   * 已渲染列 key 集合——折叠/隐藏的列不在 DOM 中，不参与重排、不消费游标。
   * Rendered column key set — collapsed/hidden columns are not in DOM, neither reordered nor cursor-consuming.
   */
  const renderedSet = new Set(renderedKeys)

  let cursor = 0
  let changed = false

  // <zh/> 重排语义："落地序 = 可见序"——把 DOM 序逐位写回这些渲染列在配置数组中的既有槽位
  // <zh/> （渲染列的槽位集合不变，折叠/隐藏列保持原槽位）。
  // <zh/> 游标映射必须覆盖全部渲染列（不限于可拖拽列），且不得假设配置相对序 == DOM 相对序——v2 模式 DOM 序为
  // <zh/> [左固定占位, selection, 非固定, 右固定占位]（固定列真实格在独立表头条带，不在容器内），
  // <zh/> 且 lockPosition 列渲染但不可拖拽：违背此约束会导致固定列被静默迁移到配置末尾、
  // <zh/> 落地序 ≠ 拖拽时可见序（如配置 [A, L(lock), B] 拖 B 至最前，DOM [B, A, L] 而结果 [B, L, A]）。
  // <en/> Reorder semantics: "landed order = visible order" — write the DOM order back into the
  // <en/> config slots the rendered columns already occupy (the rendered slot set is unchanged;
  // <en/> collapsed/hidden columns keep their slots).
  // <en/> Cursor mapping must cover all rendered columns (not only draggable ones) and must not
  // <en/> assume config order == DOM order — in v2 the DOM order is [leftFixed placeholders,
  // <en/> selection, non-fixed, rightFixed placeholders] (real fixed cells live in separate header
  // <en/> strips outside the container) and lockPosition columns render without being draggable:
  // <en/> violating this silently migrates fixed columns to the config tail and diverges the landed
  // <en/> order from the visible order (config [A, L(lock), B], drag B to front → DOM [B, A, L]
  // <en/> but result [B, L, A]).
  const result = currentColumns.map((col) => {
    const colKey = getColumnKey(col)

    // 折叠/隐藏的列不在 DOM 中，保持原槽位且不消费 cursor
    // Collapsed/hidden columns are not in DOM, keep their slot without consuming cursor
    if (!renderedSet.has(colKey))
      return col

    const domKey = renderedTopLevelKeys[cursor++]
    if (!domKey)
      return col

    const domCol = keyToCol.get(domKey)
    if (!domCol || domCol === col)
      return domCol ?? col

    changed = true
    return domCol
  })

  return changed ? result : currentColumns
}

/**
 * <zh/> 列拖拽排序 composable — 基于 sortablejs 实现列顺序拖拽调整。
 *
 * @param options - <zh/> 列拖拽配置 | <en/> column drag config
 *
 * <en/> Column drag sort composable — implements column order drag adjustment based on sortablejs.
 */
export function useColumnDrag(options: UseColumnDragOptions) {
  const {
    columnDraggable,
    columns,
    onColumnsReordered,
    getColumnDragContainer,
    getRenderedColumnKeys,
    getDefaultColumnDragHandle,
    getColumnDraggableSelector,
    tableId,
    dom,
  } = options

  let columnCleanup: (() => void) | null = null
  let observerCleanup: (() => void) | null = null
  /**
   * 组件卸载标志——防止 nextTick 回调在组件卸载后创建 MutationObserver 导致泄漏。
   * Component unmount flag — prevents nextTick callbacks from creating MutationObserver after unmount causing leaks.
   */
  let isUnmounted = false
  /**
   * initColumnDrag 调用版本号——每次调用递增，nextTick 回调执行时校验是否为最新版本。
   * 防止快速连续调用 initColumnDrag 时旧 nextTick 回调创建多余的 MutationObserver。
   * initColumnDrag call version number — incremented on each call, nextTick callback checks if it's the latest version.
   * Prevents old nextTick callbacks from creating redundant MutationObservers during rapid consecutive initColumnDrag calls.
   */
  let initToken = 0

  const resolvedDraggable = computed(() => toValue(columnDraggable))

  function initColumnDrag() {
    if (!resolvedDraggable.value)
      return

    if (columnCleanup) {
      columnCleanup()
      columnCleanup = null
    }
    if (observerCleanup) {
      observerCleanup()
      observerCleanup = null
    }

    // 递增 token，使正在等待的旧 nextTick 回调失效 | Increment token to invalidate pending old nextTick callbacks
    const currentToken = ++initToken

    nextTick(() => {
      if (isUnmounted || currentToken !== initToken)
        return
      observerCleanup = resolveDragContainer({
        getContainer: getColumnDragContainer,
        tableId,
        // <zh/> 观察目标经 DOM 适配器命名空间化解析；缺省回退表格根元素
        // <en/> Observe target resolved namespace-aware via the DOM adapter; falls back to the table root
        observeTargetSelector: toValue(dom)?.getHeaderSelector(),
        onReady: (container) => {
          observerCleanup = null
          setupColumnDraggable(container)
        },
      })
    })
  }

  function setupColumnDraggable(container: HTMLElement) {
    const handle = getDefaultColumnDragHandle()
    const draggableSelector = getColumnDraggableSelector()

    let originalKeys: string[] = []
    let lastDropTarget: HTMLElement | null = null
    /** 拖拽期间的列 key→col 缓存，避免 onMove 高频线性查找 */
    let dragKeyMap: Map<string, ProcessedColumn> | null = null

    /** 回滚 SortableJS 的 DOM 操作，列顺序由数据驱动 */
    function rollbackDom(evt: { from: HTMLElement, item: HTMLElement }, oldIndex?: number) {
      if (evt.from && evt.item && oldIndex !== undefined) {
        const children = evt.from.children
        if (oldIndex < children.length) {
          const currentAtOld = children[oldIndex]
          if (evt.item !== currentAtOld) {
            evt.from.insertBefore(evt.item, currentAtOld)
          }
        }
        else {
          evt.from.appendChild(evt.item)
        }
      }
    }

    function clearDropTarget() {
      if (lastDropTarget) {
        lastDropTarget.classList.remove('adv-table-column-drag__drop-target')
        lastDropTarget = null
      }
    }

    function clearAllDragClasses() {
      container.querySelectorAll(
        '.adv-table-column-drag__no-drop, .adv-table-column-drag__drop-target, .adv-table-column-drag__chosen, .adv-table-column-drag__drag',
      ).forEach((el) => {
        el.classList.remove(
          'adv-table-column-drag__no-drop',
          'adv-table-column-drag__drop-target',
          'adv-table-column-drag__chosen',
          'adv-table-column-drag__drag',
        )
      })
    }

    /**
     * 判断拖拽源列与目标列是否在同一固定侧
     * 固定列只能在同侧内拖拽，不能跨侧
     * Check whether the drag source and target columns are on the same fixed side
     * Fixed columns can only be dragged within the same side, not across sides
     */
    function canDropBetween(sourceKey: string, targetKey: string): boolean {
      const map = dragKeyMap
      if (!map)
        return false
      const sourceCol = map.get(sourceKey)
      const targetCol = map.get(targetKey)
      if (!sourceCol || !targetCol)
        return false

      const sourceGroup = getColumnFixedGroup(sourceCol)
      const targetGroup = getColumnFixedGroup(targetCol)
      return sourceGroup === targetGroup
    }

    const { pause, destroy } = useDraggable(container, {
      handle,
      draggable: draggableSelector,
      animation: 0,
      ghostClass: 'adv-table-column-drag__ghost',
      chosenClass: 'adv-table-column-drag__chosen',
      dragClass: 'adv-table-column-drag__drag',
      fallbackClass: 'adv-table-column-drag__fallback',
      forceFallback: true,
      fallbackOnBody: true,
      direction: 'horizontal',

      onMove(evt) {
        const draggedEl = evt.dragged as HTMLElement
        const relatedEl = evt.related as HTMLElement

        if (!relatedEl) {
          clearDropTarget()
          return true
        }

        if (draggedEl === relatedEl) {
          draggedEl.classList.add('adv-table-column-drag__no-drop')
          clearDropTarget()
          return false
        }

        // 检查源列与目标列是否在同一固定侧 | Check whether source and target columns are on the same fixed side
        const sourceKey = draggedEl.getAttribute(ADV_TABLE_COLUMN_KEY_ATTR)
          ?? draggedEl.querySelector(`[${ADV_TABLE_COLUMN_KEY_ATTR}]`)?.getAttribute(ADV_TABLE_COLUMN_KEY_ATTR)
          ?? ''
        const targetKey = relatedEl.getAttribute(ADV_TABLE_COLUMN_KEY_ATTR)
          ?? relatedEl.querySelector(`[${ADV_TABLE_COLUMN_KEY_ATTR}]`)?.getAttribute(ADV_TABLE_COLUMN_KEY_ATTR)
          ?? ''

        if (sourceKey && targetKey && !canDropBetween(sourceKey, targetKey)) {
          draggedEl.classList.add('adv-table-column-drag__no-drop')
          clearDropTarget()
          return false
        }

        draggedEl.classList.remove('adv-table-column-drag__no-drop')
        clearDropTarget()
        relatedEl.classList.add('adv-table-column-drag__drop-target')
        lastDropTarget = relatedEl

        return true
      },

      onStart() {
        originalKeys = getRenderedColumnKeys()
        // 构建列 key→col 缓存，供 onMove 高频查找使用 | Build column key→col cache for high-frequency lookup in onMove
        dragKeyMap = new Map<string, ProcessedColumn>()
        for (const col of columns.value) {
          dragKeyMap.set(getColumnKey(col), col)
        }
        document.body.classList.add('adv-table-resizing', 'adv-table-resizing--col')
      },

      onEnd(evt) {
        clearDropTarget()
        clearAllDragClasses()
        document.body.classList.remove('adv-table-resizing', 'adv-table-resizing--col')
        dragKeyMap = null

        const { oldIndex, newIndex } = evt

        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) {
          // 仍需回滚 DOM | Still need to rollback DOM
          rollbackDom(evt, oldIndex)
          return
        }

        if (originalKeys.length === 0) {
          rollbackDom(evt, oldIndex)
          return
        }

        // 先读取拖拽后的 DOM 列顺序（此时 SortableJS 已移动 DOM 元素） | Read post-drag DOM column order first (SortableJS has already moved DOM elements)
        const newRenderedKeys = getRenderedColumnKeys()

        // 回滚 DOM 顺序——列顺序由数据驱动，不依赖 SortableJS 的 DOM 操作 | Rollback DOM order — column order is data-driven, does not depend on SortableJS DOM operations
        rollbackDom(evt, oldIndex)

        if (newRenderedKeys.length === 0)
          return

        // 基于新 DOM 顺序重排列配置 | Reorder column config based on new DOM order
        const newColumns = reorderColumnsByRenderedKeys(
          columns.value,
          newRenderedKeys,
          resolvedDraggable.value,
        )

        if (newColumns !== columns.value) {
          onColumnsReordered(newColumns)
        }
      },
    })

    /** 为可拖拽列头添加 cursor: grab 样式类 */
    function applyDraggableCursor() {
      const items = container.querySelectorAll<HTMLElement>(draggableSelector)
      items.forEach((el) => {
        el.classList.add('adv-table-column-drag__draggable')
      })
    }

    /** 移除可拖拽列头的 cursor 样式类 */
    function removeDraggableCursor() {
      container.querySelectorAll('.adv-table-column-drag__draggable').forEach((el) => {
        el.classList.remove('adv-table-column-drag__draggable')
      })
    }

    // <zh/> 监听列头 DOM 变化，自动为新增列头添加 grab 光标（rAF 合并，共享工具）
    // <en/> Watch header DOM mutations, auto-apply grab cursor to new headers (rAF-coalesced via shared util)
    const cursorApplyHandle = rafSchedule(applyDraggableCursor)
    let cursorObserver: MutationObserver | null = new MutationObserver(() => {
      cursorApplyHandle.schedule()
    })
    cursorObserver.observe(container, { childList: true, subtree: true })

    columnCleanup = () => {
      cursorApplyHandle.cancel()
      if (cursorObserver) {
        cursorObserver.disconnect()
        cursorObserver = null
      }
      pause()
      destroy()
      clearAllDragClasses()
      removeDraggableCursor()
      // 拖拽进行中卸载表格时，onEnd 可能不会触发——必须在此移除 body 级类，防止全局样式残留
      // Remove body-level classes here in case the table unmounts mid-drag (onEnd may never fire) — prevents global style leakage
      document.body.classList.remove('adv-table-resizing', 'adv-table-resizing--col')
    }

    applyDraggableCursor()
  }

  watch(resolvedDraggable, (val) => {
    if (val) {
      initColumnDrag()
    }
    else {
      if (columnCleanup) {
        columnCleanup()
        columnCleanup = null
      }
      if (observerCleanup) {
        observerCleanup()
        observerCleanup = null
      }
    }
  }, { immediate: true })

  // <zh/> 列配置变化时重新初始化拖拽实例（列增减后 DOM 结构变化）——rAF 合并（共享工具）
  // <zh/> 分隔符用 '\0'：列 key 可能含逗号，逗号分隔会误触发/漏触发（与 orchestrator 口径一致）。
  // <en/> Re-init drag instance when column config changes (DOM shape changed) — rAF-coalesced via shared util
  // <en/> Separated by '\0': column keys may contain commas (same caliber as the orchestrator).
  const columnChangeHandle = rafSchedule(() => initColumnDrag())
  watch(
    () => columns.value.map(c => getColumnKey(c)).join('\0'),
    () => {
      if (!resolvedDraggable.value)
        return
      columnChangeHandle.schedule()
    },
  )

  /**
   * 销毁列拖拽资源（SortableJS 实例、MutationObserver、rAF）
   *
   * 不设置 isUnmounted 标志，用于 KeepAlive deactivated 场景，
   * 以便 onActivated 重新激活时可通过 initColumnDrag 重建实例。
   */
  function destroyColumnDragResources() {
    if (columnCleanup) {
      columnCleanup()
      columnCleanup = null
    }
    if (observerCleanup) {
      observerCleanup()
      observerCleanup = null
    }
    columnChangeHandle.cancel()
  }

  /**
   * <zh/> 组件真正卸载时的清理：销毁资源 + 设置 isUnmounted 阻止后续 init
   *
   * <zh/> isUnmounted 仅在此处设置，确保 KeepAlive deactivated 不会永久锁死 initColumnDrag。
   * <en/> Cleanup on actual component unmount: destroy resources + set isUnmounted to prevent subsequent init
   * <en/> isUnmounted is only set here, ensuring KeepAlive deactivated doesn't permanently lock initColumnDrag.
   */
  function cleanupColumnDragResources() {
    isUnmounted = true
    destroyColumnDragResources()
  }

  if (options.autoLifecycle ?? true) {
    onBeforeUnmount(cleanupColumnDragResources)

    /** KeepAlive deactivated 时仅销毁资源，不设置 isUnmounted，便于重新激活后重建 */
    onDeactivated(() => {
      destroyColumnDragResources()
    })

    /** KeepAlive 重新激活时重新初始化列拖拽（watch immediate 仅在 setup 时触发一次，重新激活不会重跑） */
    onActivated(() => {
      if (toValue(resolvedDraggable))
        initColumnDrag()
    })
  }

  return {
    /** <zh/> 永久销毁（组件卸载，阻断后续 init） | <en/> Permanent destroy (unmount, blocks later init) */
    destroy: cleanupColumnDragResources,
    /** <zh/> 暂态销毁（失活，仅清资源） | <en/> Transient destroy (deactivate, resources only) */
    suspend: destroyColumnDragResources,
    /** <zh/> 重新激活（可拖拽时重建） | <en/> Resume (rebuild when draggable) */
    resume: () => {
      if (toValue(resolvedDraggable))
        initColumnDrag()
    },
  }
}
