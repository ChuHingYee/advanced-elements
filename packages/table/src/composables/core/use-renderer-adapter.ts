/**
 * @file use-renderer-adapter.ts
 * @description
 * <zh/> 渲染器适配器——将"按模式机械分派"的决策点收敛为单一对象：
 * <zh/> 1. 渲染器组件选择（按模式名穷尽索引）
 * <zh/> 2. 渲染器实例引用槽位绑定（绑定当前并清空其余）
 * <zh/> 3. 活跃渲染器引用派生
 * <zh/> 4. 当前模式能力表（caps，供 hook 做能力查询而非模式判断）
 * <zh/> 5. 当前模式 DOM 适配器（dom，Element Plus 内部类名/结构的唯一出口）
 *
 * <zh/> 新增第三种渲染模式时，仅需在此扩展槽位、组件映射、caps 与 dom，
 * <zh/> 消费方（use-renderer-integration / 各 hook / 渲染器）不再感知具体模式布尔量。
 *
 * <en/> Renderer adapter — consolidates the "mode-mechanical" decision points into one object:
 * <en/> 1. renderer component selection (exhaustively indexed by mode name)
 * <en/> 2. renderer instance slot binding (bind current, clear the rest)
 * <en/> 3. active-renderer ref derivation
 * <en/> 4. current-mode capability table (caps, for capability queries instead of mode checks)
 * <en/> 5. current-mode DOM adapter (dom, the only outlet for Element Plus internals)
 *
 * <en/> Adding a third render mode only requires extending the slots/component map, caps and dom here;
 * <en/> consumers no longer see concrete mode booleans.
 */
import type { Component, ComputedRef, MaybeRefOrGetter, ShallowRef } from 'vue'
import type { IRendererDomAdapter } from '../../components/renderer-core/dom-adapter'
import type { RendererCaps, RendererModeName } from '../../types/renderer-caps'
import type { TableRendererExpose } from '../../utils/table-drag'
import { computed } from 'vue'
import { createDefaultDomAdapter } from '../../components/renderer-core/default-dom-adapter'
import { createVirtualDomAdapter } from '../../components/renderer-core/virtual-dom-adapter'
import { RENDERER_CAPS } from '../../types/renderer-caps'

/**
 * <zh/> 渲染器适配器契约 | <en/> Renderer adapter contract
 */
export interface RendererAdapter {
  /** <zh/> 当前模式对应的渲染器组件 | <en/> Renderer component for the current mode */
  component: ComputedRef<Component>
  /**
   * <zh/> 将模板 ref 绑定到当前模式对应的槽位（其余槽位清空） | <en/> Bind a template ref into the current mode's slot (other slots cleared)
   */
  setRef: (instance: TableRendererExpose | null) => void
  /** <zh/> 当前模式的渲染器实例引用 | <en/> Active renderer instance ref */
  active: ComputedRef<TableRendererExpose | null>
  /**
   * <zh/> 当前模式的能力表——hook 应查询能力而非模式布尔量；
   * <zh/> 新增渲染模式时在此提供第三套 caps，消费方零改动。
   * <en/> Capability table for the current mode — hooks should query capabilities, not mode booleans;
   * <en/> a third renderer ships a third caps object here with zero consumer changes.
   */
  caps: ComputedRef<RendererCaps>
  /**
   * <zh/> 当前模式的 DOM 适配器——hook 与渲染器经其查询 EP 内部 DOM，
   * <zh/> 自身不得持有任何 EP 类名字符串；EP 升级只改适配实现。
   * <en/> DOM adapter for the current mode — hooks and renderers query EP internals through it and
   * <en/> never hold an EP class-name string; an EP upgrade only touches the adapter implementations.
   */
  dom: ComputedRef<IRendererDomAdapter>
  /**
   * <zh/> 行索引换算（R3）——unpinned 基准：调用方禁裸 index 跨 pin，一律经此换算。
   * <zh/> 未注入数据域换算时返回 -1/null（未知），调用方须判空处理，不得当作有效索引使用。
   * <en/> Row-index conversion (R3) — unpinned-based; callers must not carry raw indexes across pin.
   * <en/> Without an injected data-domain converter these return -1/null (unknown);
   * <en/> callers must null-check and never treat them as valid indexes.
   */
  toRenderIndex: (rowKey: string) => number
  toRowKey: (index: number) => string | null
}

export interface UseRendererAdapterOptions {
  /** <zh/> 当前渲染模式名 | <en/> Current renderer mode name */
  mode: ComputedRef<RendererModeName>
  /**
   * <zh/> EP 命名空间（默认 `el`）——DOM 适配器据此构造类名，
   * <zh/> 以 getter 传入以便 `uiConfig.namespace` 运行时变更后即时生效。
   * <en/> EP namespace (defaults to `el`) — the DOM adapters build class names from it;
   * <en/> passed as a getter so runtime `uiConfig.namespace` changes take effect immediately.
   */
  namespace: MaybeRefOrGetter<string | undefined>
  defaultComponent: Component
  virtualComponent: Component
  defaultRef: ShallowRef<TableRendererExpose | null>
  virtualRef: ShallowRef<TableRendererExpose | null>
  /**
   * <zh/> 行索引换算（数据域注入）——需要 renderRows + rowKeyFn 的调用方在此传入真实实现；
   * <zh/> 缺省为 -1/null 未知兜底。跨 pin 换算的调用方出现时，由其装配而非事后回填。
   * <en/> Row-index conversion (injected by the data domain) — callers needing renderRows +
   * <en/> rowKeyFn pass the real implementation here; defaults to the -1/null unknown
   * <en/> fallback. Assembled by the consumer when a cross-pin caller appears, never backfilled.
   */
  toRenderIndex?: (rowKey: string) => number
  toRowKey?: (index: number) => string | null
}

/**
 * <zh/> 单一模式在适配器内的完整装配——组件、实例槽位、能力表、DOM 适配器的唯一归属处。
 * <zh/> 新增第三种渲染模式时只需在 `RENDERER_MODES` 登记一项，
 * <zh/> component / active / caps / dom / setRef 均自动生效，无需改动任何分派逻辑。
 * <en/> Complete per-mode assembly inside the adapter — the single home of component, instance slot,
 * <en/> capability table and DOM adapter. Adding a third render mode means registering one entry in
 * <en/> `RENDERER_MODES`; component / active / caps / dom / setRef all follow automatically.
 */
interface RendererModeEntry {
  /** <zh/> 该模式的渲染器组件 | <en/> Renderer component for this mode */
  component: Component
  /** <zh/> 该模式的实例槽位 | <en/> Instance slot for this mode */
  ref: ShallowRef<TableRendererExpose | null>
  /** <zh/> 该模式的能力表 | <en/> Capability table for this mode */
  caps: RendererCaps
  /** <zh/> 该模式的 DOM 适配器 | <en/> DOM adapter for this mode */
  dom: IRendererDomAdapter
}

/**
 * <zh/> 创建渲染器适配器 | <en/> Create the renderer adapter
 */
export function createRendererAdapter(options: UseRendererAdapterOptions): RendererAdapter {
  const { mode, namespace, defaultComponent, virtualComponent, defaultRef, virtualRef } = options

  /**
   * <zh/> 两个 DOM 适配器实例在组件生命周期内稳定（命名空间经 getter 惰性读取），
   * <zh/> 故 `dom` 仅在模式切换时切换引用，不产生每次求值的新对象。
   * <en/> Both DOM adapter instances are stable for the component's lifetime (the namespace is read lazily
   * <en/> through the getter), so `dom` only switches reference on a mode change and never allocates
   * <en/> per evaluation.
   */
  const modes: Record<RendererModeName, RendererModeEntry> = {
    default: {
      component: defaultComponent,
      ref: defaultRef,
      caps: RENDERER_CAPS.default,
      dom: createDefaultDomAdapter(namespace),
    },
    virtual: {
      component: virtualComponent,
      ref: virtualRef,
      caps: RENDERER_CAPS.virtual,
      dom: createVirtualDomAdapter(namespace),
    },
  }

  /**
   * <zh/> 当前模式登记项——全适配器唯一的模式判别点，
   * <zh/> 其余派生量均自此读取。穷尽索引：`modes` 漏登记任一模式即编译失败。
   * <en/> Current mode entry — the adapter's only mode discriminator; every derived value reads from it.
   * <en/> Exhaustive indexing: a missing mode in `modes` fails compilation.
   */
  const entry = computed(() => modes[mode.value])

  const component = computed(() => entry.value.component)
  const active = computed(() => entry.value.ref.value)
  const caps = computed(() => entry.value.caps)
  const dom = computed(() => entry.value.dom)

  function setRef(instance: TableRendererExpose | null): void {
    // <zh/> 绑定当前模式槽位并清空其余全部——N=2 时与旧 peerRef 等价，N≥3 自动正确
    // <en/> Bind the current mode slot and clear all others — equivalent to the old peerRef at N=2, correct at N≥3
    const current = mode.value
    for (const [name, e] of Object.entries(modes) as [RendererModeName, RendererModeEntry][]) {
      e.ref.value = name === current ? instance : null
    }
  }

  // <zh/> R3 换算：优先用数据域注入的真实实现，缺省为 -1/null 未知兜底（非有效索引）
  // <en/> R3 conversion: prefers the injected data-domain implementation, defaults to the -1/null unknown fallback (not a valid index)
  const toRenderIndex = options.toRenderIndex ?? ((_rowKey: string): number => -1)
  const toRowKey = options.toRowKey ?? ((_index: number): string | null => null)

  return { component, setRef, active, caps, dom, toRenderIndex, toRowKey }
}
