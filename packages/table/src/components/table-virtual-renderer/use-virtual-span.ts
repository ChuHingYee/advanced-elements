/**
 * <zh/> 虚拟渲染器合并单元格 composable — 管理 SpanRow 组件和 spanCellProps 的创建与响应式更新
 *
 * <zh/> 从 table-virtual-renderer.vue 提取，减少主组件文件体积。
 * <zh/> 当 spanEnabled / append 插槽 / 行展开任一启用时，创建 SpanRow 组件和 cellProps 函数；
 * <zh/> 否则置空以避免不必要的 VNode 改写开销。
 *
 * <zh/> 组件身份稳定化（性能热点约束）：SpanRow 仅创建一次，列配置/行高/插槽变化时只
 * <zh/> 原地替换渲染上下文（SpanRowRenderContext）。v2Columns 引用变化
 * <zh/> （列宽拖拽结束/键盘调宽/列设置变更）时禁止重建组件——否则 `<component :is>` 因组件类型
 * <zh/> 变化触发全部渲染行子树卸载重建（整行闪烁、单元格内焦点与 DOM 状态丢失）。
 * <zh/> 组件类型保持不变，Vue 走 patch；行重渲染仍由 EP 的列/数据变更正常驱动。
 *
 * <en/> Virtual renderer span composable — manages SpanRow component and spanCellProps creation and reactive updates
 *
 * <en/> Extracted from table-virtual-renderer.vue to reduce the main component file size.
 * <en/> When any of spanEnabled / append slot / row expand is enabled, creates the SpanRow component and cellProps function;
 * <en/> otherwise clears them to avoid unnecessary VNode rewrite overhead.
 *
 * <en/> Component-identity stabilization (performance hotspot constraint): SpanRow is created ONCE;
 * <en/> column/row-height/slot changes only swap the render context (SpanRowRenderContext) in
 * <en/> place. The watch must never rebuild the component on v2Columns reference changes
 * <en/> (column-width drag end / keyboard resize / column setting updates) — otherwise `<component :is>`
 * <en/> unmounts and remounts every rendered row subtree (full-row flicker, loss of
 * <en/> in-cell focus and DOM state). The component type stays stable, so Vue patches; row
 * <en/> re-renders remain driven by EP's column/data updates.
 */
import type { Component, MaybeRefOrGetter, ShallowRef, Slots } from 'vue'
import type { SpanInfo } from '../../types'
import type { SpanDynamicCoexistence } from '../../types/renderer-interface'
import type { SpanRowRenderContext } from './span-row-renderer'
import { markRaw, shallowRef, toValue, watch } from 'vue'
import { useSpanOverlay } from '../../composables/rendering/use-span-overlay'
import { isAppendRowData } from './append-row-helpers'
import {
  buildSpanCellIndexMaps,
  createSpanCellProps,
  createStableSpanRowComponent,
  V2_DEFAULT_ROW_HEIGHT,
} from './span-row-renderer'

export interface UseVirtualSpanOptions {
  /** <zh/> 是否启用合并单元格 | <en/> Whether cell span is enabled */
  spanEnabled: MaybeRefOrGetter<boolean | undefined>
  /** <zh/> 合并信息获取函数 | <en/> Span info resolver function */
  getSpanInfo: MaybeRefOrGetter<((rowIndex: number, colKey: string) => SpanInfo | undefined) | undefined>
  /** <zh/> selection 列配置 | <en/> Selection column configs */
  selectionColumns: MaybeRefOrGetter<{ prop?: string }[]>
  /** <zh/> 普通列配置 | <en/> Normal column configs */
  normalColumns: MaybeRefOrGetter<{ prop?: string }[]>
  /** <zh/> 行高 | <en/> Row height */
  rowHeight: MaybeRefOrGetter<number | undefined>
  /** <zh/> 是否有 append 插槽 | <en/> Whether an append slot exists */
  hasAppendSlot: MaybeRefOrGetter<boolean>
  /** <zh/> 行展开是否启用 | <en/> Whether row expand is enabled */
  rowExpandEnabled: MaybeRefOrGetter<boolean | undefined>
  /** <zh/> 透传的插槽 | <en/> Forwarded slots */
  slots: MaybeRefOrGetter<Slots>
  /** <zh/> V2 列配置（用于获取列宽） | <en/> V2 column configs (for column width resolution) */
  v2Columns: MaybeRefOrGetter<any[]>
  /**
   * <zh/> 共存策略（特性开关，缺省 warn-only 零行为变更）| <en/> Coexistence strategy (flag, default warn-only = zero behavior change)
   */
  spanDynamicMode?: MaybeRefOrGetter<SpanDynamicCoexistence | undefined>
  /**
   * <zh/> 是否动态行高（缺省 false；渲染器侧以 effectiveEstimatedRowHeight!=null 供给）| <en/> Whether dynamic row height (default false; renderer supplies effectiveEstimatedRowHeight!=null)
   */
  isDynamic?: MaybeRefOrGetter<boolean>
}

export interface UseVirtualSpanReturn {
  /** <zh/> SpanRow 行渲染组件（身份稳定，仅启用/停用翻转时更换） | <en/> SpanRow row renderer (identity-stable, swapped only on enable/disable flips) */
  SpanRow: ShallowRef<Component | null>
  /** <zh/> cellProps 函数，注入合并单元格类名 | <en/> cellProps function, injects span class names */
  spanCellProps: ShallowRef<((params: any) => Record<string, any>) | undefined>
  /** <zh/> 覆盖层样式解析（warn-only 下恒 undefined） | <en/> overlay style resolver (always undefined under warn-only) */
  getOverlayStyle: (rowIndex: number, colKey: string, rowData?: unknown) => Record<string, string> | undefined
}

/**
 * <zh/> 创建虚拟渲染器合并单元格管理器
 * <en/> Create virtual renderer span manager
 */
export function useVirtualSpan(options: UseVirtualSpanOptions): UseVirtualSpanReturn {
  const {
    spanEnabled,
    getSpanInfo,
    selectionColumns,
    normalColumns,
    rowHeight,
    hasAppendSlot,
    rowExpandEnabled,
    slots,
    v2Columns,
    spanDynamicMode,
    isDynamic,
  } = options

  const SpanRow = shallowRef<Component | null>(null)
  const spanCellProps = shallowRef<((params: any) => Record<string, any>) | undefined>(undefined)

  /**
   * <zh/> 最小接线：`useSpanOverlay.getOverlayStyle` 的全库首处消费。
   * <zh/> 默认 warn-only 时恒返回 undefined；rfc-overlay + span×dynamic 时返回 absolute 覆盖层。
   * <en/> minimal wiring: the first in-repo consumption of `useSpanOverlay.getOverlayStyle`.
   * <en/> Warn-only by default always yields undefined; rfc-overlay + span×dynamic
   * <en/> yields the absolute overlay.
   */
  const spanOverlay = useSpanOverlay({
    spanEnabled: () => Boolean(toValue(spanEnabled)),
    isDynamic: () => Boolean(toValue(isDynamic) ?? false),
    rowHeight: () => toValue(rowHeight) ?? V2_DEFAULT_ROW_HEIGHT,
    getSpanInfo: (rowIndex, colKey, rowData?: unknown) => {
      const fn = toValue(getSpanInfo) as ((rowIndex: number, colKey: string, rowData?: unknown) => SpanInfo | undefined) | undefined
      return fn?.(rowIndex, colKey, rowData) as { rowspan: number, colspan: number, isOrigin: boolean } | undefined
    },
    spanDynamicMode: () => toValue(spanDynamicMode) ?? 'warn-only',
  })

  /**
   * <zh/> 渲染上下文——SpanRow 组件在渲染时经 getContext 读取。普通可变对象：
   * <zh/> 行重渲染由 EP 的列/数据变更驱动，上下文无需响应式；watch 触发时整体替换
   * <zh/> 该变量即可让下一次渲染读到最新列配置。
   * <en/> Render context — read by SpanRow at render time via getContext. A plain mutable
   * <en/> object: row re-renders are driven by EP's column/data updates, so no reactivity is
   * <en/> needed; swapping this variable on watch fire gives the next render the latest config.
   */
  let context: SpanRowRenderContext | null = null

  /**
   * <zh/> 响应式依赖追踪——仅在"能力布尔态"或列/行高/插槽输入变化时更新上下文与 cellProps；
   * <zh/> SpanRow 组件引用仅在 null ↔ 组件之间翻转（启用/停用），列变化不再更换组件类型。
   * <en/> Reactive dependency tracking — updates the context and cellProps whenever the
   * <en/> capability booleans or column/row-height/slot inputs change; the SpanRow component
   * <en/> reference only flips between null and the component (enable/disable), so column
   * <en/> changes no longer swap the component type.
   */
  watch(
    [
      () => toValue(spanEnabled),
      () => toValue(hasAppendSlot),
      () => toValue(rowExpandEnabled),
      // <zh/> getSpanInfo 也要追踪：生产中它是稳定函数引用（内部读实时 spanMap），
      // <zh/> 但若实现 ever 替换函数身份（如管线 noop→real 升级），上下文必须随之更新，
      // <zh/> 否则 SpanRow 永远渲染旧解析器。
      // <en/> getSpanInfo must be tracked: in production it is a stable function reference
      // <en/> (internally reading the live spanMap), but if its identity is ever swapped
      // <en/> (e.g. the pipeline's noop→real upgrade), the context must follow — otherwise
      // <en/> SpanRow renders a stale resolver forever (the original implementation baked the
      // <en/> creation-time function and had the same gap).
      () => toValue(getSpanInfo),
      () => toValue(normalColumns),
      () => toValue(selectionColumns),
      () => toValue(v2Columns),
      () => toValue(rowHeight),
      () => toValue(slots),
      () => toValue(spanDynamicMode),
      () => toValue(isDynamic),
    ],
    ([_spanEnabled, _hasAppendSlot, _rowExpandEnabled]) => {
      if (!(_spanEnabled || _hasAppendSlot || _rowExpandEnabled)) {
        SpanRow.value = null
        spanCellProps.value = undefined
        context = null
        return
      }
      const _getSpanInfo = toValue(getSpanInfo)
      const _selectionColumns = toValue(selectionColumns)
      const _normalColumns = toValue(normalColumns) as { prop?: string, fixed?: string | boolean }[]
      const _rowHeight = toValue(rowHeight)
      const _slots = toValue(slots)
      const _v2Columns = toValue(v2Columns)

      const maps = buildSpanCellIndexMaps(_selectionColumns.length, _normalColumns)

      context = {
        getSpanInfo: _getSpanInfo ?? undefined,
        colIndexMap: maps.colIndexMap,
        firstMainCellIndex: maps.firstMainCellIndex,
        rowHeight: _rowHeight ?? V2_DEFAULT_ROW_HEIGHT,
        // <zh/> rfc-overlay 时供给覆盖层样式；warn-only 时 getOverlayStyle 恒返回 undefined，渲染零变更
        // <en/> overlay style under rfc-overlay; warn-only keeps getOverlayStyle always-undefined, zero render change
        getOverlayStyle: (rowIndex: number, colKey: string, rowData?: unknown) => spanOverlay.getOverlayStyle(rowIndex, colKey, rowData),
        isAppendRow: _hasAppendSlot ? isAppendRowData : undefined,
        renderAppendContent: _hasAppendSlot
          ? () => {
              const appendVNodes = _slots.append?.() ?? null
              if (!appendVNodes)
                return null
              // <zh/> any 说明（已用 vue-tsc 验证）：vnode.children 数组元素为 VNodeChildAtom（含字符串等非 VNode），
              // <zh/> 而 renderAppendContent 契约要求 VNode[]；不断言即编译错误。断言仅收窄调用点，运行时逐字节不变。
              // <en/> Why any (verified with vue-tsc): vnode.children elements are VNodeChildAtoms (incl. non-VNode strings),
              // <en/> while renderAppendContent contracts VNode[]; removing the assertion is a compile error. Runtime is byte-identical.
              return appendVNodes.flatMap((vnode) => {
                if (vnode.type === Symbol.for('v-fgt') || (vnode.type as any) === Symbol.for('Fragment'))
                  return Array.isArray((vnode as any).children) ? (vnode as any).children : [vnode]
                return [vnode]
              })
            }
          : undefined,
        // <zh/> cells 数组域 → v2Columns 域的宽度解析——cells 含固定列占位且顺序为
        // <zh/> [左固定, selection, 非固定, 右固定]，与 v2Columns 的
        // <zh/> [...selection, ...normal, ...fixed] 不同，直接按下标取宽会错位。
        // <en/> cells-array-domain → v2Columns-domain width resolution — cells include fixed
        // <en/> placeholders ordered [leftFixed, selection, nonFixed, rightFixed], which differs
        // <en/> from v2Columns' [...selection, ...normal, ...fixed]; indexing v2Columns directly
        // <en/> by cell index misaligns widths.
        getCellWidth: (cellIndex: number) => {
          const v2Index = maps.cellIndexToV2Index[cellIndex]
          return v2Index == null ? 0 : (_v2Columns[v2Index]?.width ?? 0)
        },
      }

      // <zh/> 身份稳定的核心：仅首次启用时创建组件，此后列/行高/插槽变化只换上下文
      // <en/> Identity-stabilization core: create the component only on first enable;
      // <en/> subsequent column/row-height/slot changes only swap the context
      SpanRow.value ??= markRaw(createStableSpanRowComponent(() => context!))

      spanCellProps.value = createSpanCellProps(
        _getSpanInfo ?? undefined,
        _normalColumns,
      )
    },
    { immediate: true },
  )

  return {
    SpanRow,
    spanCellProps,
    getOverlayStyle: (rowIndex: number, colKey: string, rowData?: unknown) => spanOverlay.getOverlayStyle(rowIndex, colKey, rowData),
  }
}
