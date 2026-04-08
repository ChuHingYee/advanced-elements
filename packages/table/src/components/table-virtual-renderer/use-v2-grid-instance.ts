/**
 * <zh/> virtual 渲染器的网格实例域
 * <en/> Virtual-renderer grid-instance domain
 *
 * @remarks
 * <zh/> 职责单一：决定 ElTableV2 的**网格模式**（固定行高 FixedSizeGrid / 动态行高 DynamicSizeGrid）
 * <zh/> 与实例生命周期——即 `gridInstanceKey`（翻转即强制重挂载）及其滚动恢复，
 * <zh/> 以及高度解析与垂直滚动条预留宽度。
 * <zh/> 不变量：模式翻转会整体重挂载实例并双侧归零滚动位置，故必须**先记录后恢复**。
 * <en/> Single responsibility: decide ElTableV2's **grid mode** (FixedSizeGrid / DynamicSizeGrid) and
 * <en/> its instance lifecycle — i.e. `gridInstanceKey` (a flip forces a remount) plus scroll restore,
 * <en/> height parsing and the reserved vertical scrollbar width.
 * <en/> Invariant: a mode flip remounts the whole instance and zeroes scroll on both sides, so the
 * <en/> position MUST be recorded before and restored after.
 */
import type { ComputedRef, Ref } from 'vue'
import type { UseV2ScrollApiReturn } from './use-v2-scroll-api'
import type { V2RendererProps } from './v2-renderer-props'
import { computed, nextTick, shallowRef, watch } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { parseExplicitHeightPx, resolveEffectiveEstimatedRowHeight } from '../../utils/estimated-row-height'

/** <zh/> 网格实例域依赖 | <en/> Grid-instance domain deps */
export interface UseV2GridInstanceDeps {
  /** <zh/> 渲染器 props | <en/> renderer props */
  props: V2RendererProps
  /** <zh/> 行展开 API（展开能力是否配置 / 是否存在展开详情行） | <en/> row-expand API (configured / any detail row expanded) */
  rowExpandApi?: { expandEnabled: Ref<boolean>, expandedRowKeys: Ref<Set<string | number>> }
  /** <zh/> 是否存在 append 插槽 | <en/> whether the append slot exists */
  hasAppendSlot: ComputedRef<boolean>
  /** <zh/> 当前滚动位置（重挂载恢复用） | <en/> current scroll position (for remount restore) */
  currentScrollTop: { value: number }
  /** <zh/> 当前横向滚动位置（重挂载恢复用） | <en/> current horizontal scroll position (for remount restore) */
  currentScrollLeft: { value: number }
  /** <zh/> V2 程序化滚动探针 | <en/> V2 programmatic-scroll probe */
  v2ScrollApi: UseV2ScrollApiReturn
}

/** <zh/> 网格实例域返回 | <en/> Grid-instance domain return */
export interface UseV2GridInstanceReturn {
  /** <zh/> 数值化高度（height 支持 string | number，未传回退 400） | <en/> numeric height (height accepts string | number, falls back to 400) */
  numericHeight: ComputedRef<number>
  /**
   * <zh/> 显式 px 高度（正数/纯 px 串才有值）——渲染器以此优先于 AutoResizer 实测，与 default 模式对齐
   * <en/> Explicit px height (set only for positive numbers / pure-px strings) — renderers prefer it over
   * <en/> AutoResizer measurement, aligned with default mode
   */
  explicitHeightPx: ComputedRef<number | undefined>
  /** <zh/> 生效的预估行高（undefined 表示固定行高网格） | <en/> effective estimated row height (undefined means fixed-row-height grid) */
  effectiveEstimatedRowHeight: ComputedRef<number | undefined>
  /** <zh/> 网格实例键——翻转即强制 ElTableV2 重挂载 | <en/> grid instance key — a flip forces an ElTableV2 remount */
  gridInstanceKey: ComputedRef<string>
  /** <zh/> 垂直滚动条预留宽度（px） | <en/> reserved vertical scrollbar width (px) */
  vScrollbarSize: ComputedRef<number>
  /** <zh/> 汇总行滚动条预留量（CSS 变量），与 vScrollbarSize 同源 | <en/> summary-row scrollbar gutter (CSS var), same source as vScrollbarSize */
  summaryGutterVar: ComputedRef<Record<string, string>>
  /**
   * <zh/> 请求行高重测——推进重挂载代际，使目标行重新挂载并重跑 EP 的 `onMounted` 实测；
   * <zh/> 滚动位置由 gridInstanceKey watcher 自动记录/恢复。
   * <en/> Request a row-height re-measure — bumps the remount epoch so the target row
   * <en/> re-mounts and EP re-runs its onMounted measurement; scroll is restored by the watcher.
   */
  requestRowRemeasure: () => void
}

/**
 * <zh/> 创建网格实例域
 * <en/> Create the grid-instance domain
 */
export function useV2GridInstance(deps: UseV2GridInstanceDeps): UseV2GridInstanceReturn {
  const {
    props,
    rowExpandApi,
    hasAppendSlot,
    currentScrollTop,
    currentScrollLeft,
    v2ScrollApi,
  } = deps

  /**
   * <zh/> 显式 px 高度——height 为正数或纯 `px` 串时直接采用；相对单位/缺省返回 undefined，
   * <zh/> 调用方回退 AutoResizer 实测。与 default 模式 ElTable 直传语义对齐：显式值优先于实测，
   * <zh/> 避免在不定高祖先（如 demo 的 min-height 面板）下实测值把表格撑满。
   * <en/> Explicit px height — adopted when height is a positive number or a pure-`px` string;
   * <en/> relative units / missing values yield undefined so callers fall back to AutoResizer measurement.
   * <en/> Aligned with default-mode ElTable passthrough: explicit wins over measured, so tables never
   * <en/> stretch to fill indefinite ancestors (e.g. the demo's min-height panels).
   */
  const explicitHeightPx = computed(() => parseExplicitHeightPx(props.height))

  /**
   * <zh/> 高度字符串解析（如 "320px" → 320），兼容 AdvTable height 支持 string | number；未传回退 400 避免 ElTableV2 height=0 白屏。
   * <zh/> **只接受正数或纯 `px` 字符串**——CSS 相对单位（`50vh` / `%` / `calc(...)`）交由
   * <zh/> AutoResizer 实测像素兜底（`cHeight`），`parseInt` 会把 `50vh` 误当 50px、calc 误判非法。
   * <zh/> 零测量（SSR / 首帧 / drawer 未展开）时回退 400。
   * <en/> Parse height string (e.g. "320px" → 320). **only positive numbers or pure `px`
   * <en/> strings** are accepted — CSS relative units (`50vh` / `%` / `calc(...)`) rely on the
   * <en/> AutoResizer measurement fallback (`cHeight`); `parseInt` would read `50vh` as 50px.
   * <en/> Falls back to 400 when measurement is unavailable (SSR / first frame / closed drawer).
   */
  const numericHeight = computed(() => explicitHeightPx.value ?? 400)

  /**
   * <zh/> 生效的预估行高——决定 ElTableV2 是否启用动态行高测量（DynamicSizeGrid）
   * <zh/> 当存在 append 插槽或行展开详情行，且用户未显式设置 estimatedRowHeight 时，自动回退到 rowHeight，
   * <zh/> 使 append 合成行与 expand 详情行能被 getBoundingClientRect 测量出真实高度，
   * <zh/> 避免被固定行高截断或留白。append 插槽与 expandRow 插槽均须覆盖：expandRow 插槽内容超过固定
   * <zh/> rowHeight（默认 48px）时必须能被测量显示，不得要求用户手动设置 estimatedRowHeight。
   * <zh/> 数据行因高度与 rowHeight 一致，测量后不会触发额外的 forceUpdate。
   * <en/> Effective estimated row height — decides whether ElTableV2 enables dynamic row height measurement (DynamicSizeGrid)
   * <en/> When the append slot OR expanded detail rows are present and the user has not explicitly set
   * <en/> estimatedRowHeight, falls back to rowHeight, allowing synthetic append rows and expand detail
   * <en/> rows to be measured via getBoundingClientRect for their real height, avoiding fixed-row-height
   * <en/> clipping or whitespace. Both the append slot and the expandRow slot must be covered: expandRow slot content
   * <en/> taller than the fixed rowHeight (default 48px) must be measurable without manual estimatedRowHeight opt-in.
   * <en/> Data rows match rowHeight, so measurement triggers no extra forceUpdate.
   * @remarks
   * <zh/> 仅渲染中的行（visible + cache）会被测量，全量数据不会产生 O(n) 开销
   * <en/> Only rendered rows (visible + cache) are measured; full data does not incur O(n) overhead
   */
  // <zh/> 是否具备展开能力（配置了展开行）——与"是否存在实际展开的详情行"区分：
  // <zh/> 前者决定网格模式（静态输入，运行时不变 → 无翻转），后者参与行高决议
  // <zh/> （见 resolveEffectiveEstimatedRowHeight：存在实际展开行时进入可测量模式）。
  // <en/> Whether expansion is configured — distinguished from "any detail row actually expanded":
  // <en/> the former decides the grid mode (static input, never flips at runtime), the latter feeds
  // <en/> the row-height resolution (see resolveEffectiveEstimatedRowHeight).
  const expandCapable = computed(() => rowExpandApi?.expandEnabled.value ?? false)
  const hasExpandDetailRows = computed(() => (rowExpandApi?.expandedRowKeys.value.size ?? 0) > 0)
  const effectiveEstimatedRowHeight = computed<number | undefined>(() =>
    resolveEffectiveEstimatedRowHeight({
      estimatedRowHeight: props.estimatedRowHeight,
      spanEnabled: props.spanEnabled,
      hasAppendSlot: hasAppendSlot.value,
      expandCapable: expandCapable.value,
      hasExpandDetailRows: hasExpandDetailRows.value,
      rowHeight: props.rowHeight,
    }),
  )

  /**
   * <zh/> 网格实例键——estimatedRowHeight 在 undefined ↔ number 间切换时强制 ElTableV2 重挂载。
   * <zh/> EP 2.14 内部竞态：网格类型切换（Fixed↔Dynamic）发生在子组件重渲染阶段，而其内部
   * <zh/> useData 的 pre-watcher 会先一步以"isDynamic=true"调用 resetAfterRowIndex——此时
   * <zh/> bodyRef 仍指向旧 Fixed 网格（无该方法）→ TypeError → 被错误边界捕获后整表白屏。
   * <zh/> 以 key 重挂载后，旧实例的待执行 watcher 随卸载取消，新实例直接以目标网格类型构建。
   * <zh/> 非 span 表因常驻动态不再翻转（展开/折叠/静态 append 均稳定）；残余翻转仅来自
   * <zh/> span 表的惰性进入、append 插槽的运行时显隐与 estimatedRowHeight 显式切换，
   * <zh/> 滚动位置由 reconcile 机制兜底（见下）。
   * <en/> Grid instance key — forces an ElTableV2 remount when estimatedRowHeight flips between
   * <en/> undefined and a number. EP 2.14 races internally: the grid type swap happens during the
   * <en/> child re-render, but EP's internal useData pre-watcher fires first and calls
   * <en/> resetAfterRowIndex with isDynamic=true while bodyRef still binds the old Fixed grid
   * <en/> (method missing) → TypeError, swallowed by the error boundary into a blank table.
   * <en/> Remounting via key cancels the stale watchers with the old instance and builds the new one
   * <en/> directly in the target grid mode. Non-span tables never flip thanks to the resident
   * <en/> dynamic grid above; remaining flips come only from span-table lazy entry, append-slot
   * <en/> runtime toggling, or explicit estimatedRowHeight switches. Scroll position falls back
   * <en/> to the reconcile mechanism (see below).
   */
  /**
   * <zh/> 重测代际——EP 2.14 的行高实测只发生在行组件 `onMounted`
   * <zh/> （`row.mjs` 的 `doMeasure(true)`，无 ResizeObserver / watch），故异步撑高后
   * <zh/> 单纯调用 `resetAfterRowIndex` 不会重新测量已挂载行。推进该代际即整体重挂载网格，
   * <zh/> 全部可见行重新挂载 → 重跑实测 → `rowHeights` 与后续行位置随之更新。
   * <en/> Re-measure epoch — EP 2.14 only measures row heights in the row component's
   * <en/> `onMounted` (`doMeasure(true)`; no ResizeObserver / watch), so calling
   * <en/> `resetAfterRowIndex` after async growth never re-measures mounted rows. Bumping this
   * <en/> epoch remounts the grid so every visible row re-measures.
   */
  const rowRemeasureEpoch = shallowRef(0)
  const requestRowRemeasure = (): void => {
    rowRemeasureEpoch.value++
  }

  const gridInstanceKey = computed(() =>
    `${effectiveEstimatedRowHeight.value === undefined ? 'fixed' : 'dynamic'}#${rowRemeasureEpoch.value}`,
  )

  /**
   * <zh/> 网格重挂载滚动恢复——gridInstanceKey 翻转（span 表惰性进入/退出动态网格等残余场景）会强制
   * <zh/> ElTableV2 整体重挂载，新实例 scrollTop 双侧归零；reconcile 只能修"失步"，
   * <zh/> 修不了"双侧归零"，翻转瞬间长列表会跳顶。此处翻转前记录滚动位置，
   * <zh/> 重挂载完成后经 EP scrollTo API 恢复（EP 为程序化滚动，直接写 DOM scrollLeft 不更新内部状态）。
   * <en/> Grid-remount scroll restore — a gridInstanceKey flip (fixed↔dynamic on first expand /
   * <en/> collapse-to-none) force-remounts ElTableV2, zeroing scrollTop on both sides of the new
   * <en/> instance; reconcile only repairs "desync", not "both-sides-zeroed", so a long list jumps
   * <en/> to the top on first expand. Record the scroll position before the flip and restore it via
   * <en/> EP's scrollTo API after the remount settles (EP scrolls programmatically; writing DOM
   * <en/> scrollLeft directly never updates its internal state).
   */
  watch(gridInstanceKey, async (_next, prev) => {
    if (prev == null)
      return
    const savedTop = currentScrollTop.value
    const savedLeft = currentScrollLeft.value
    if (savedTop <= 0 && savedLeft <= 0)
      return
    await nextTick()
    v2ScrollApi.scrollTo({ scrollLeft: savedLeft, scrollTop: savedTop })
  })

  /**
   * <zh/> span × 动态行高互斥告警——append 插槽/展开行触发 dynamic 网格后，
   * <zh/> EP `.is-dynamic .el-table-v2__row { overflow: hidden }` 会裁切 rowspan
   * <zh/> 向下延伸的 origin 格，且 rowspan*rowHeight 总高在实测行高模式下失真。
   * <zh/> 默认 `spanDynamicMode:'warn-only'` 以 dev 告警声明该组合不保证视觉正确；
   * <zh/> `'rfc-overlay'` 时 origin 格走绝对定位覆盖层，不再告警。
   * <en/> Span × dynamic-row-height co-existence warning — once the append slot / expanded rows
   * <en/> flip the grid to dynamic, EP's `.is-dynamic .el-table-v2__row { overflow: hidden }`
   * <en/> clips the rowspan-extended origin cell, and rowspan*rowHeight totals distort under
   * <en/> measured heights. Default `spanDynamicMode:'warn-only'` declares the combination
   * <en/> unsupported via a dev warning; `'rfc-overlay'` takes the absolute overlay path and stays silent.
   */
  watch(
    [() => props.spanEnabled, gridInstanceKey, () => props.spanDynamicMode],
    ([spanEnabled, key, spanDynamicMode]) => {
      if (spanDynamicMode === 'rfc-overlay')
        return
      if (isDev && spanEnabled && key === 'dynamic') {
        devWarn(
          '[AdvTable] cell span (spanEnabled) combined with dynamic row heights (append slot / expanded detail rows) '
          + 'is visually unsupported in virtual mode: EP clips rowspan-extended cells in dynamic grids. '
          + 'Avoid enabling span together with expandable rows or an append slot.',
        )
      }
    },
    { immediate: true },
  )

  /**
   * <zh/> EP 垂直滚动条预留宽度（px，ElTableV2 默认 6）——汇总行赖以对齐的关键尺寸。
   * <zh/> ElTableV2 内部按 `bodyWidth = width - vScrollbarSize` 计算表头行宽度（无论是否真的出现垂直
   * <zh/> 滚动条），而 footer（汇总行所在容器）与 root 等宽。若汇总行按 root 宽度布局，两者可用宽度相差
   * <zh/> 这 6px：列无拉伸时无关紧要，一旦出现 flexGrow/minWidth 参与分配的列，偏差就在行内向右累积。
   * <zh/> 显式同步同一数值给 EP，并以 CSS 变量在汇总行右侧留出等量轨道，保证两行可用宽度严格相等。
   * <en/> EP's reserved vertical scrollbar width (px, ElTableV2 default 6) — the key metric the summary
   * <en/> row aligns to. ElTableV2 sizes the header row with `bodyWidth = width - vScrollbarSize` whether
   * <en/> or not a vertical scrollbar actually appears, while the footer (which hosts the summary row)
   * <en/> spans the full root width. Laying out the summary at root width leaves the two rows 6px apart:
   * <en/> harmless when no column stretches, but the drift accumulates rightward as soon as any column
   * <en/> takes part in distribution via flexGrow/minWidth. Passing the same number down to EP and
   * <en/> reserving an identical gutter on the summary keeps both rows' available width exactly equal.
   */
  const EP_DEFAULT_V_SCROLLBAR_SIZE = 6

  const vScrollbarSize = computed(() => {
    const raw = props.vScrollbarSize
    const n = typeof raw === 'number' ? raw : EP_DEFAULT_V_SCROLLBAR_SIZE
    return Number.isFinite(n) ? Math.max(0, n) : EP_DEFAULT_V_SCROLLBAR_SIZE
  })

  /** <zh/> 汇总行的滚动条预留量（CSS 变量），与传给 EP 的 vScrollbarSize 同源 | <en/> Summary-row scrollbar gutter (CSS var), same source as the vScrollbarSize passed to EP */
  const summaryGutterVar = computed<Record<string, string>>(() => ({
    '--adv-table-v2-summary-scrollbar-gutter': `${vScrollbarSize.value}px`,
  }))

  return {
    numericHeight,
    explicitHeightPx,
    effectiveEstimatedRowHeight,
    gridInstanceKey,
    vScrollbarSize,
    summaryGutterVar,
    requestRowRemeasure,
  }
}
