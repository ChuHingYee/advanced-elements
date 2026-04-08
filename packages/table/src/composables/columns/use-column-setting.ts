import type { Ref } from 'vue'
import type { ProcessedColumn } from '../../types'
import { computed, nextTick, ref, watch } from 'vue'
import { deriveCheckStatus } from '../../utils/checkbox-state'
import {
  applyGroupUpdate,
  collectLeafVisibility,
  extractHiddenSignature,
  handleDragEnd,
  handleDragMove,
  isBuiltInColumn,
  isPinned,
  updateAllColumnHidden,
  updateColumnByKey,
} from '../../utils/column-setting-helpers'
import { getColumnFixedGroup, getColumnKey } from '../../utils/shared'

type PendingUpdate = {
  type: 'group'
  groupKey: 'left' | 'normal' | 'right'
  newCols: ProcessedColumn[]
} | {
  type: 'child'
  parentCol: ProcessedColumn
  newChildren: ProcessedColumn[]
}

/**
 * <zh/> 列设置共享 Composable
 * <en/> Column setting shared composable
 * @remarks
 * <zh/> 提取 column-setting.vue 和 column-setting-side-panel.vue 的公共逻辑。
 * <zh/> 注意：列顺序变化的 columnMoved 事件不再由此处发出——
 * <zh/> 面板拖拽通过 headers → localColumns 变更到达 useColumnsOrchestrator 的统一出口
 * <en/> Extracts shared logic from column-setting.vue and column-setting-side-panel.vue.
 * <en/> Note: columnMoved for order changes is no longer emitted here — panel drags reach the
 * <en/> unified exit in useColumnsOrchestrator via the headers → localColumns change
 *
 * @param params - <zh/> 参数 | <en/> params
 * @param params.headers - <zh/> 列配置双向绑定 Ref（由 defineModel 提供） | <en/> column config two-way binding Ref (provided by defineModel)
 * @param params.resetColumns - <zh/> 重置列配置函数 | <en/> reset column config function
 * @param params.emitColumnVisible - <zh/> 列可见性变更 emit | <en/> column visibility change emit
 * @returns <zh/> 列设置共享状态和方法 | <en/> column setting shared state and methods
 */
export function useColumnSetting(params: {
  headers: Ref<ProcessedColumn[]>
  resetColumns: () => void
  emitColumnVisible: (payload: { columnKey: string, visible: boolean }) => void
}) {
  const { headers, resetColumns, emitColumnVisible } = params

  const isChooseAll = ref(false)
  const isIndeterminate = ref(false)

  const columnGroups = computed(() => {
    const all = headers.value.filter(c => !isBuiltInColumn(c))
    // <zh/> 与拖拽跨侧守卫/filterColumnsByGroup 同口径（getColumnFixedGroup，fixed:true 归左）
    // <en/> Same caliber as the drag cross-side guard/filterColumnsByGroup (fixed:true counts as left)
    return {
      left: all.filter(c => getColumnFixedGroup(c) === 'left'),
      normal: all.filter(c => getColumnFixedGroup(c) === 'normal'),
      right: all.filter(c => getColumnFixedGroup(c) === 'right'),
    }
  })

  // Read-only computed for group columns (no setter — updates go through handleGroupUpdate)
  const leftColumns = computed(() => columnGroups.value.left)
  const normalColumns = computed(() => columnGroups.value.normal)
  const rightColumns = computed(() => columnGroups.value.right)

  const leafVisibilityCache = computed(() => collectLeafVisibility(headers.value))
  const hiddenSignature = computed(() => extractHiddenSignature(headers.value))

  function updateCheckboxState() {
    const visibleStates = leafVisibilityCache.value
    const visibleCount = visibleStates.filter(Boolean).length
    const status = deriveCheckStatus(visibleCount, visibleStates.length)
    isChooseAll.value = status.isAllSelected
    isIndeterminate.value = status.isIndeterminate
  }

  function updateColFixed(col: ProcessedColumn, fixed: 'left' | 'right' | undefined) {
    const key = getColumnKey(col)
    headers.value = updateColumnByKey(headers.value, key, c => ({ ...c, fixed }))
  }

  function handleHiddenChange(col: ProcessedColumn, visible: boolean) {
    const key = getColumnKey(col)
    headers.value = updateColumnByKey(headers.value, key, c => ({ ...c, hidden: !visible }))
    updateCheckboxState()
    emitColumnVisible({ columnKey: key, visible })
  }

  function setFixedTo(col: ProcessedColumn, direction: 'left' | 'right') {
    updateColFixed(col, direction)
  }

  function unfixColumn(col: ProcessedColumn) {
    if (isPinned(col))
      return
    updateColFixed(col, undefined)
  }

  // 原子更新机制：将所有更新入队，在 nextTick 中基于原始快照原子性地应用
  // Atomic update mechanism: queue all updates and apply them atomically in nextTick based on the original snapshot

  let pendingUpdates: PendingUpdate[] = []
  let applyScheduled = false
  let baseSnapshot: ProcessedColumn[] | null = null

  function scheduleApply() {
    if (!applyScheduled) {
      applyScheduled = true
      if (!baseSnapshot) {
        baseSnapshot = [...headers.value]
      }
      nextTick(() => {
        applyPendingUpdates()
        applyScheduled = false
      })
    }
  }

  /**
   * <zh/> 处理分组列拖拽更新（入队，不直接修改 headers）
   * <en/> Handle group column drag update (queued, does not modify headers directly)
   */
  function handleGroupUpdate(groupKey: 'left' | 'normal' | 'right', newCols: ProcessedColumn[]) {
    pendingUpdates.push({ type: 'group', groupKey, newCols })
    scheduleApply()
  }

  /**
   * <zh/> 处理子级列拖拽更新（入队，不直接修改 headers）
   * <en/> Handle child column drag update (queued, does not modify headers directly)
   */
  function handleChildUpdate(parentCol: ProcessedColumn, newChildren: ProcessedColumn[]) {
    pendingUpdates.push({ type: 'child', parentCol, newChildren })
    scheduleApply()
  }

  /**
   * 原子性地应用所有待处理的更新
   * Apply all pending updates atomically against the base snapshot
   */
  function applyPendingUpdates() {
    if (pendingUpdates.length === 0)
      return

    let result = baseSnapshot ? [...baseSnapshot] : [...headers.value]

    for (const update of pendingUpdates) {
      if (update.type === 'child') {
        result = result.map(c =>
          c === update.parentCol ? { ...c, children: update.newChildren } : c,
        )
      }
    }

    // Then apply group updates (they reorder top-level columns)
    for (const update of pendingUpdates) {
      if (update.type === 'group') {
        result = applyGroupUpdate(result, update.groupKey, update.newCols)
      }
    }

    headers.value = result
    pendingUpdates = []
    baseSnapshot = null
  }

  /** 列操作 API —— 由调用方通过 provide 注入子组件 */
  const columnActions = {
    onUpdate: handleHiddenChange,
    onSetFixed: setFixedTo,
    onUnfix: unfixColumn,
    onChildUpdate: handleChildUpdate,
  }

  /** 列设置列表 API —— 由调用方通过 provide 注入子组件 */
  const columnSettingList = {
    leftColumns,
    normalColumns,
    rightColumns,
    isChooseAll,
    isIndeterminate,
    isPinned,
    handleHeaderChange,
    handleColumnMove,
    handleColumnEnd,
    handleGroupUpdate,
  }

  function resetHeaders() {
    resetColumns()
    updateCheckboxState()
  }

  function handleHeaderChange(val: boolean | 'none', col?: ProcessedColumn | 'all') {
    if (val === 'none') {
      resetHeaders()
      return
    }
    if (col === 'all') {
      const prevHidden = new Map(headers.value.map(c => [getColumnKey(c), c.hidden]))
      headers.value = updateAllColumnHidden(headers.value, !val)
      for (const c of headers.value) {
        const key = getColumnKey(c)
        const prev = prevHidden.get(key)
        if (prev !== c.hidden) {
          emitColumnVisible({ columnKey: key, visible: !c.hidden })
        }
      }
    }
    else if (col) {
      const key = getColumnKey(col)
      headers.value = updateColumnByKey(headers.value, key, c => ({ ...c, hidden: !val }))
      emitColumnVisible({ columnKey: key, visible: !!val })
    }
    updateCheckboxState()
  }

  watch(hiddenSignature, () => updateCheckboxState(), { immediate: true })

  const lastColumnDropTarget = ref<HTMLElement | null>(null)

  function clearColumnDropTarget() {
    if (lastColumnDropTarget.value) {
      lastColumnDropTarget.value.classList.remove('adv-table__column-setting-drag-drop-target')
      lastColumnDropTarget.value = null
    }
  }

  function handleColumnMove(evt: any): boolean | void {
    return handleDragMove(
      evt,
      'adv-table__column-setting-drag-no-drop',
      'adv-table__column-setting-drag-drop-target',
      lastColumnDropTarget,
    )
  }

  function handleColumnEnd(evt: any) {
    handleDragEnd(
      evt,
      'adv-table__column-setting-drag-no-drop',
      'adv-table__column-setting-drag-drop-target',
      lastColumnDropTarget,
    )
  }

  return {
    headers,
    isChooseAll,
    isIndeterminate,
    columnGroups,
    leftColumns,
    normalColumns,
    rightColumns,
    isPinned,
    handleHiddenChange,
    setFixedTo,
    unfixColumn,
    handleGroupUpdate,
    handleChildUpdate,
    resetHeaders,
    handleHeaderChange,
    handleColumnMove,
    handleColumnEnd,
    clearColumnDropTarget,
    columnActions,
    columnSettingList,
  }
}
