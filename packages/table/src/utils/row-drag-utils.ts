import type { DragLocator } from '../types/drag-locator'
import { DEFAULT_ROW_HEIGHT } from '../constants'
import { devWarn } from './dev-warn'
import { isDev } from './env'
import { readRowKeyAttr } from './row-key-attr'

/**
 * <zh/> 按可视 DOM 顺序重排 fullData，保留不可见行原位。
 * <zh/> 纯函数，开发模式下对 key 不匹配输出警告。
 * <en/> Reorder fullData by the visible DOM order, keeping non-visible rows in place.
 * <en/> Pure function; logs a warning in dev mode when keys do not match.
 */
export function reorderFullDataByVisibleOrder<T>(
  fullData: T[],
  visibleKeysInDomOrder: string[],
  getKey: (row: T) => string,
  keyToRow?: Map<string, T>,
  onWarn?: (message: string, ...args: unknown[]) => void,
): T[] {
  if (visibleKeysInDomOrder.length === 0)
    return fullData

  const visibleSet = new Set(visibleKeysInDomOrder)
  const rowMap = keyToRow ?? new Map(fullData.map(row => [getKey(row), row] as const))
  let cursor = 0

  const next = fullData.map((row) => {
    const currentKey = getKey(row)
    if (!visibleSet.has(currentKey))
      return row
    const reorderedKey = visibleKeysInDomOrder[cursor++]
    const reorderedRow = reorderedKey ? rowMap.get(reorderedKey) : undefined
    if (!reorderedRow && reorderedKey && isDev) {
      if (onWarn)
        onWarn('[reorderFullDataByVisibleOrder] key 在 fullData 中未找到:', reorderedKey)
      else
        devWarn('[reorderFullDataByVisibleOrder] key 在 fullData 中未找到:', reorderedKey)
    }
    return reorderedRow ?? row
  })

  if (cursor === 0)
    return fullData

  if (cursor !== visibleKeysInDomOrder.length) {
    if (isDev) {
      if (onWarn)
        onWarn('[reorderFullDataByVisibleOrder] cursor 与 visibleKeys 长度不匹配:', cursor, visibleKeysInDomOrder.length)
      else
        devWarn('[reorderFullDataByVisibleOrder] cursor 与 visibleKeys 长度不匹配:', cursor, visibleKeysInDomOrder.length)
    }
    return fullData
  }

  return next
}

/** <zh/> 将 sourceKey 行移动到 targetKey 行的 before/after 位置 | <en/> Move the sourceKey row to the before/after position of the targetKey row */
export function reorderFullDataByMove<T>(
  fullData: readonly T[],
  sourceKey: string,
  targetKey: string,
  keyToIndex: Map<string, number>,
  targetSemantics: 'before' | 'after' = 'before',
): T[] {
  const sourceIdx = keyToIndex.get(sourceKey)
  const targetIdx = keyToIndex.get(targetKey)
  if (sourceIdx === undefined || targetIdx === undefined || sourceIdx === targetIdx)
    return fullData as T[]

  const result = fullData.slice()
  const [moved] = result.splice(sourceIdx, 1)
  const newTargetIdx = sourceIdx < targetIdx ? targetIdx - 1 : targetIdx

  const insertIdx = targetSemantics === 'after'
    ? newTargetIdx + 1
    : newTargetIdx

  result.splice(insertIdx, 0, moved)
  return result
}

/**
 * <zh/> 创建插入指示线 DOM 元素（suppressMoveWhenRowDragging 模式专用）。
 * <zh/> 纯函数，无闭包依赖，返回未挂载的指示线元素。
 * <en/> Create the drop-indicator DOM element (for suppressMoveWhenRowDragging mode).
 * <en/> Pure function with no closure dependencies; returns an unmounted indicator element.
 */
export function createDropIndicator(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'adv-table-row-drop-indicator'
  const line = document.createElement('div')
  line.className = 'adv-table-row-drop-indicator__line'
  const arrow = document.createElement('div')
  arrow.className = 'adv-table-row-drop-indicator__arrow'
  el.appendChild(line)
  el.appendChild(arrow)
  return el
}

/**
 * <zh/> 计算鼠标相对目标行的放置位置。
 * <en/> Compute the drop position of the cursor relative to the target row.
 * @param mouseY - <zh/> 鼠标 clientY 坐标 | <en/> mouse clientY coordinate
 * @param targetRow - <zh/> 目标行 DOM 元素 | <en/> target row DOM element
 * @returns <zh/> 'before' 目标行上方 / 'after' 目标行下方 | <en/> 'before' above the target row / 'after' below it
 */
export function calcDropPosition(mouseY: number, targetRow: HTMLElement): 'before' | 'after' {
  const rowRect = targetRow.getBoundingClientRect()
  const rowCenter = rowRect.top + rowRect.height / 2
  return mouseY < rowCenter ? 'before' : 'after'
}

/**
 * <zh/> 拖拽取消或 beforeDrag 拒绝时，将 DOM 顺序回滚到拖拽前状态。
 * <en/> Roll the DOM order back to its pre-drag state when the drag is cancelled or beforeDrag rejects.
 * @param evt - <zh/> SortableJS 事件对象，包含 from 容器和 item 拖拽元素 | <en/> SortableJS event object with the from container and the dragged item
 * @param evt.from - <zh/> 拖拽来源容器 | <en/> drag source container
 * @param evt.item - <zh/> 被拖拽的元素 | <en/> dragged item element
 * @param oldIndex - <zh/> 拖拽前的原始索引 | <en/> original index before dragging
 */
export function rollbackDomOrder(
  evt: { from: HTMLElement, item: HTMLElement },
  oldIndex: number | undefined,
): void {
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

/**
 * <zh/> 虚拟表格拖拽时，根据鼠标坐标计算目标行 key。
 * <en/> Compute the target row key from cursor coordinates during virtual-table dragging.
 * @param mouseY - <zh/> 鼠标 clientY 坐标 | <en/> mouse clientY coordinate
 * @param dragLoc - <zh/> 拖拽定位器，提供滚动容器、行高、命名空间等信息 | <en/> drag locator providing the scroll container, row height, namespace, etc.
 * @param currentFullData - <zh/> 当前完整数据 | <en/> current full data
 * @param getKeyFn - <zh/> 行 key 提取函数 | <en/> row key extractor
 * @param cachedVisibleRows - <zh/> 缓存的可见行 DOM 元素（可为 null） | <en/> cached visible row DOM elements (may be null)
 * @returns <zh/> 目标行 key，未命中时返回空字符串 | <en/> target row key, empty string when not hit
 */
export function calcVirtualTargetKey<T>(
  mouseY: number,
  dragLoc: DragLocator,
  currentFullData: T[],
  getKeyFn: (row: T) => string,
  cachedVisibleRows: HTMLElement[] | null,
): string {
  const scrollContainer = dragLoc.getScrollContainer?.()
  if (!scrollContainer)
    return ''

  const rect = scrollContainer.getBoundingClientRect()
  if (mouseY < rect.top || mouseY > rect.bottom)
    return ''

  const scrollTop = scrollContainer.scrollTop
  const absoluteY = mouseY - rect.top + scrollTop

  const rowHeight = dragLoc.getRowHeight?.()
  if (rowHeight) {
    const targetIdx = Math.floor(absoluteY / rowHeight)
    const clampedIdx = Math.max(0, Math.min(targetIdx, currentFullData.length - 1))
    return getKeyFn(currentFullData[clampedIdx])
  }

  if (!cachedVisibleRows || cachedVisibleRows.length === 0)
    return ''

  let lastKey = ''
  for (const row of cachedVisibleRows) {
    const rowTop = row.offsetTop
    const rowBottom = rowTop + row.offsetHeight
    // <zh/> 行 key 读取收口至 readRowKeyAttr——原先同函数内重复两遍同一模式
    // <en/> Row-key reads go through readRowKeyAttr — the same pattern was
    // <en/> duplicated twice inside this one function
    const key = readRowKeyAttr(row)
    if (absoluteY >= rowTop && absoluteY < rowBottom)
      return key || ''
    if (key)
      lastKey = key
  }

  if (lastKey)
    return lastKey

  const firstRowHeight = cachedVisibleRows[0]?.offsetHeight || DEFAULT_ROW_HEIGHT
  const targetIdx = Math.floor(absoluteY / firstRowHeight)
  const clampedIdx = Math.max(0, Math.min(targetIdx, currentFullData.length - 1))
  return getKeyFn(currentFullData[clampedIdx])
}
