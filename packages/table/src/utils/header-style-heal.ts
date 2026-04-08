/**
 * @file header-style-heal.ts
 * @description
 * <zh/> 合并表头样式自愈的 DOM 执行层——单表头区的检测与回写（无响应式状态、无生命周期）。
 *
 * <zh/> 从 `composables/rendering/use-header-style-reconcile.ts` 抽出：编排（触发源 +
 * <zh/> 看门狗 + 清理）与执行（DOM 读/写）分离，与本库既有的
 * <zh/> `utils/virtual-scroll-sync.ts`（自滚动协调域抽出）保持同一拆分口径，
 * <zh/> 且使编排文件满足 `check:hook-size`（300 行软门限）。
 *
 * <en/> DOM execution layer for merged-header style healing — detect-and-rewrite for one
 * <en/> header section (no reactive state, no lifecycle).
 *
 * <en/> Extracted from `composables/rendering/use-header-style-reconcile.ts`: orchestration
 * <en/> (triggers + watchdog + cleanup) stays separate from execution (DOM reads/writes),
 * <en/> the same split caliber as `utils/virtual-scroll-sync.ts` (extracted from the scroll
 * <en/> reconcile domain), keeping the orchestration file under `check:hook-size` (300-line soft gate).
 */
import type { IRendererDomAdapter } from '../components/renderer-core/dom-adapter'
import { devWarn } from './dev-warn'
import { isDev } from './env'
import { detectMergedHeaderDesync, HEADER_STYLE_DESYNC_TOLERANCE } from './merged-header-sync'

/**
 * <zh/> 自有占位类（v2-header.tsx 实际渲染口径，缺失即回填） | <en/> Owned placeholder class (the caliber v2-header.tsx renders; backfilled when missing)
 */
export const HEADER_PLACEHOLDER_CLASS = 'adv-table__v2-header-cell--placeholder'

/**
 * <zh/> 跨度映射容差（px）——真实失步量级来自 EP 滚动条槽位重分配（≤6px），8px 窗覆盖之；
 * <zh/> 远小于最小列宽之半（50/2=25），叶子和严格递增步长 ≥50，故容差窗内至多一个 N 命中。
 * <en/> Span-mapping tolerance (px) — real drift comes from EP scrollbar-gutter redistribution (≤6px), covered by an 8px window;
 * <en/> far below half the minimum column width (50/2=25) while leaf sums strictly increase in steps ≥50, so at most one N hits within tolerance.
 */
export const HEADER_SPAN_MAP_TOLERANCE = 8

/** <zh/> 读取元素实测宽（offsetWidth 回退 rect，隐藏元素返回 0） | <en/> Read measured element width (offsetWidth with rect fallback, 0 when hidden) */
function measuredCellWidth(el: HTMLElement): number {
  const w = el.offsetWidth
  if (w > 0)
    return w
  const rect = el.getBoundingClientRect()
  return rect.width > 0 ? rect.width : 0
}

/** <zh/> 读取元素实测高（offsetHeight 回退 rect，隐藏元素返回 0） | <en/> Read measured element height (offsetHeight with rect fallback, 0 when hidden) */
function measuredCellHeight(el: HTMLElement): number {
  const h = el.offsetHeight
  if (h > 0)
    return h
  const rect = el.getBoundingClientRect()
  return rect.height > 0 ? rect.height : 0
}

/**
 * <zh/> 向上解析表头区——首个同时包含表体的祖先即分区。
 * <zh/> 直接父级不可靠：虚拟模式 header 容器的直接父级是 header-wrapper（只包表头、不含表体），
 * <zh/> 固定分区（left/main/right）与 default 整表各在更高层级含表体。逐层上溯、rootEl 兜底。
 * <en/> Resolve the header section upwards — the first ancestor containing a body is the section.
 * <en/> The direct parent is unreliable: in virtual mode it is the header-wrapper (header only, no body);
 * <en/> fixed sections (left/main/right) and the default whole table hold the body higher up. Walk up, rootEl as fallback.
 */
function resolveSectionRoot(
  headerContainer: HTMLElement,
  rootEl: HTMLElement | null,
  bodySelector: string,
): HTMLElement | null {
  let node: HTMLElement | null = headerContainer
  while (node) {
    let found = false
    try {
      found = node.querySelector(bodySelector) != null
    }
    catch {
      found = false
    }
    if (found)
      return node
    if (node === rootEl)
      break
    node = node.parentElement
  }
  return rootEl
}

/**
 * <zh/> 检测并自愈一个表头区（header 容器 + 其同级表体首行）。
 * <zh/> 叶子行与体格 1:1 对齐（数量相等时）；分组行按 colspan/占位/跨度假设回加。
 * <en/> Detect and heal one header section (a header container plus its sibling first body row).
 * <en/> The leaf row aligns 1:1 with body cells (when counts match); group rows re-sum via colspan/placeholder/span hypothesis.
 *
 * @param rootEl - <zh/> 表格根元素（分区回退作用域） | <en/> table root element (section fallback scope)
 * @param headerContainer - <zh/> 表头容器（经 DOM 适配器选择器命中） | <en/> header container (hit via the DOM adapter selector)
 * @param dom - <zh/> 当前模式 DOM 适配器 | <en/> current-mode DOM adapter
 * @param healPlaceholders - <zh/> 是否自愈分组头占位（分组头宽度归我们所有时为 true，可直接写） | <en/> whether to heal group-header placeholders (true when group widths are owned and directly writable)
 */
export function healHeaderSection(
  rootEl: HTMLElement | null,
  headerContainer: HTMLElement,
  dom: IRendererDomAdapter,
  healPlaceholders: boolean,
): void {
  const headerRowSelector = dom.getHeaderRowSelector()
  const bodySelector = dom.getBodySelector()
  const rowSelector = dom.getRowSelector()
  // <zh/> EP 原生表头格选择器——回填时排除（原生格已有 EP 主题样式，打上自有类会改写其 padding/min-height）
  // <en/> Built-in EP header-cell selector — excluded from backfill (native cells already carry the EP theme; owned classes would rewrite their padding/min-height)
  const nativeCellSelector = dom.getHeaderCellSelector()
  const sectionRoot = resolveSectionRoot(headerContainer, rootEl, bodySelector)
  if (!sectionRoot)
    return
  const rows = Array.from(headerContainer.querySelectorAll<HTMLElement>(headerRowSelector))
    .filter(el => measuredCellHeight(el) > 0)
  if (rows.length === 0)
    return
  const bodyScope = sectionRoot.querySelector<HTMLElement>(bodySelector) ?? sectionRoot
  const bodyRow = Array.from(bodyScope.querySelectorAll<HTMLElement>(rowSelector))
    .find(r => r.children.length > 0)
  const bodyCells = bodyRow ? Array.from(bodyRow.children) as HTMLElement[] : []
  const bodyWidths = bodyCells.map(measuredCellWidth).filter(w => w > 0)

  // <zh/> 虚拟模式缺失类回填：EP 重建/复活后出现的裸填充 div 补上自有占位类（底色口径）。
  // <zh/> EP 原生格（regionDepth<=1 时 CustomHeader 直接透传 cells）必须排除——它们已有主题样式。
  // <en/> Virtual-mode missing-class backfill: bare filler divs (after EP rebuild/reactivation) get the owned placeholder class (background caliber).
  // <en/> Built-in EP cells (CustomHeader passes cells through when regionDepth<=1) must be excluded — they already carry the theme.
  if (healPlaceholders) {
    for (const row of rows) {
      for (const cell of Array.from(row.children) as HTMLElement[]) {
        if (cell.tagName === 'DIV'
          && !cell.classList.contains('adv-table__v2-header-cell')
          && !cell.classList.contains('adv-table__v2-header-cell--framed')
          && !cell.matches(nativeCellSelector)) {
          cell.classList.add('adv-table__header-cell', 'adv-table__v2-header-cell', HEADER_PLACEHOLDER_CLASS)
          if (isDev)
            devWarn('[AdvTable] merged-header style healed: backfilled placeholder class on a bare header filler.')
        }
      }
    }
  }

  if (bodyWidths.length === 0)
    return
  // <zh/> 叶子行 = 自末行向上首个"格数与体格相等、且含实测高度格"的行——固定分区末行可能是
  // <zh/> height:0 填充行（实格在首行），按末行恒取会错配；分组行因子格缺失（null 跳过）天然不等，不会误命中。
  // <en/> The leaf row is the last row (walking upwards) whose cell count matches the body and which holds measured-height cells —
  // <en/> a fixed section's last row may be a height:0 filler row (real cells live in the first row), so last-row-only would mismatch;
  // <en/> group rows never match thanks to their null-skipped slots.
  const leafRow = [...rows].reverse().find((row) => {
    const cells = Array.from(row.children) as HTMLElement[]
    return cells.length === bodyWidths.length
      && cells.length > 0
      && cells.some(cell => measuredCellHeight(cell) > 0)
  })
  if (!leafRow)
    return
  const leafCells = Array.from(leafRow.children) as HTMLElement[]
  const leafWidths = leafCells.map(measuredCellWidth)
  const miss = detectMergedHeaderDesync(
    leafWidths.map((headerWidth, i) => ({ headerWidth, bodyWidth: bodyWidths[i]! })),
    HEADER_STYLE_DESYNC_TOLERANCE,
  )
  for (const i of miss) {
    leafCells[i]!.style.width = `${bodyWidths[i]}px`
    if (isDev)
      devWarn(`[AdvTable] merged-header style healed: leaf header #${i} width ${leafWidths[i]}px → body ${bodyWidths[i]}px.`)
  }
  // <zh/> 分组行回加：以自愈后的叶子实测为基准；default 按 colspan 精确映射，
  // <zh/> 虚拟按占位(=1)/跨度假设（唯一命中才写，多义/无解跳过，宁可漏检不写错）。
  // <en/> Group-row re-sum against the healed leaf measurements; default maps exactly via colspan,
  // <en/> virtual via placeholder(=1)/span hypothesis (write only on a unique hit; skip on ambiguous/no match — a miss beats a wrong write).
  const healedLeafWidths = leafCells.map(measuredCellWidth)
  for (const row of rows) {
    if (row === leafRow)
      continue
    const groupCells = Array.from(row.children) as HTMLElement[]
    let cursor = 0
    for (const cell of groupCells) {
      if (cursor >= healedLeafWidths.length)
        break
      const colSpan = (cell as HTMLTableCellElement).colSpan ?? 1
      if (!healPlaceholders && colSpan > 1) {
        if (Math.abs(measuredCellWidth(cell) - healedLeafWidths.slice(cursor, cursor + colSpan).reduce((a, b) => a + b, 0)) > HEADER_STYLE_DESYNC_TOLERANCE && isDev) {
          devWarn(
            `[AdvTable] merged-header desync detected: default group header spans ${colSpan} cols `
            + `— owned by EP table layout, not auto-written.`,
          )
        }
        cursor += colSpan
        continue
      }
      if (healPlaceholders && cell.classList.contains(HEADER_PLACEHOLDER_CLASS)) {
        if (Math.abs(measuredCellWidth(cell) - healedLeafWidths[cursor]!) > HEADER_STYLE_DESYNC_TOLERANCE)
          cell.style.width = `${healedLeafWidths[cursor]}px`
        cursor += 1
        continue
      }
      if (!healPlaceholders) {
        cursor += 1
        continue
      }
      // <zh/> 虚拟分组格：跨度假设——映射用宽窗（覆盖真实失步量级），回写用严容差；
      // <zh/> 叶子和严格递增步长 ≥ 最小列宽，映射窗内至多一个 N 命中，多义/无解跳过
      // <en/> Virtual group cell: span hypothesis — wide window for mapping (covers real drift), strict tolerance for rewriting;
      // <en/> leaf sums strictly increase in steps ≥ the minimum column width, so at most one N hits; skip on ambiguous/no match
      const cellWidth = measuredCellWidth(cell)
      let hit = -1
      let acc = 0
      for (let n = 1; cursor + n <= healedLeafWidths.length; n++) {
        acc += healedLeafWidths[cursor + n - 1]!
        if (Math.abs(cellWidth - acc) <= HEADER_SPAN_MAP_TOLERANCE) {
          hit = n
          break
        }
        if (acc - cellWidth > HEADER_SPAN_MAP_TOLERANCE)
          break
      }
      if (hit < 0)
        break
      const expected = healedLeafWidths.slice(cursor, cursor + hit).reduce((a, b) => a + b, 0)
      if (Math.abs(cellWidth - expected) > HEADER_STYLE_DESYNC_TOLERANCE) {
        cell.style.width = `${expected}px`
        if (isDev)
          devWarn(`[AdvTable] merged-header style healed: group header width → leaves sum ${expected}px (span ${hit}).`)
      }
      cursor += hit
    }
  }
}
