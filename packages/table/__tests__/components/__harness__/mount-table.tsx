import type { VueWrapper } from '@vue/test-utils'
/**
 * @file mount-table.tsx
 * @description
 * <zh/> 组件级对等测试挂载工厂——以同一份代码把完整 AdvTable 挂载为 default/virtual 两种模式。
 *
 * <zh/> **环境适配（happy-dom）**：
 * <zh/> 1. 异步渲染器 chunk 预加载 + 宏任务轮询——defineAsyncComponent 的动态 import
 * <zh/>    在 vite-node 下需要宏任务推进，且首次编译耗时不定（300ms~2s+），固定 sleep 会竞态；
 * <zh/>    以行键锚点出现为"就绪"信号做条件轮询。
 * <zh/> 2. `@vueuse/core` 的 useElementSize 由 layout-mock 固定为 600×320 视口，
 * <zh/>    否则 ElAutoResizer 测量恒为 0，虚拟模式表头/行被尺寸门控抑制。
 * <zh/> 3. $router stub——URL 状态同步需要。
 *
 * <en/> Component-level parity mount factory — mounts the full AdvTable as default/virtual modes
 * <en/> from the same code path.
 *
 * <en/> **Environment adaptations (happy-dom)**:
 * <en/> 1. Async renderer chunk preload + macrotask polling — defineAsyncComponent's dynamic
 * <en/>    import needs macrotasks under vite-node and first-run compile time varies; poll for
 * <en/>    the row-key anchor as a deterministic "ready" signal.
 * <en/> 2. useElementSize is pinned to a 600×320 viewport via __harness__/layout-mock,
 * <en/>    otherwise ElAutoResizer measures 0 and virtual headers/rows are size-gated off.
 * <en/> 3. $router stub — URL state sync requires it.
 */
import type { Ref } from 'vue'
import type { AdvColumn } from '../../../src/types'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import AdvTable from '../../../src/AdvTable.vue'
import '../__harness__/layout-mock'

// <zh/> 预加载异步渲染器模块 | <en/> Pre-load async renderer modules
import ('../../../src/components/table-renderer/TableRenderer.vue')
import('../../../src/components/table-virtual-renderer/TableVirtualRenderer.vue')

export type TableMode = 'default' | 'virtual'

/** <zh/> 对等矩阵标准夹具 | <en/> Standard parity fixture */
export function standardColumns(): AdvColumn[] {
  return [
    { prop: 'id', label: 'ID', hidden: false },
    { prop: 'name', label: '名称', sortable: true, hidden: false },
  ] as unknown as AdvColumn[]
}

export function standardRows(): any[] {
  return [
    { id: 'r3', name: 'Carol' },
    { id: 'r1', name: 'Alice' },
    { id: 'r2', name: 'Bob' },
  ]
}

export interface MountTableOptions {
  mode?: TableMode
  columns?: AdvColumn[]
  data?: any[]
  props?: Record<string, any>
}

export interface MountedTable {
  wrapper: VueWrapper
  mode: TableMode
  /** <zh/> 响应式列源——测试内可直接改值驱动更新 | <en/> reactive columns source — mutate in tests to drive updates */
  columns: Ref<AdvColumn[]>
}

export async function mountTable(opts: MountTableOptions = {}): Promise<MountedTable> {
  const columns = ref(opts.columns ?? standardColumns())
  const data = opts.data ?? standardRows()
  // <zh/> 默认 rowConfig.rowKey='id'——未配置时库生成 nanoid 键，破坏基于键的定位断言
  // <en/> default rowConfig.rowKey='id' — without it the lib generates nanoid keys, breaking key-based locators
  const mergedProps = { rowConfig: { rowKey: 'id' }, ...(opts.props ?? {}) }

  const wrapper = mount(() => (
    <AdvTable
      mode={opts.mode}
      columns={columns.value}
      data={data}
      {...mergedProps}
    />
  ), {
    global: {
      config: {
        globalProperties: {
          $router: {
            query: {},
          },
        },
      } as any,
    },
  })

  // <zh/> 条件轮询：以行键锚点出现为就绪信号；内部交替宏任务/微任务推进动态 import 与 patch
  // <en/> Conditional polling: row-key anchor as ready signal; alternate macro/microtasks
  const deadline = Date.now() + 15_000
  let ready = false
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 25))
    await nextTick()
    if (wrapper.find('[data-adv-table-row-key]').exists()) {
      ready = true
      break
    }
  }
  /**
   * <zh/> 就绪信号未出现时**直接抛夹具错误**（静默返回会让每个用例各等 30s 超时，
   * <zh/> 超时（browser project 空白截图即由此而来），真正的失败原因被埋在 timeout 里。
   * <en/> throw a fixture error when the ready anchor never appears — previously it returned
   * <en/> silently and every case burned its 30s timeout (the blank browser screenshots came from
   * <en/> here), burying the real cause inside a timeout.
   */
  if (!ready) {
    throw new Error(
      `[mount-table] fixture not ready after 15s: no [data-adv-table-row-key] anchor in mode="${opts.mode ?? 'default'}". `
      + 'Check the renderer chunk import, the v-loading directive registration and the container size gating.',
    )
  }
  // 就绪后补两拍，让列配置与装饰属性稳定 | two extra ticks to settle decorations
  await nextTick()
  await nextTick()

  return { wrapper, mode: opts.mode ?? 'default', columns }
}
