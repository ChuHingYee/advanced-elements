/**
 * <zh/> 列设置纯逻辑工具集。
 * <en/> Pure-logic helpers for column settings.
 *
 * <zh/> 从 composables/use-column-setting.ts 提取的模块级纯函数：列分类谓词（isBuiltInColumn/isPinned 等）、
 * <zh/> 不可变列树更新（updateColumnByKey/updateAllColumnHidden/applyGroupUpdate 等）、可见性签名与叶子状态收集、拖拽 DOM 状态清理（handleDragMove/handleDragEnd）。
 * <zh/> 所有函数均为纯函数，无 Vue 响应式依赖，可独立单元测试。
 * <en/> Module-level pure functions extracted from composables/use-column-setting.ts: column classification predicates (isBuiltInColumn/isPinned etc.),
 * <en/> immutable column-tree updates (updateColumnByKey/updateAllColumnHidden/applyGroupUpdate etc.), visibility-signature and leaf-state collection, and drag DOM-state cleanup (handleDragMove/handleDragEnd).
 * <en/> All functions are pure with no Vue reactive dependencies, so they can be unit-tested independently.
 */
import type { ProcessedColumn } from '../types'
import { getColumnFixedGroup, getColumnKey, isGroupColumn } from './shared'

/** <zh/> Hover 操作列判定——option 类型且配置了 hoverActions | <en/> Hover action column predicate — option type with hoverActions configured */
function isHoverOptionColumn(col: ProcessedColumn): boolean {
  return col.valueType === 'option' && !!col.hoverActions
}

/** <zh/> 内置列判定——选择列或 hover 操作列不可被用户设置显隐/固定 | <en/> Built-in column predicate — selection or hover-action columns cannot be toggled/fixed by users */
export function isBuiltInColumn(col: ProcessedColumn): boolean {
  return !!col.selection || isHoverOptionColumn(col)
}

/** <zh/> 列已固定（左/右）判定 | <en/> Whether the column is pinned (left/right) */
export function isPinned(col: ProcessedColumn): boolean {
  return col.pinFixed === 'left' || col.pinFixed === 'right'
}

/**
 * <zh/> 递归更新指定 key 的列配置。
 * <en/> Recursively update the column config for a given key.
 * @param cols - <zh/> 列配置数组 | <en/> column config array
 * @param key - <zh/> 目标列 key | <en/> target column key
 * @param updater - <zh/> 更新函数 | <en/> updater function
 * @returns <zh/> 更新后的列配置数组（若无变更则返回原引用） | <en/> updated column config array (original reference returned when nothing changed)
 *
 * @remarks
 * <zh/> 与 `use-column-group.ts` 的 `replaceColumnByKey` **语义不同、不可互换**：
 * <zh/> 本函数在 `updater` 返回同一引用时返回**入参数组本身**（命中 column-tree 文档化的"同引用快路径"），
 * <zh/> 而 `replaceColumnByKey` 只要 key 命中就返回新数组。合并两者会改变其中一方的重渲染行为。
 * <en/> Semantically **different from and not interchangeable with** `replaceColumnByKey` in
 * <en/> `use-column-group.ts`: this one returns the **input array itself** when `updater` returns the same
 * <en/> reference (hitting column-tree's documented same-reference fast path), whereas
 * <en/> `replaceColumnByKey` returns a new array as soon as the key matches. Merging them would change
 * <en/> one side's re-render behaviour.
 */
export function updateColumnByKey(
  cols: ProcessedColumn[],
  key: string,
  updater: (col: ProcessedColumn) => ProcessedColumn,
): ProcessedColumn[] {
  let changed = false
  const result = cols.map((c) => {
    if (getColumnKey(c) === key) {
      const updated = updater(c)
      if (updated !== c)
        changed = true
      return updated
    }
    if (c.children?.length) {
      const newChildren = updateColumnByKey(c.children, key, updater)
      if (newChildren !== c.children) {
        changed = true
        return { ...c, children: newChildren }
      }
    }
    return c
  })
  return changed ? result : cols
}

/**
 * <zh/> 递归收集叶子列的可见性状态。
 * <en/> Recursively collect the visibility state of leaf columns.
 * @param cols - <zh/> 列配置数组 | <en/> column config array
 * @param parentHidden - <zh/> 父级是否隐藏 | <en/> whether the parent is hidden
 * @returns <zh/> 叶子列可见性数组 | <en/> leaf-column visibility array
 */
export function collectLeafVisibility(
  cols: ProcessedColumn[],
  parentHidden = false,
): boolean[] {
  const result: boolean[] = []
  for (const col of cols) {
    if (isBuiltInColumn(col))
      continue

    const currentHidden = parentHidden || !!col.hidden
    if (isGroupColumn(col)) {
      result.push(...collectLeafVisibility(col.children, currentHidden))
    }
    else {
      result.push(!currentHidden)
    }
  }
  return result
}

/**
 * <zh/> 提取列隐藏状态的签名字符串，用于 computed 缓存。
 * <en/> Extract a signature string of column hidden states, used for computed caching.
 * @param cols - <zh/> 列配置数组 | <en/> column config array
 * @returns <zh/> 签名字符串 | <en/> signature string
 */
export function extractHiddenSignature(cols: ProcessedColumn[]): string {
  return cols.map((col) => {
    if (isBuiltInColumn(col))
      return ''
    const hidden = col.hidden ? '1' : '0'
    if (isGroupColumn(col)) {
      return `${hidden}(${extractHiddenSignature(col.children)})`
    }
    return hidden
  }).join(',')
}

/**
 * <zh/> 递归设置所有列的隐藏状态。
 * <zh/> lockVisible 锁定的列与内置列一样跳过——单列复选框已尊重 lockVisible，
 * <zh/> 约束：全选/全不选的批量路径必须守卫 lockVisible，禁用状态的锁定列不得改写。
 * <en/> Recursively set the hidden state of all columns.
 * <en/> lockVisible-locked columns are skipped like built-in ones — the single-column checkbox
 * <en/> already honors lockVisible; constraint: this select-all/batch path must guard lockVisible
 * <en/> and must not overwrite disabled locked columns.
 * @param cols - <zh/> 列配置数组 | <en/> column config array
 * @param hidden - <zh/> 是否隐藏 | <en/> whether to hide
 * @returns <zh/> 更新后的列配置数组 | <en/> updated column config array
 */
export function updateAllColumnHidden(
  cols: ProcessedColumn[],
  hidden: boolean,
): ProcessedColumn[] {
  return cols.map((col) => {
    if (isBuiltInColumn(col) || col.lockVisible)
      return col

    if (isGroupColumn(col)) {
      return {
        ...col,
        hidden,
        children: updateAllColumnHidden(col.children, hidden),
      }
    }

    return {
      ...col,
      hidden,
    }
  })
}

/**
 * <zh/> 构建 key → column 索引 Map（规范键，首见优先，与共享版同语义）
 * <en/> Build a key → column map (canonical keys, first-match-wins, same semantics as the shared version)
 *
 * @param headers - <zh/> 当前 headers 快照 | <en/> current headers snapshot
 * @returns <zh/> 规范键索引 | <en/> canonical-key map
 *
 * @remarks
 * <zh/> 本函数为共享 `buildColumnKeyMap` 的规范键子集（列设置域专用形态），
 * <zh/> 列设置域仅需规范键（prop 别名会误命中分组列），故不含别名分支。
 * <en/> Canonical-key subset of the shared `buildColumnKeyMap` (setting-domain variant) — the setting domain needs canonical keys only (prop aliases
 * <en/> would mis-hit group columns), so no alias branch.
 */
export function buildKeyMap(headers: ProcessedColumn[]): Map<string, ProcessedColumn> {
  const map = new Map<string, ProcessedColumn>()
  for (const col of headers) {
    const key = getColumnKey(col)
    if (!map.has(key))
      map.set(key, col)
  }
  return map
}

/**
 * <zh/> 同步列引用至最新 headers 引用，并应用 fixed 变更。
 * <en/> Sync a column reference to the latest headers reference and apply the fixed change.
 * @param col - <zh/> 待同步的列 | <en/> column to sync
 * @param headersKeyMap - <zh/> 当前 headers 的 key 索引 | <en/> current headers' key map
 * @param fixedValue - <zh/> 目标 fixed 值（undefined 表示取消固定） | <en/> target fixed value (undefined means unpin)
 */
export function syncColumnReference(
  col: ProcessedColumn,
  headersKeyMap: Map<string, ProcessedColumn>,
  fixedValue: string | undefined,
): ProcessedColumn {
  const key = getColumnKey(col)
  const latestRef = headersKeyMap.get(key)
  if (!latestRef) {
    return fixedValue !== undefined
      ? { ...col, fixed: fixedValue }
      : col.fixed !== undefined
        ? { ...col, fixed: undefined }
        : col
  }
  return fixedValue !== undefined
    ? { ...latestRef, fixed: fixedValue }
    : latestRef.fixed !== undefined
      ? { ...latestRef, fixed: undefined }
      : latestRef
}

/** <zh/> 按分组过滤列（left/right/normal，与拖拽跨侧守卫同口径） | <en/> Filter columns by group (left/right/normal, same caliber as the drag cross-side guard) */
export function filterColumnsByGroup(cols: ProcessedColumn[], groupKey: 'left' | 'normal' | 'right'): ProcessedColumn[] {
  return cols.filter(c => getColumnFixedGroup(c) === groupKey)
}

/** <zh/> 从当前 headers 中移除旧分组中已不存在于 newCols 的列 | <en/> Remove from current headers the columns of the old group that no longer exist in newCols */
export function removeOldGroupColumns(
  currentHeaders: ProcessedColumn[],
  oldKeySet: Set<string>,
  removedKeys: string[] | Set<string>,
): ProcessedColumn[] {
  // <zh/> Set 化 dumb 查找，避免循环内 includes 形成 O(n²)
  // <en/> Normalize to a Set to avoid in-loop includes forming O(n²)
  const removedSet = Array.isArray(removedKeys) ? new Set(removedKeys) : removedKeys
  const result: ProcessedColumn[] = []
  for (const c of currentHeaders) {
    const key = getColumnKey(c)
    if (removedSet.has(key))
      continue
    if (oldKeySet.has(key))
      continue
    result.push(c)
  }
  return result
}

/**
 * <zh/> 应用分组拖拽更新——原子性地替换指定分组的列，保持其他分组列不变。
 * <en/> Apply a grouped drag update — atomically replace the columns of a given group while keeping other groups unchanged.
 * @param currentHeaders - <zh/> 当前 headers 快照 | <en/> current headers snapshot
 * @param groupKey - <zh/> 目标分组 | <en/> target group
 * @param newCols - <zh/> 拖拽后的新列顺序 | <en/> new column order after dragging
 * @returns <zh/> 更新后的 headers | <en/> updated headers
 */
export function applyGroupUpdate(
  currentHeaders: ProcessedColumn[],
  groupKey: 'left' | 'normal' | 'right',
  newCols: ProcessedColumn[],
): ProcessedColumn[] {
  const fixedValue = groupKey === 'normal' ? undefined : groupKey

  const allCols = currentHeaders.filter(c => !isBuiltInColumn(c))
  const oldCols = filterColumnsByGroup(allCols, groupKey)
  const oldKeySet = new Set(oldCols.map(c => getColumnKey(c)))
  const headersKeyMap = buildKeyMap(currentHeaders)

  const synced = newCols.map(c => syncColumnReference(c, headersKeyMap, fixedValue))

  const newKeySet = new Set(newCols.map(c => getColumnKey(c)))
  const removedKeys = oldCols
    .filter(c => !newKeySet.has(getColumnKey(c)))
    .map(c => getColumnKey(c))

  const result = removeOldGroupColumns(currentHeaders, oldKeySet, removedKeys)

  const firstOldIdx = currentHeaders.findIndex(c => oldKeySet.has(getColumnKey(c)))
  const insertIdx = firstOldIdx >= 0 ? firstOldIdx : result.length
  result.splice(insertIdx, 0, ...synced)

  return result
}

/**
 * <zh/> 拖拽 onMove 回调——自身位置 no-drop + 目标元素底色指示。
 * <en/> Drag onMove callback — no-drop on self plus drop-target highlighting.
 * @param evt - <zh/> SortableJS move 事件 | <en/> SortableJS move event
 * @param noDropClass - <zh/> no-drop 样式类名 | <en/> no-drop style class name
 * @param dropTargetClass - <zh/> drop-target 样式类名 | <en/> drop-target style class name
 * @param lastDropTargetRef - <zh/> 上一个 drop 目标引用 | <en/> last drop-target reference
 * @param lastDropTargetRef.value - <zh/> 上一个 drop 目标元素 | <en/> last drop-target element
 * @returns <zh/> 是否允许移动 | <en/> whether the move is allowed
 */
export function handleDragMove(
  evt: any,
  noDropClass: string,
  dropTargetClass: string,
  lastDropTargetRef: { value: HTMLElement | null },
): boolean | void {
  const draggedEl = evt.dragged as HTMLElement
  const relatedEl = evt.related as HTMLElement

  if (!relatedEl) {
    if (lastDropTargetRef.value) {
      lastDropTargetRef.value.classList.remove(dropTargetClass)
      lastDropTargetRef.value = null
    }
    return true
  }

  if (draggedEl === relatedEl) {
    draggedEl.classList.add(noDropClass)
    if (lastDropTargetRef.value) {
      lastDropTargetRef.value.classList.remove(dropTargetClass)
      lastDropTargetRef.value = null
    }
    return false
  }

  draggedEl.classList.remove(noDropClass)

  if (lastDropTargetRef.value) {
    lastDropTargetRef.value.classList.remove(dropTargetClass)
  }
  relatedEl.classList.add(dropTargetClass)
  lastDropTargetRef.value = relatedEl

  return true
}

/**
 * <zh/> 拖拽 onEnd 回调——清理 no-drop 和 drop-target 样式。
 * <en/> Drag onEnd callback — clean up no-drop and drop-target styles.
 * @param evt - <zh/> SortableJS end 事件 | <en/> SortableJS end event
 * @param noDropClass - <zh/> no-drop 样式类名 | <en/> no-drop style class name
 * @param dropTargetClass - <zh/> drop-target 样式类名 | <en/> drop-target style class name
 * @param lastDropTargetRef - <zh/> 上一个 drop 目标引用 | <en/> last drop-target reference
 * @param lastDropTargetRef.value - <zh/> 上一个 drop 目标元素 | <en/> last drop-target element
 */
export function handleDragEnd(
  evt: any,
  noDropClass: string,
  dropTargetClass: string,
  lastDropTargetRef: { value: HTMLElement | null },
): void {
  if (lastDropTargetRef.value) {
    lastDropTargetRef.value.classList.remove(dropTargetClass)
    lastDropTargetRef.value = null
  }
  evt.item?.classList.remove(noDropClass)
}
