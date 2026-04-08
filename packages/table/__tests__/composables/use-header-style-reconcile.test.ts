import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useHeaderStyleReconcile } from '../../src/composables/rendering/use-header-style-reconcile'
import { healHeaderSection } from '../../src/utils/header-style-heal'

/**
 * <zh/> 最小 DOM 适配器桩——只提供表头自愈需要的四个选择器
 * <en/> Minimal DOM adapter stub — only the four selectors header healing needs
 */
function stubDom() {
  return {
    getHeaderSelector: () => '.test-header',
    getHeaderRowSelector: () => '.test-header-row',
    getHeaderCellSelector: () => '.test-header-cell',
    getBodySelector: () => '.test-body',
    getRowSelector: () => '.test-row',
  } as any
}

/**
 * <zh/> 创建固定实测尺寸的 div（happy-dom 无布局引擎，offset* 恒为 0，需显式覆盖）
 * <en/> Create a div with fixed measured sizes (happy-dom has no layout engine, offset* is always 0, so override explicitly)
 */
function sizedDiv(width: number, height = 40, tag = 'div'): HTMLElement {
  const el = document.createElement(tag)
  Object.defineProperty(el, 'offsetWidth', { value: width, configurable: true })
  Object.defineProperty(el, 'offsetHeight', { value: height, configurable: true })
  return el
}

function flushRaf(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'undefined') {
      setTimeout(resolve, 20)
      return
    }
    requestAnimationFrame(() => {
      setTimeout(resolve, 0)
    })
  })
}

describe('useHeaderStyleReconcile scheduling', () => {
  it('does not touch the root when skipped', async () => {
    const rootEl = vi.fn(() => null)
    const api = useHeaderStyleReconcile({
      rootEl,
      dom: stubDom(),
      isVirtual: () => true,
      columnsVersion: () => 'a:150',
      data: () => [],
      measuredWidth: ref(800),
      measuredHeight: ref(400),
      skipWatchdog: () => true,
    })
    api.scheduleReconcile()
    await flushRaf()
    await flushRaf()
    expect(rootEl).not.toHaveBeenCalled()
  })

  it('reads the root when not skipped and no-ops on empty DOM', async () => {
    const rootEl = vi.fn(() => null)
    const api = useHeaderStyleReconcile({
      rootEl,
      dom: stubDom(),
      isVirtual: () => true,
      columnsVersion: () => 'a:150',
      data: () => [],
      measuredWidth: ref(800),
      measuredHeight: ref(400),
      skipWatchdog: () => false,
    })
    api.scheduleReconcile()
    await flushRaf()
    await flushRaf()
    expect(rootEl).toHaveBeenCalled()
  })
})

describe('healHeaderSection', () => {
  /**
   * <zh/> 搭建单分区 DOM：header 容器（2 行：分组行 + 叶子行）+ 同级 body 首行。
   * <zh/> nestHeader=true 时 header 再包一层无 body 的 wrapper，还原真实 EP 结构
   * <zh/> （header-wrapper 只包表头），覆盖分区上溯逻辑。
   * <en/> Build a single-section DOM: header container (2 rows: group row + leaf row) + sibling first body row.
   * <en/> With nestHeader=true the header gets an extra body-less wrapper, mirroring the real EP
   * <en/> structure (header-wrapper holds the header only) to cover section resolution upwards.
   */
  function buildSection(opts: { virtual: boolean, leafHeaderWidths: number[], bodyWidths: number[], groupWidth?: number, nestHeader?: boolean }) {
    const root = document.createElement('div')
    const section = document.createElement('div')
    const header = document.createElement('div')
    header.className = 'test-header'
    const groupRow = document.createElement('div')
    groupRow.className = 'test-header-row'
    Object.defineProperty(groupRow, 'offsetHeight', { value: 50, configurable: true })
    const leafRow = document.createElement('div')
    leafRow.className = 'test-header-row'
    Object.defineProperty(leafRow, 'offsetHeight', { value: 50, configurable: true })
    const body = document.createElement('div')
    body.className = 'test-body'
    const bodyRow = document.createElement('div')
    bodyRow.className = 'test-row'

    let groupCell: HTMLElement | null = null
    if (opts.groupWidth !== undefined) {
      groupCell = sizedDiv(opts.groupWidth)
      if (opts.virtual)
        groupCell.className = 'adv-table__v2-header-cell--framed'
      else
        (groupCell as HTMLTableCellElement).colSpan = opts.leafHeaderWidths.length
      groupRow.appendChild(groupCell)
    }
    const leafCells = opts.leafHeaderWidths.map((w) => {
      const cell = sizedDiv(w)
      if (opts.virtual)
        cell.className = 'adv-table__header-cell adv-table__v2-header-cell adv-table__v2-header-cell--leaf-span'
      leafRow.appendChild(cell)
      return cell
    })
    for (const w of opts.bodyWidths)
      bodyRow.appendChild(sizedDiv(w))

    header.append(groupRow, leafRow)
    body.appendChild(bodyRow)
    if (opts.nestHeader) {
      const wrapper = document.createElement('div')
      wrapper.appendChild(header)
      section.append(wrapper, body)
    }
    else {
      section.append(header, body)
    }
    root.appendChild(section)
    document.body.appendChild(root)
    return { root, header, groupCell, leafCells }
  }

  it('aligns leaf header widths to body widths in virtual mode', () => {
    const { root, header, leafCells } = buildSection({ virtual: true, leafHeaderWidths: [100, 100], bodyWidths: [120, 100] })
    try {
      healHeaderSection(root, header, stubDom(), true)
      expect(leafCells[0]!.style.width).toBe('120px')
      expect(leafCells[1]!.style.width).toBe('')
    }
    finally {
      root.remove()
    }
  })

  it('skips width alignment when leaf and body counts differ', () => {
    const { root, header, leafCells } = buildSection({ virtual: true, leafHeaderWidths: [100, 100], bodyWidths: [100] })
    try {
      healHeaderSection(root, header, stubDom(), true)
      expect(leafCells[0]!.style.width).toBe('')
      expect(leafCells[1]!.style.width).toBe('')
    }
    finally {
      root.remove()
    }
  })

  it('backfills the placeholder class on bare filler divs in virtual mode', () => {
    const { root, header } = buildSection({ virtual: true, leafHeaderWidths: [100], bodyWidths: [100] })
    const bare = document.createElement('div')
    Object.defineProperty(bare, 'offsetWidth', { value: 100, configurable: true })
    header.querySelector('.test-header-row')!.appendChild(bare)
    try {
      healHeaderSection(root, header, stubDom(), true)
      expect(bare.classList.contains('adv-table__v2-header-cell--placeholder')).toBe(true)
    }
    finally {
      root.remove()
    }
  })

  it('re-sums a virtual group header from healed leaf widths', () => {
    // <zh/> 真实失步量级（EP 滚动条槽位重分配约 4px）：分组头 216 vs 叶子和 220，跨度假设唯一命中 N=2，回写为 220
    // <en/> Realistic drift (EP scrollbar-gutter redistribution ≈4px): group 216 vs leaves sum 220, the span hypothesis uniquely hits N=2, rewritten to 220
    const { root, header, groupCell } = buildSection({ virtual: true, leafHeaderWidths: [120, 100], bodyWidths: [120, 100], groupWidth: 216 })
    try {
      healHeaderSection(root, header, stubDom(), true)
      expect(groupCell!.style.width).toBe('220px')
    }
    finally {
      root.remove()
    }
  })

  it('resolves the section upwards through a body-less header wrapper (real EP nesting)', () => {
    // <zh/> 真实 EP 结构：header 直属父级 header-wrapper 不含 body，上溯到 section 才有；
    // <zh/> 若实现只取直属父级，此处 bodyWidths 为空、自愈静默跳过
    // <en/> Real EP nesting: the header's direct parent (header-wrapper) holds no body, the section above does;
    // <en/> a direct-parent-only implementation finds no body widths here and silently skips healing
    const { root, header, leafCells } = buildSection({ virtual: true, leafHeaderWidths: [100, 100], bodyWidths: [120, 100], nestHeader: true })
    try {
      healHeaderSection(root, header, stubDom(), true)
      expect(leafCells[0]!.style.width).toBe('120px')
      expect(leafCells[1]!.style.width).toBe('')
    }
    finally {
      root.remove()
    }
  })

  it('never backfills built-in EP header cells (regionDepth<=1 passthrough)', () => {
    // <zh/> 无分组表头的行直接透传 EP 原生格：已有主题样式，打上自有类会改写其 padding/min-height
    // <en/> Group-less header rows pass EP native cells through: already themed, owned classes would rewrite their padding/min-height
    const root = document.createElement('div')
    const section = document.createElement('div')
    const header = document.createElement('div')
    header.className = 'test-header'
    const row = document.createElement('div')
    row.className = 'test-header-row'
    Object.defineProperty(row, 'offsetHeight', { value: 50, configurable: true })
    const native = sizedDiv(100)
    native.className = 'test-header-cell'
    row.appendChild(native)
    const body = document.createElement('div')
    body.className = 'test-body'
    const bodyRow = document.createElement('div')
    bodyRow.className = 'test-row'
    bodyRow.appendChild(sizedDiv(100))
    body.appendChild(bodyRow)
    header.appendChild(row)
    section.append(header, body)
    root.appendChild(section)
    document.body.appendChild(root)
    try {
      healHeaderSection(root, header, stubDom(), true)
      expect(native.classList.contains('adv-table__v2-header-cell--placeholder')).toBe(false)
      expect(native.style.width).toBe('')
    }
    finally {
      root.remove()
    }
  })

  it('never writes group widths in default mode (EP layout owns them)', () => {
    const tableCell = document.createElement('th')
    Object.defineProperty(tableCell, 'offsetWidth', { value: 200, configurable: true })
    Object.defineProperty(tableCell, 'offsetHeight', { value: 50, configurable: true })
    tableCell.colSpan = 2
    const { root, header } = buildSection({ virtual: false, leafHeaderWidths: [120, 100], bodyWidths: [120, 100] })
    header.querySelector('.test-header-row')!.appendChild(tableCell)
    try {
      healHeaderSection(root, header, stubDom(), false)
      expect(tableCell.style.width).toBe('')
    }
    finally {
      root.remove()
    }
  })
})
