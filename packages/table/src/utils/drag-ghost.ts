/**
 * @file drag-ghost.ts
 * @description
 * <zh/> 拖拽 ghost 的 DOM 操作（样式同步 + fallback 克隆定位）。
 * <en/> DOM operations for the drag ghost (style sync + fallback clone location).
 *
 * <remarks
 * <zh/> 本模块**不持有任何 EP 类名字面量**（选择器一律由 DOM 适配器经
 * <zh/> `DragLocator.getCellSelector()` 注入，EP 内部结构知识只存在于两个适配实现中）；
 * <zh/> 行 key 标记名同样统一取自 `ADV_TABLE_ROW_KEY_ATTR` 常量，不写字面量。
 * <en/> This module holds **no EP class-name literal** (selectors are injected by the DOM adapter via
 * <en/> `DragLocator.getCellSelector()`; EP-internal-structure knowledge lives only in the two adapter
 * <en/> implementations) and takes the row-key marker name from the `ADV_TABLE_ROW_KEY_ATTR` constant
 * <en/> rather than a literal.
 */
import { ADV_TABLE_ROW_KEY_ATTR } from '../constants'
import { readRowKeyAttr } from './row-key-attr'

const GHOST_INFO_ATTR = 'data-adv-table-ghost-info'

const ROW_STYLE_PROPS = [
  'width',
  'height',
  'boxSizing',
  'display',
  'flexWrap',
  'alignItems',
  'gap',
] as const

const CELL_STYLE_PROPS = [
  'width',
  'minWidth',
  'maxWidth',
  'height',
  'padding',
  'boxSizing',
  'flex',
  'flexShrink',
  'flexGrow',
  'flexBasis',
] as const

/**
 * <zh/> 为拖拽行附加 ghost 提示信息（首列文本摘要）。
 * <en/> Attach ghost hint info (first-column text summary) to a dragged row.
 * @param el - <zh/> 拖拽行 DOM 元素 | <en/> dragged row DOM element
 * @param count - <zh/> 拖拽行数，大于 1 时显示行数徽标 | <en/> number of dragged rows; shows a count badge when > 1
 * <zh/> 直接操作 DOM，不依赖 Vue 响应式；拖拽结束后需调用 removeGhostInfo 清理。
 * <en/> Operates on the DOM directly without Vue reactivity; call removeGhostInfo after dragging to clean up.
 */
export function attachGhostInfo(el: HTMLElement, count: number = 1): void {
  removeGhostInfo(el)

  // <zh/> 保留 EP 原生 `.cell` 并集：ElTable 恒在 td 内渲染 `.cell` 包裹层，而自有
  // <zh/> `.adv-table__cell` 仅覆盖经自家单元格管线的列；去 `.cell` 分支会使部分列取不到摘要。
  // <zh/> 此处为只读文本提取（拖拽徽标），EP 改名时最坏降级为无摘要徽标，不影响布局与数据。
  // <en/> Keep the EP-native `.cell` union: ElTable always renders a `.cell` wrapper inside td while the
  // <en/> owned `.adv-table__cell` only covers columns going through our cell pipeline. Read-only text
  // <en/> extraction for the drag badge; an EP rename degrades gracefully to a summary-less badge.
  const cells = el.querySelectorAll('td .cell, td .adv-table__cell')
  let summary = ''
  for (const cell of cells) {
    const text = cell.textContent?.trim()
    if (text) {
      summary = text.length > 20 ? `${text.slice(0, 20)}...` : text
      break
    }
  }

  if (!summary && count <= 1)
    return

  // SSR 环境无 document，跳过 ghost 修饰
  // Without document in SSR, skip ghost decoration
  if (typeof document === 'undefined')
    return
  const badge = document.createElement('div')
  badge.className = 'adv-table-ghost-info'
  badge.setAttribute(GHOST_INFO_ATTR, '')

  if (count > 1) {
    badge.classList.add('adv-table-ghost-info--multi')
    const countEl = document.createElement('span')
    countEl.className = 'adv-table-ghost-info__count'
    countEl.textContent = `${count}`
    badge.appendChild(countEl)
    if (summary) {
      badge.appendChild(document.createTextNode(` ${summary}`))
    }
  }
  else {
    badge.textContent = summary
  }

  el.style.position = 'relative'
  el.appendChild(badge)
}

/**
 * <zh/> 移除拖拽行的 ghost 提示信息。
 * <en/> Remove the ghost hint info from a dragged row.
 * @param el - <zh/> 拖拽行 DOM 元素 | <en/> dragged row DOM element
 */
export function removeGhostInfo(el: HTMLElement): void {
  const existing = el.querySelector(`[${GHOST_INFO_ATTR}]`)
  if (existing) {
    existing.remove()
  }
}

/**
 * <zh/> 将源行样式同步到 fallback 克隆行，保持视觉一致性。
 * <en/> Sync source-row styles onto the fallback clone row to keep visual consistency.
 * @param sourceRow - <zh/> 原始拖拽行 DOM 元素 | <en/> original dragged row DOM element
 * @param cellSelector - <zh/> 行内单元格的 CSS 选择器，由 DOM 适配器经 `DragLocator.getCellSelector()` 供给
 * <zh/>（default 模式为 `td`，virtual 模式为命名空间化的行单元格类名）。
 * <en/> CSS selector for cells inside a row, supplied by the DOM adapter via
 * <en/> `DragLocator.getCellSelector()` (native `td` in default mode; the namespace-aware row-cell class
 * <en/> in virtual mode).
 * <zh/> 读取 getComputedStyle 并逐属性复制到 body 上的 fallback 元素，仅在 forceFallback 模式下生效。
 * <en/> Reads getComputedStyle and copies each property onto the body's fallback element; only takes effect in forceFallback mode.
 *
 * @remarks
 * <zh/> 本模块刻意不持有任何 EP 类名字面量（原 `.el-table-v2__row-cell` 硬编码已上移至适配器）：
 * <zh/> 选择器是 EP 内部结构知识，其唯一出口是 `components/renderer-core/dom-adapter.ts`，
 * <zh/> EP 升级时只需改两个适配实现。
 * <en/> This module deliberately holds no EP class-name literal (the former hard-coded
 * <en/> `.el-table-v2__row-cell` moved up into the adapter): selectors are EP-internal-structure
 * <en/> knowledge whose only outlet is `components/renderer-core/dom-adapter.ts`, so an EP upgrade
 * <en/> only touches the two adapter implementations.
 */
export function syncFallbackStyles(sourceRow: HTMLElement, cellSelector: string): void {
  // SSR 环境无 document，直接返回
  // Without document in SSR, return directly
  if (typeof document === 'undefined')
    return
  // <zh/> fallback 克隆挂在 body（fallbackOnBody）——多实例同时拖拽时按行键属性匹配自家克隆，而非取全局首个
  // <en/> Fallback clones live on body (fallbackOnBody) — match this instance's clone by row-key attr when several tables drag, instead of taking the global first
  const candidates = document.body.querySelectorAll<HTMLElement>('.adv-table__row-fallback')
  if (!candidates.length)
    return
  // <zh/> 行 key 读取收口至 readRowKeyAttr；此处比对两侧仍用常量直读——
  // <zh/> 候选是克隆节点，标记必在自身，无需回退查询。
  // <en/> Row-key reads go through readRowKeyAttr; the candidate side still reads the
  // <en/> constant directly — candidates are clone nodes, so the marker is always on the node itself.
  const sourceKey = readRowKeyAttr(sourceRow)
  let fallbackEl: HTMLElement | null = null
  if (sourceKey != null) {
    for (const candidate of candidates) {
      if (candidate.getAttribute(ADV_TABLE_ROW_KEY_ATTR) === sourceKey) {
        fallbackEl = candidate
        break
      }
    }
  }
  fallbackEl ??= candidates[0] ?? null
  if (!fallbackEl)
    return

  const sourceStyle = getComputedStyle(sourceRow)
  const rowStyleValues: Record<string, string> = {}
  for (const prop of ROW_STYLE_PROPS) {
    const styleValue = sourceStyle[prop]
    if (styleValue)
      rowStyleValues[prop] = styleValue
  }

  const sourceCells = sourceRow.querySelectorAll(cellSelector)
  const fallbackCells = fallbackEl.querySelectorAll(cellSelector)

  const cellStyleValues: Record<string, string>[] = []
  sourceCells.forEach((sourceCell) => {
    const cellStyle = getComputedStyle(sourceCell)
    const values: Record<string, string> = {}
    for (const prop of CELL_STYLE_PROPS) {
      const styleValue = cellStyle[prop]
      if (styleValue)
        values[prop] = styleValue
    }
    cellStyleValues.push(values)
  })

  for (const prop of ROW_STYLE_PROPS) {
    const styleValue = rowStyleValues[prop]
    if (styleValue)
      fallbackEl.style.setProperty(prop, styleValue)
  }

  fallbackCells.forEach((fallbackCell, i) => {
    const values = cellStyleValues[i]
    if (!values)
      return
    const cellEl = fallbackCell as HTMLElement
    for (const prop of CELL_STYLE_PROPS) {
      const styleValue = values[prop]
      if (styleValue)
        cellEl.style.setProperty(prop, styleValue)
    }
  })

  const ghostInfo = sourceRow.querySelector(`[${GHOST_INFO_ATTR}]`)
  if (ghostInfo) {
    const clonedInfo = ghostInfo.cloneNode(true) as HTMLElement
    fallbackEl.style.position = 'relative'
    fallbackEl.appendChild(clonedInfo)
  }
}
