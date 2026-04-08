import type { VNode } from 'vue'
import type { SpanInfo } from '../../types'
import { cloneVNode, createCommentVNode, h } from 'vue'
import { DEFAULT_ROW_HEIGHT } from '../../constants'

/**
 * <zh/> span 行渲染的缺省行高——直接转出 `DEFAULT_ROW_HEIGHT`。
 * <zh/> 本文件此前自行写死 `48`，与 `constants` 的同名常量构成第二份真源；改默认行高时
 * <zh/> 漏改此处即出现「span 行与其余行高度不一致」的部分错位。
 * <en/> Default row height for span row rendering — re-exports `DEFAULT_ROW_HEIGHT` .
 * <en/> This file used to hard-code `48`, forming a second source of truth next to the constant in
 * <en/> `constants`; missing it on a default-height change yields partial misalignment where span rows
 * <en/> no longer match the other rows.
 */
export const V2_DEFAULT_ROW_HEIGHT = DEFAULT_ROW_HEIGHT

/** <zh/> 合并单元格相关类名常量 | <en/> Cell span related class name constants */
const SPAN_HIDDEN_CLASS = 'adv-table__cell-span-hidden'
const SPAN_ORIGIN_CLASS = 'adv-table__cell-span-origin'

/** <zh/> span 参与列的最小形状（与 use-virtual-span 的入参一致） | <en/> Minimal span column shape (matches use-virtual-span inputs) */
interface SpanColumn { prop?: string, fixed?: string | boolean }

/**
 * <zh/> 建立"cells 数组域"的双向索引映射。
 *
 * <zh/> ElTableV2 内部 mainColumns = [左固定占位..., 非固定列（含 selection）..., 右固定占位...]，
 * <zh/> `#row` 插槽收到的 cells 数组即此顺序；而本库的 normalColumns 是原始树序（固定列原位混排），
 * <zh/> v2Columns 是 [...selection, ...normalV2, ...fixedV2]。三套顺序互不一致——
 * <zh/> colIndexMap 禁止直接用 selectionCount + 原始序 i：存在 fixed:'left' 列（或固定列不在尾部）时
 * <zh/> 所有后续列的 span 类名/colspan 宽度都会落到错误的 cell 上。
 * <en/> Build the bidirectional index maps over the "cells array domain".
 *
 * <en/> EP's internal mainColumns = [left-fixed placeholders..., non-fixed columns (incl.
 * <en/> selection)..., right-fixed placeholders...], and the cells array received by the `#row`
 * <en/> slot follows exactly that order — while our normalColumns keeps the original tree order
 * <en/> (fixed columns mixed in place) and v2Columns is [...selection, ...normalV2, ...fixedV2].
 * <en/> The three orders diverge; the colIndexMap must never use selectionCount + original order:
 * <en/> with any fixed:'left' column (or fixed columns not at the tail) every later column's
 * <en/> span classes/colspan widths land on the wrong cell.
 *
 * @param selectionColumnCount - <zh/> selection 列数（cells 中位于左固定占位之后） | <en/> selection column count (after left-fixed placeholders in cells)
 * @param normalColumns - <zh/> 原始树序的 span 参与列（含固定列） | <en/> span columns in original tree order (fixed included)
 * @returns colIndexMap prop→cellIndex、cellIndexToV2Index cells下标→v2Columns下标、firstMainCellIndex 主区首个 cell 下标
 */
export function buildSpanCellIndexMaps(
  selectionColumnCount: number,
  normalColumns: SpanColumn[],
): {
  colIndexMap: Map<string, number>
  cellIndexToV2Index: (number | undefined)[]
  firstMainCellIndex: number
} {
  const leftFixed: SpanColumn[] = []
  const mainCols: SpanColumn[] = []
  const rightFixed: SpanColumn[] = []
  for (const col of normalColumns) {
    const f = col.fixed
    if (f === 'left' || f === true)
      leftFixed.push(col)
    else if (f === 'right')
      rightFixed.push(col)
    else
      mainCols.push(col)
  }

  const leftFixedCount = leftFixed.length
  const mainCount = mainCols.length
  const firstMainCellIndex = leftFixedCount + selectionColumnCount

  const colIndexMap = new Map<string, number>()
  const cellIndexToV2Index: (number | undefined)[] = []

  // <zh/> 左固定列：cells 中的占位格（不可作为 span origin，但宽度映射保留）
  // <en/> Left-fixed: placeholder cells in cells (not valid span origins, but width mapping kept)
  leftFixed.forEach((col, i) => {
    if (col.prop)
      colIndexMap.set(col.prop, i)
    cellIndexToV2Index[i] = selectionColumnCount + mainCount + i
  })
  // <zh/> 非固定列：leftFixedCount + selectionCount 之后依序排列
  // <en/> Non-fixed: sequential after leftFixedCount + selectionCount
  mainCols.forEach((col, i) => {
    if (col.prop)
      colIndexMap.set(col.prop, firstMainCellIndex + i)
    cellIndexToV2Index[firstMainCellIndex + i] = selectionColumnCount + i
  })
  // <zh/> 右固定列：cells 尾部的占位格
  // <en/> Right-fixed: placeholder cells at the tail of cells
  rightFixed.forEach((col, i) => {
    if (col.prop)
      colIndexMap.set(col.prop, firstMainCellIndex + mainCount + i)
    cellIndexToV2Index[firstMainCellIndex + mainCount + i] = selectionColumnCount + mainCount + leftFixedCount + i
  })

  return { colIndexMap, cellIndexToV2Index, firstMainCellIndex }
}

/**
 * <zh/> 向现有 class 字符串追加 span 类名，若已存在则跳过（避免双重注入）
 * <en/> Append span class to existing class string, skip if already present (avoid double injection)
 *
 * @remarks
 * <zh/> cellProps 通道与 MergeRow VNode 改写通道都可能给同一逻辑单元格加同名类，此处去重保证同一 class 字符串内不重复，与 applyAppendRow 的去重模式一致
 * <en/> Both the cellProps channel and MergeRow VNode rewrite channel may add the same class to the same logical cell, deduplication ensures no repetition within the same class string, consistent with applyAppendRow's dedup pattern
 */
function appendSpanClass(existingClass: string, spanClass: string): string {
  if (existingClass.includes(spanClass))
    return existingClass
  return existingClass ? `${existingClass} ${spanClass}` : spanClass
}

/**
 * <zh/> 创建 cellProps 函数，用于向 CellRenderer 注入合并单元格的类名
 * <en/> Create a cellProps function that injects merged-cell class names into CellRenderer
 * @returns <zh/> cellProps 函数，可直接传递给 ElTableV2 的 cellProps 属性 | <en/> cellProps function, directly passable to ElTableV2's cellProps prop
 */
export function createSpanCellProps(
  getSpanInfo: ((rowIndex: number, colKey: string, rowData?: unknown) => SpanInfo | undefined) | undefined,
  normalColumns: { prop?: string }[],
) {
  if (!getSpanInfo)
    return undefined

  /**
   * <zh/> 列标识 → 行数据字段（`prop`）反查表——本通道的键域归一化。
   * <zh/> 合并映射（spanMap）**始终以 `prop` 为键**（见 use-cell-span 建图侧，以及 SpanRow 的
   * <zh/> `colIndexMap`——它同样以 `prop` 为键），而 ElTableV2 交付的列对象以 `dataKey`/`key`
   * <zh/> 标识列（`normal-v2-column.tsx` 中 `key = getColumnKey(col)`、`dataKey = col.dataKey ?? col.prop`），
   * <zh/> 且不携带 `prop`。因此当显式 `dataKey`/`key` 与 `prop` 不同（如 `key: 'userName', prop: 'name'`）时，
   * <zh/> 直接以 `dataKey` 查询必然落空，使本通道（cellProps 类名注入）静默失效。
   * <zh/> 故先归一到 `prop` 域，与 VNode 通道取同一键域；标识冲突时先注册者胜（各列自己的 `prop` 最先登记）。
   * <en/> Column-identity → row-data-field (`prop`) reverse map — this channel's key-domain normalization.
   * <en/> The span map is **always keyed by `prop`** (see the builder in use-cell-span and SpanRow's
   * <en/> `colIndexMap`, itself `prop`-keyed), while ElTableV2 hands over column objects identified by
   * <en/> `dataKey`/`key` (`key = getColumnKey(col)`, `dataKey = col.dataKey ?? col.prop` in
   * <en/> normal-v2-column.tsx) which carry no `prop`. So when an explicit `dataKey`/`key` differs from
   * <en/> `prop` (e.g. `key: 'userName', prop: 'name'`), a `dataKey` query can never hit and this channel
   * <en/> (cellProps class injection) silently stops working. Normalizing to the `prop` domain here gives
   * <en/> both channels one key domain. First-wins on identifier collisions (each column's own `prop` first).
   */
  const keyToProp = new Map<string, string>()
  for (const col of normalColumns) {
    const prop = col.prop
    if (typeof prop !== 'string' || prop.length === 0)
      continue
    for (const alias of [prop, (col as { dataKey?: string }).dataKey, (col as { key?: string }).key]) {
      if (typeof alias === 'string' && alias.length > 0 && !keyToProp.has(alias))
        keyToProp.set(alias, prop)
    }
  }

  return (params: { rowData: any, rowIndex: number, column: any }) => {
    const { rowData, rowIndex, column } = params
    const colKey = column?.dataKey || column?.key
    if (!colKey)
      return {}

    const colProp = keyToProp.get(colKey)
    if (!colProp)
      return {}

    const spanInfo = getSpanInfo(rowIndex, colProp, rowData)
    if (!spanInfo)
      return {}

    if (!spanInfo.isOrigin) {
      return { class: SPAN_HIDDEN_CLASS }
    }

    if (spanInfo.rowspan > 1) {
      return { class: SPAN_ORIGIN_CLASS }
    }

    return {}
  }
}

/**
 * <zh/> SpanRow 渲染上下文——稳定组件身份背后的可变渲染输入。
 *
 * <zh/> 组件在每次行渲染时经 getContext 读取最新上下文；列配置/行高/插槽变化时由
 * <zh/> use-virtual-span 原地替换上下文对象。行重渲染本身由 EP 的列/数据变更驱动，
 * <zh/> 故上下文无需响应式（普通可变对象即可）。这切断了"列宽变化 → 组件类型变化 →
 * <zh/> `<component :is>` 使全部渲染行子树卸载重建"的链路（列宽拖拽结束/键盘调宽/
 * <zh/> 列配置变更时的整行闪烁、单元格内焦点与 DOM 状态丢失）。
 * <en/> SpanRow render context — mutable render inputs behind a stable component identity.
 *
 * <en/> The component reads the latest context via getContext on every row render;
 * <en/> use-virtual-span swaps the context object in place when columns/row-height/slots
 * <en/> change. Row re-renders are already driven by EP's column/data updates, so the context
 * <en/> needs no reactivity (a plain mutable object suffices). This severs the chain
 * <en/> "column-width change → component type change → `<component :is>` unmounts and remounts
 * <en/> every rendered row subtree" (full-row flicker and loss of in-cell focus/DOM state on
 * <en/> drag end / keyboard resize / column config changes).
 */
export interface SpanRowRenderContext {
  /** <zh/> 合并信息获取函数（undefined = 无合并；第三参行对象用于 grand/pin 换算，缺省回退直接查表） | <en/> Span info resolver (undefined = no span; 3rd row object for grand/pin translation, fallback direct lookup) */
  getSpanInfo: ((rowIndex: number, colKey: string, rowData?: unknown) => SpanInfo | undefined) | undefined
  /** <zh/> prop → cellIndex 映射（cells 数组域，含固定列三分区） | <en/> prop → cellIndex map (cells domain, fixed tri-partition included) */
  colIndexMap: Map<string, number>
  /** <zh/> 主区首个 cell 下标（左固定占位之后） | <en/> First main-region cell index (after left-fixed placeholders) */
  firstMainCellIndex: number
  /** <zh/> 行高（px）——rowspan 延伸高度计算 | <en/> Row height (px) for rowspan extension sizing */
  rowHeight: number
  /** <zh/> append 合成行判别 | <en/> Append synthetic-row predicate */
  isAppendRow?: (rowData: any) => boolean
  /** <zh/> append 内容渲染 | <en/> Append content renderer */
  renderAppendContent?: () => VNode[] | null
  /**
   * <zh/> 覆盖层样式解析——`spanDynamicMode:'rfc-overlay'` 时由 `useSpanOverlay.getOverlayStyle` 供给，
   * <zh/> 对 origin 格返回 absolute 覆盖层样式以替代 `rowspan × rowHeight` 估算；缺省（warn-only）即 undefined，
   * <zh/> 渲染路径与历史完全一致。
   * <en/> overlay style resolver — supplied by `useSpanOverlay.getOverlayStyle` under
   * <en/> `spanDynamicMode:'rfc-overlay'`, returning the absolute overlay style for origin cells
   * <en/> instead of the `rowspan × rowHeight` estimate; absent (warn-only) keeps the historic path
   * <en/> byte-identical.
   */
  getOverlayStyle?: (rowIndex: number, colKey: string, rowData?: unknown) => Record<string, string> | undefined
  /**
   * <zh/> cells 域下标 → 列宽（px）。未提供或返回 0 时回退到 VNode props 解析。
   * <zh/> 返回的宽度应反映 V2 列配置的实际渲染宽度（含列拖拽调整）；入参是 cells 数组域
   * <zh/> 下标（含固定列占位），调用方需经 buildSpanCellIndexMaps 对齐到 v2Columns 域。
   * <en/> cells-domain index → column width (px). Falls back to VNode props parsing when
   * <en/> absent or zero. The width should reflect the actual rendered V2 column config
   * <en/> (including drag resize); the input index is in the cells-array domain (fixed
   * <en/> placeholders included) — callers must align it via buildSpanCellIndexMaps.
   */
  getCellWidth?: (cellIndex: number) => number
}

/**
 * <zh/> 创建身份稳定的 SpanRow 行渲染组件——上下文经 getter 在每次渲染时读取。
 *
 * <zh/> 典型用法：组件只创建一次（markRaw 后经 `<component :is>` 挂载），列配置变化时
 * <zh/> 仅替换上下文对象，组件类型不变 → Vue 走 patch 而非卸载重建。
 * <en/> Create an identity-stable SpanRow row renderer — the context is read per render
 * <en/> through the getter.
 *
 * <en/> Typical usage: create the component once (markRaw + `<component :is>`), and on column
 * <en/> changes only swap the context object — the component type stays identical, so Vue
 * <en/> patches instead of unmounting/remounting.
 */
export function createStableSpanRowComponent(
  getContext: () => SpanRowRenderContext,
): (props: { cells: VNode[], rowIndex: number, rowData: any, columns?: any, isScrolling?: boolean, style?: Record<string, any> }) => VNode[] {
  function resolveCellWidth(ctx: SpanRowRenderContext, cell: VNode | undefined, cellIndex: number): number {
    if (ctx.getCellWidth) {
      const w = ctx.getCellWidth(cellIndex)
      if (w > 0)
        return w
    }
    if (!cell)
      return 0
    return Number.parseInt(String((cell.props?.style as Record<string, any> | undefined)?.width || '0'), 10) || 0
  }

  function applyAppendRow(ctx: SpanRowRenderContext, cells: VNode[]): VNode[] {
    if (!ctx.renderAppendContent || cells.length === 0)
      return cells

    const appendContent = ctx.renderAppendContent()

    let totalWidth = 0
    for (let ci = 0; ci < cells.length; ci++) {
      const cell = cells[ci]
      if (!cell)
        continue
      totalWidth += resolveCellWidth(ctx, cell, ci)
    }

    let targetIndex = -1
    // <zh/> 从主区首个 cell 起扫描——左固定占位格在 selection 之前，不能承载 append 内容
    // <en/> Scan from the first main-region cell — left-fixed placeholders precede the selection
    // <en/> cells and cannot host append content
    for (let ci = ctx.firstMainCellIndex; ci < cells.length; ci++) {
      if (cells[ci]) {
        targetIndex = ci
        break
      }
    }
    if (targetIndex < 0) {
      for (let ci = 0; ci < cells.length; ci++) {
        if (cells[ci]) {
          targetIndex = ci
          break
        }
      }
    }

    if (targetIndex < 0)
      return cells

    const targetCell = cells[targetIndex]!
    const targetProps = (targetCell.props as Record<string, any>) ?? {}
    const existingStyle = (targetProps.style as Record<string, any>) ?? {}
    const newChildren = appendContent && appendContent.length > 0 ? appendContent : []

    cells[targetIndex] = h(
      'div',
      {
        class: [
          ...(Array.isArray(targetProps.class) ? targetProps.class : [targetProps.class]),
          'adv-table__cell--append-row',
        ]
          .filter(Boolean)
          .flat()
          .filter((c, i, arr) => arr.indexOf(c) === i)
          .join(' '),
        style: {
          ...existingStyle,
          width: `${totalWidth}px`,
          textAlign: 'left',
        },
      },
      newChildren,
    )

    for (let ci = 0; ci < cells.length; ci++) {
      if (ci !== targetIndex)
        cells[ci] = null as unknown as VNode
    }

    return cells
  }

  return ({ cells, rowIndex, rowData }: { cells: VNode[], rowIndex: number, rowData: any, columns?: any, isScrolling?: boolean, style?: Record<string, any> }): VNode[] => {
    const { getSpanInfo, colIndexMap, rowHeight, isAppendRow } = getContext()

    if (isAppendRow && isAppendRow(rowData))
      return applyAppendRow(getContext(), cells)

    // DetailRow 由 CSS 实现视觉合并（position: absolute; inset: 0 覆盖整行），无需 JS 合并
    // DetailRow is visually merged via CSS (position: absolute; inset: 0 covers the whole row), no JS merging needed

    if (!getSpanInfo)
      return cells

    for (const [colProp, cellIndex] of colIndexMap) {
      // <zh/> 补传行对象——grand/pin/append 合成行不在 spanMap 域内时按身份回退 undefined（永不参与合并），
      // <zh/> 与 cellProps 通道（createSpanCellProps 传 3 参）对齐；两参直查会在合成行场景全表错位一位。
      // <en/> pass the row object — synthetic grand/pin/append rows miss the spanMap domain by identity
      // <en/> (never merged), aligned with the cellProps channel (3 args); a 2-arg direct lookup misaligns
      // <en/> the whole table by one in synthetic-row scenarios.
      const spanInfo = getSpanInfo(rowIndex, colProp, rowData)
      if (!spanInfo)
        continue

      let cell = cells[cellIndex]
      if (!cell)
        continue

      // cells 中的元素可能是数组（如果 slots.cell 返回多个 VNode）
      // Element in cells may be an array (if slots.cell returns multiple VNodes)

      if (Array.isArray(cell)) {
        cell = cell[0]
        if (!cell)
          continue
      }

      const existingProps = cell.props ?? {}

      // class 和 style 可能是数组或对象，需要规范化处理
      // class and style may be arrays or objects, need normalization

      const rawClass = existingProps.class
      const existingClass = Array.isArray(rawClass)
        ? rawClass.filter(Boolean).join(' ')
        : (rawClass as string) ?? ''

      const rawStyle = existingProps.style
      const existingStyle: Record<string, any> = Array.isArray(rawStyle)
        ? Object.assign({}, ...rawStyle.filter(Boolean))
        : (rawStyle as Record<string, any>) ?? {}

      if (!spanInfo.isOrigin) {
        // 被合并的单元格：设置 SPAN_HIDDEN_CLASS 类名，通过 CSS 隐藏
        // Merged cell: apply SPAN_HIDDEN_CLASS to hide it via CSS

        const newClass = appendSpanClass(existingClass, SPAN_HIDDEN_CLASS)
        cells[cellIndex] = cloneVNode(cell, { ...existingProps, class: newClass })
        continue
      }

      // 跨行合并：静态样式通过类名控制，动态计算值通过行内样式注入
      // Rowspan merge: static styles via class, dynamic computed values injected via inline style
      // rfc-overlay 时 origin 格改走绝对定位覆盖层（getOverlayStyle），替代 rowspan 估算；
      // 缺省（warn-only / getOverlayStyle 缺席）保持既有估算路径。
      // under rfc-overlay origin cells take the absolute overlay (getOverlayStyle) instead of
      // the rowspan estimate; absent (warn-only) keeps the historic estimate path, zero behavior change.
      const overlayStyle = getContext().getOverlayStyle?.(rowIndex, colProp, rowData)
      const rowspanStyle = overlayStyle
        ? { ...existingStyle, ...overlayStyle }
        : spanInfo.rowspan > 1
          ? {
              ...existingStyle,
              height: `${spanInfo.rowspan * rowHeight}px`,
            }
          : existingStyle

      const rowspanClass = spanInfo.rowspan > 1
        ? appendSpanClass(existingClass, SPAN_ORIGIN_CLASS)
        : existingClass

      if (spanInfo.colspan > 1) {
        let totalWidth = resolveCellWidth(getContext(), cell, cellIndex)
        for (let ci = 1; ci < spanInfo.colspan; ci++) {
          const targetCellIndex = cellIndex + ci
          const targetCell = cells[targetCellIndex]
          totalWidth += resolveCellWidth(getContext(), targetCell, targetCellIndex)
          cells[targetCellIndex] = createCommentVNode('merged')
        }

        const mergedStyle = {
          ...rowspanStyle,
          width: `${totalWidth}px`,
        }
        cells[cellIndex] = cloneVNode(cell, { ...existingProps, style: mergedStyle, class: rowspanClass })
      }
      else if (spanInfo.rowspan > 1) {
        cells[cellIndex] = cloneVNode(cell, { ...existingProps, style: rowspanStyle, class: rowspanClass })
      }
    }

    return cells
  }
}

/**
 * <zh/> 创建虚拟模式下支持行合并的行渲染组件（快照式便捷封装）。
 *
 * <zh/> 参数在创建时烘焙进闭包——列配置变化需重建组件（组件类型变化触发行子树重挂载）。
 * <zh/> 性能敏感场景请改用 createStableSpanRowComponent + 可变上下文（use-virtual-span
 * <zh/> 即此用法）；本封装为快照式便捷入口（单测直接覆盖其参数烘焙语义）。
 * <en/> Create a row renderer component supporting row merging in virtual mode (snapshot-style
 * <en/> convenience wrapper).
 *
 * <en/> Arguments are baked into the closure at creation — column changes require rebuilding
 * <en/> the component (a component-type change remounts row subtrees). For performance-sensitive
 * <en/> paths use createStableSpanRowComponent with a mutable context (what use-virtual-span
 * <en/> does); this wrapper is the snapshot-style convenience entry (unit-tested for its bake-in semantics).
 */
export function createSpanRowComponent(
  getSpanInfo: ((rowIndex: number, colKey: string) => SpanInfo | undefined) | undefined,
  selectionColumnCount: number,
  normalColumns: { prop?: string, fixed?: string | boolean }[],
  rowHeight: number = V2_DEFAULT_ROW_HEIGHT,
  isAppendRow?: (rowData: any) => boolean,
  renderAppendContent?: () => VNode[] | null,
  getCellWidth?: (cellIndex: number) => number,
) {
  // <zh/> 与 EP mainCells 数组域对齐的 prop→cellIndex 映射（含固定列三分区）
  // <en/> prop→cellIndex map aligned with EP's mainCells array domain (fixed tri-partition included)
  const { colIndexMap, firstMainCellIndex } = buildSpanCellIndexMaps(selectionColumnCount, normalColumns)

  return createStableSpanRowComponent(() => ({
    getSpanInfo,
    colIndexMap,
    firstMainCellIndex,
    rowHeight,
    isAppendRow,
    renderAppendContent,
    getCellWidth,
  }))
}
