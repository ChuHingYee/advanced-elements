/**
 * @vitest-environment happy-dom
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { useOverflowTooltipDelegation } from '../../src/composables/shared/use-overflow-tooltip-delegation'

/**
 * <zh/> 溢出 tooltip 委托单测——覆盖锚点解析、进入/离开与启用门控。
 * <en/> Overflow-tooltip delegation tests — anchor resolve, enter/leave and enable gate.
 */
function cellHtml(disabled = false) {
  return `<div class="adv-table__cell--overflow" data-adv-cell-row="0" data-adv-cell-col="1"${disabled ? ' data-adv-tooltip-disabled="true"' : ''}><span>text</span></div>`
}

function setupDelegation(opts: {
  resolveCell?: any
  enabled?: any
} = {}) {
  const api = { onCellEnter: vi.fn(), onCellLeave: vi.fn(), forceHide: vi.fn() }
  const container = document.createElement('div')
  container.innerHTML = cellHtml()
  document.body.appendChild(container)
  const containerRef = ref<HTMLElement | null>(container)
  const wrapper = mount(defineComponent({
    setup() {
      useOverflowTooltipDelegation({
        containerRef,
        api: api as any,
        resolveCell: opts.resolveCell ?? (() => ({ row: { id: 1 }, column: { prop: 'a' }, cellValue: 'text', disabled: false })),
        enabled: opts.enabled,
      })
      return () => h('div')
    },
  }), { attachTo: document.body })
  const unmount = () => {
    wrapper.unmount()
    container.remove()
  }
  return { api, container, unmount }
}

function overOn(el: Element, related: EventTarget | null = null) {
  const e = new MouseEvent('mouseover', { bubbles: true })
  Object.defineProperty(e, 'target', { value: el })
  Object.defineProperty(e, 'relatedTarget', { value: related })
  el.dispatchEvent(e)
}

function outOf(el: Element, related: EventTarget | null = null) {
  const e = new MouseEvent('mouseout', { bubbles: true })
  Object.defineProperty(e, 'target', { value: el })
  Object.defineProperty(e, 'relatedTarget', { value: related })
  el.dispatchEvent(e)
}

describe('useOverflowTooltipDelegation', () => {
  it('enters the cell on mouseover', () => {
    const t = setupDelegation()
    const inner = t.container.querySelector('span')!
    overOn(inner)
    expect(t.api.onCellEnter).toHaveBeenCalledTimes(1)
    const anchor = t.container.querySelector('.adv-table__cell--overflow')!
    expect(t.api.onCellEnter.mock.calls[0][0]).toBe(anchor)
    t.unmount()
  })

  it('dedups moves within the same cell', () => {
    const t = setupDelegation()
    const anchor = t.container.querySelector('.adv-table__cell--overflow')!
    const inner = t.container.querySelector('span')!
    overOn(inner)
    overOn(inner, anchor)
    expect(t.api.onCellEnter).toHaveBeenCalledTimes(1)
    t.unmount()
  })

  it('ignores mouseover outside overflow cells', () => {
    const t = setupDelegation()
    overOn(t.container)
    expect(t.api.onCellEnter).not.toHaveBeenCalled()
    t.unmount()
  })

  it('skips when resolveCell returns null', () => {
    const t = setupDelegation({ resolveCell: () => null })
    overOn(t.container.querySelector('span')!)
    expect(t.api.onCellEnter).not.toHaveBeenCalled()
    t.unmount()
  })

  it('reads the disabled marker from dom', () => {
    const api = { onCellEnter: vi.fn(), onCellLeave: vi.fn(), forceHide: vi.fn() }
    const container = document.createElement('div')
    container.innerHTML = cellHtml(true)
    document.body.appendChild(container)
    const wrapper = mount(defineComponent({
      setup() {
        useOverflowTooltipDelegation({
          containerRef: ref<HTMLElement | null>(container),
          api: api as any,
          resolveCell: () => ({ row: {}, column: {}, cellValue: 'x', disabled: false }),
        })
        return () => h('div')
      },
    }), { attachTo: document.body })
    overOn(container.querySelector('span')!)
    expect(api.onCellEnter.mock.calls[0][1]).toBe(true)
    wrapper.unmount()
    container.remove()
  })

  it('leaves on mouseout to another cell', () => {
    const t = setupDelegation()
    const anchor = t.container.querySelector('.adv-table__cell--overflow')!
    outOf(anchor, t.container)
    expect(t.api.onCellLeave).toHaveBeenCalledTimes(1)
    t.unmount()
  })

  it('stays when moving within the same cell', () => {
    const t = setupDelegation()
    const anchor = t.container.querySelector('.adv-table__cell--overflow')!
    const inner = t.container.querySelector('span')!
    outOf(inner, anchor)
    expect(t.api.onCellLeave).not.toHaveBeenCalled()
    t.unmount()
  })

  it('binds nothing when disabled', () => {
    const t = setupDelegation({ enabled: ref(false) })
    overOn(t.container.querySelector('span')!)
    expect(t.api.onCellEnter).not.toHaveBeenCalled()
    t.unmount()
  })
})
