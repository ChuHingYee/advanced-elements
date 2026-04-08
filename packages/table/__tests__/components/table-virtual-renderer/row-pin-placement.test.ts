import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import AdvTable from '../../../src/AdvTable.vue'

// Pre-load async renderer modules so defineAsyncComponent resolves immediately
import '../../../src/components/table-renderer/TableRenderer.vue'
import '../../../src/components/table-virtual-renderer/TableVirtualRenderer.vue'

/**
 * <zh/> 行固定 ag-grid 顺序（EP 原生 fixed-data）——顶部固定行渲染于 header 容器内
 * <zh/> （header 之下、body 之上），底部固定行渲染于 footer 内（body 之后、汇总之上）。
 * <en/> Row-pinning ag-grid order (EP native fixed-data) — top pinned rows render inside the
 * <en/> header container (below the header, above the body); bottom pinned rows inside the
 * <en/> footer (after the body, above the summary).
 */
interface Row { id: string, name: string }

const ROWS: Row[] = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
  { id: '3', name: 'Carol' },
  { id: '4', name: 'Dave' },
  { id: '5', name: 'Eve' },
]

const COLUMNS = [
  { key: 'name', prop: 'name', label: 'Name', width: 120 },
]

function mountPinned(extra: Record<string, any> = {}) {
  return mount(AdvTable, {
    attachTo: document.body,
    props: {
      mode: 'virtual',
      data: [...ROWS],
      columns: COLUMNS,
      rowConfig: { rowKey: 'id' },
      rowPinConfig: { topRowKeys: ['1'], bottomRowKeys: ['5'] },
      height: 320,
      ...extra,
    },
    global: {
      config: {
        globalProperties: { $router: { query: {} } },
      } as any,
    },
  })
}

/** <zh/> 条件轮询 EP 固定行出现（defineAsyncComponent 需要宏/微任务交替推进） | <en/> Poll for EP fixed rows (defineAsyncComponent needs macro/microtask alternation) */
async function waitForFixedRows(wrapper: ReturnType<typeof mount>): Promise<HTMLElement> {
  const deadline = Date.now() + 15_000
  let el = wrapper.element as HTMLElement
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 25))

    await nextTick()
    el = wrapper.element as HTMLElement
    if (el.querySelector('.el-table-v2__fixed-header-row'))
      break
  }
  await nextTick()
  await nextTick()
  return wrapper.element as HTMLElement
}

describe('virtual rowPin ag-grid placement (EP native fixed-data)', () => {
  it('renders top pinned rows inside the header container, after header rows and before the body', async () => {
    const wrapper = mountPinned()
    try {
      const el = await waitForFixedRows(wrapper)
      const fixedRows = [...el.querySelectorAll('.el-table-v2__fixed-header-row')]
      expect(fixedRows.length).toBeGreaterThanOrEqual(1)
      // <zh/> 固定行内容为被固定的行 | <en/> Fixed rows carry the pinned row content
      expect(fixedRows.some(r => r.textContent?.includes('Alice'))).toBe(true)
      // <zh/> 位于 header 容器内 | <en/> Inside the header container
      for (const r of fixedRows)
        expect(r.closest('.el-table-v2__header-wrapper')).not.toBeNull()
      // <zh/> 文档顺序以 EP 为准（body 与 header 在源码中逆序，靠 CSS 重排视觉顺序）；
      // <zh/> 关键断言收敛为容器归属 + 内容正确 + 主体无重复，header 容器内部固定行位于动态表头行之后
      // <en/> Document order follows EP (body and header are source-reversed, visually reordered by CSS);
      // <en/> pin down container ownership + content + no body duplication, with fixed rows after dynamic header rows inside the header container
      const headerWrapper = el.querySelector('.el-table-v2__header-wrapper')!
      const body = el.querySelector('.el-table-v2__body')!
      expect(headerWrapper.contains(fixedRows[0])).toBe(true)
      const dynamicRow = headerWrapper.querySelector('.el-table-v2__dynamic-header-row')!
      expect(dynamicRow.compareDocumentPosition(fixedRows[0]) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
      // <zh/> 主体数据已剔除固定行（无重复渲染） | <en/> Pinned rows excluded from the body (no duplicate rendering)
      expect(body.textContent).not.toContain('Alice')
      expect(body.textContent).toContain('Bob')
    }
    finally {
      wrapper.unmount()
    }
  })

  it('renders bottom strips inside the footer, not as layout siblings', async () => {
    const wrapper = mountPinned()
    try {
      const el = await waitForFixedRows(wrapper)
      const bottom = el.querySelector('.adv-table-v2__pin-strip--bottom')
      expect(bottom).not.toBeNull()
      // <zh/> 在 footer 容器内（body 之后） | <en/> Inside the footer container (after the body)
      expect(bottom!.closest('.el-table-v2__footer')).not.toBeNull()
      const layout = el.querySelector('.adv-table-v2__pin-layout')
      const direct = layout ? [...layout.children].find(c => c.classList.contains('adv-table-v2__pin-strip--bottom')) : undefined
      expect(direct).toBeUndefined()
      expect(bottom!.textContent).toContain('Eve')
    }
    finally {
      wrapper.unmount()
    }
  })

  it('still renders top pinned rows when the header is hidden', async () => {
    const wrapper = mountPinned({ showHeader: false })
    try {
      const el = await waitForFixedRows(wrapper)
      // <zh/> EP 按 fixedRowHeight 保留表头容器高度，固定行依然可见 | <en/> EP keeps the header container tall via fixedRowHeight; fixed rows stay visible
      const fixedRows = [...el.querySelectorAll('.el-table-v2__fixed-header-row')]
      expect(fixedRows.some(r => r.textContent?.includes('Alice'))).toBe(true)
    }
    finally {
      wrapper.unmount()
    }
  })

  it('renders per-partition fixed rows with fixed columns', async () => {
    const wrapper = mountPinned({
      columns: [
        { key: 'name', prop: 'name', label: 'Name', width: 120 },
        { key: 'age', prop: 'age', label: 'Age', width: 80, fixed: 'right' },
      ],
      data: ROWS.map(r => ({ ...r, age: 20 })),
    })
    try {
      const el = await waitForFixedRows(wrapper)
      // <zh/> 各分区各自渲染其列子集，无需外部回退 | <en/> Each partition renders its own column subset natively; no outer fallback needed
      const fixedRows = [...el.querySelectorAll('.el-table-v2__fixed-header-row')]
      expect(fixedRows.length).toBeGreaterThanOrEqual(1)
      expect(fixedRows.some(r => r.textContent?.includes('Alice'))).toBe(true)
    }
    finally {
      wrapper.unmount()
    }
  })
})
