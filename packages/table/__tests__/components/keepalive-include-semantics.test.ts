import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, KeepAlive, nextTick, ref, Transition } from 'vue'

/**
 * <zh/> 隔离验证 Vue 3.5 的 `KeepAlive` + `Transition` 组合契约——`table.vue` 侧面板保留语义
 * <zh/> （的 `sidePanelDestroyOnClose`）完全建立在这两条机制上，故先钉死机制再依赖它：
 * <zh/> 1. `include=undefined` → 关闭只 deactivate，**不** unmount；
 * <zh/> 2. `include=[]`（空数组在 `matches()` 里恒 false）→ KeepAlive 清掉
 * <zh/>    `COMPONENT_SHOULD_KEEP_ALIVE` 直接透传，关闭即**真实** unmount；
 * <zh/> 3. 嵌套顺序必须是 `<Transition><KeepAlive>`——KeepAlive 只缓存**直接子节点**，
 * <zh/>    反过来写则 v-if 翻转发生在 Transition 内部，保留语义静默失效。
 * <en/> Isolates the Vue 3.5 `KeepAlive` + `Transition` contracts that `table.vue`'s panel-retention
 * <en/> semantics (`sidePanelDestroyOnClose`) rest on — pin the mechanism before relying on it:
 * <en/> 1. `include=undefined` → closing only deactivates, no unmount;
 * <en/> 2. `include=[]` (always falsy under `matches()`) → KeepAlive drops SHOULD_KEEP_ALIVE and passes
 * <en/>    the child through, so closing is a real unmount;
 * <en/> 3. the nesting must be `<Transition><KeepAlive>` — KeepAlive caches only its *direct* child, so
 * <en/>    the flipped order makes the v-if flip happen inside Transition and retention silently dies.
 */
describe('keep-alive include semantics (mechanism contract)', () => {
  let events: string[] = []

  const Panel = defineComponent({
    name: 'Panel',
    setup() {
      const count = ref(0)
      return { count }
    },
    activated() {
      events.push('activated')
    },
    deactivated() {
      events.push('deactivated')
    },
    unmounted() {
      events.push('unmounted')
    },
    render() {
      return h('div', { class: 'panel' }, `count-${this.count}`)
    },
  })

  /** <zh/> 正确嵌套：Transition 包 KeepAlive，KeepAlive 的直接子节点才是被 v-if 切换的面板 | <en/> Correct nesting: Transition wraps KeepAlive, whose direct child is the toggled panel */
  function makeHost(getInclude: () => string[] | undefined) {
    return defineComponent({
      components: { Panel },
      setup() {
        const show = ref(true)
        return { show, getInclude }
      },
      render() {
        return h('div', [
          h('button', { class: 'toggle', onClick: () => (this.show = !this.show) }, 'toggle'),
          h(Transition, { name: 'fade', mode: 'out-in' }, [
            h(KeepAlive, { include: this.getInclude() }, [this.show ? h(Panel, { key: 'panel' }) : null]),
          ]),
        ])
      },
    })
  }

  /** <zh/> 错误嵌套：KeepAlive 包 Transition——KeepAlive 只看到一个恒定包装，保留语义失效 | <en/> Wrong nesting: KeepAlive wraps Transition, so it only ever sees a constant wrapper and retention dies */
  function makeHostWrongNesting(getInclude: () => string[] | undefined) {
    return defineComponent({
      components: { Panel },
      setup() {
        const show = ref(true)
        return { show, getInclude }
      },
      render() {
        return h('div', [
          h('button', { class: 'toggle', onClick: () => (this.show = !this.show) }, 'toggle'),
          h(KeepAlive, { include: this.getInclude() }, [
            h(Transition, { name: 'fade', mode: 'out-in' }, this.show ? h(Panel, { key: 'panel' }) : null),
          ]),
        ])
      },
    })
  }

  async function openClose(host: ReturnType<typeof makeHost>) {
    events = []
    const wrapper = mount(host)
    await nextTick()
    expect(wrapper.find('.panel').exists()).toBe(true)
    await wrapper.find('.toggle').trigger('click')
    await nextTick()
    await new Promise(r => setTimeout(r, 50))
    return { wrapper, snapshot: [...events] }
  }

  it('include=undefined keeps the instance alive across close (deactivate only)', async () => {
    const { wrapper, snapshot } = await openClose(makeHost(() => undefined))
    expect(snapshot).toContain('deactivated')
    expect(snapshot).not.toContain('unmounted')
    wrapper.unmount()
  })

  it('include=[] really unmounts on close', async () => {
    const { wrapper, snapshot } = await openClose(makeHost(() => []))
    expect(snapshot).toContain('unmounted')
    expect(snapshot).not.toContain('deactivated')
    wrapper.unmount()
  })

  it('reactivating a cached panel preserves its state (no remount)', async () => {
    events = []
    const wrapper = mount(makeHost(() => undefined))
    await nextTick()
    wrapper.findComponent(Panel).vm.count = 42
    await nextTick()
    expect(wrapper.find('.panel').text()).toBe('count-42')

    await wrapper.find('.toggle').trigger('click')
    await nextTick()
    await new Promise(r => setTimeout(r, 50))
    await wrapper.find('.toggle').trigger('click')
    await nextTick()
    await new Promise(r => setTimeout(r, 50))

    expect(events).toContain('activated')
    expect(events).not.toContain('unmounted')
    expect(wrapper.find('.panel').text()).toBe('count-42')
    wrapper.unmount()
  })

  it('the flipped nesting (<KeepAlive><Transition>) fails to retain — regression trap', async () => {
    // <zh/> 这条断言的作用不是测 Vue，而是把「顺序写反会静默失效」钉成可执行事实，
    // <zh/> 防止后人把 table.vue 的嵌套改回 KeepAlive 包 Transition。
    // <en/> This assertion does not test Vue so much as pin down that flipping the nesting silently
    // <en/> breaks retention, so nobody re-nests table.vue back into KeepAlive-wrapping-Transition.
    const { wrapper, snapshot } = await openClose(makeHostWrongNesting(() => undefined))
    expect(snapshot).toContain('unmounted')
    expect(snapshot).not.toContain('deactivated')
    wrapper.unmount()
  })
})
