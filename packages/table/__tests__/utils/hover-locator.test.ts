/**
 * @vitest-environment happy-dom
 */
import type { BodyRectSpec, RowLocateSpec } from '../../src/utils/hover-locator'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clampRowToContainer,
  getBodyContainerRect,
  locateRowByKey,
} from '../../src/utils/hover-locator'

/**
 * <zh/> hover 行定位单测——覆盖容器 rect、行反查与 clamp。
 * <en/> Hover-locator tests — body rect, row lookup and clamp.
 */
function rectOf(partial: Partial<DOMRect>): DOMRect {
  return {
    left: 0,
    top: 0,
    right: 100,
    bottom: 50,
    width: 100,
    height: 50,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...partial,
  } as DOMRect
}

function stubRect(el: Element, rect: DOMRect) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect)
}

const spec: BodyRectSpec = {
  bodySelector: '.body',
  scrollbars: { virtualBar: '.vbar', scrollWrap: '', customBar: '.cbar' },
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getBodyContainerRect', () => {
  it('falls back to container rect when body is missing', () => {
    const container = document.createElement('div')
    const fallback = rectOf({ left: 5, right: 105 })
    stubRect(container, fallback)
    expect(getBodyContainerRect(container, spec)).toBe(fallback)
  })

  it('returns body rect when no vertical scroll', () => {
    const container = document.createElement('div')
    const body = document.createElement('div')
    body.className = 'body'
    container.appendChild(body)
    stubRect(container, rectOf({ left: 0, right: 200 }))
    stubRect(body, rectOf({ left: 0, top: 10, right: 200, bottom: 60, height: 50 }))
    Object.defineProperty(body, 'scrollHeight', { value: 50, configurable: true })
    Object.defineProperty(body, 'clientHeight', { value: 50, configurable: true })
    const out = getBodyContainerRect(container, spec)
    expect(out.top).toBe(10)
    expect(out.height).toBe(50)
  })

  it('shrinks right edge for virtual custom bar', () => {
    const container = document.createElement('div')
    const body = document.createElement('div')
    body.className = 'body'
    const bar = document.createElement('div')
    bar.className = 'vbar'
    body.appendChild(bar)
    container.appendChild(body)
    stubRect(container, rectOf({ right: 200, width: 200 }))
    stubRect(body, rectOf({ right: 200, width: 200, height: 50 }))
    const out = getBodyContainerRect(container, spec)
    expect(out.width).toBe(194)
  })

  it('shrinks right edge for native scrollbar', () => {
    const noVirtual: BodyRectSpec = { bodySelector: '.body', scrollbars: { virtualBar: undefined, scrollWrap: '', customBar: undefined } }
    const container = document.createElement('div')
    const body = document.createElement('div')
    body.className = 'body'
    container.appendChild(body)
    stubRect(container, rectOf({ right: 200, width: 200 }))
    stubRect(body, rectOf({ right: 200, width: 200, height: 50 }))
    Object.defineProperty(body, 'scrollHeight', { value: 100, configurable: true })
    Object.defineProperty(body, 'clientHeight', { value: 50, configurable: true })
    Object.defineProperty(body, 'offsetWidth', { value: 200, configurable: true })
    Object.defineProperty(body, 'clientWidth', { value: 184, configurable: true })
    const out = getBodyContainerRect(container, noVirtual)
    expect(out.width).toBe(184)
  })

  it('shrinks right edge for el-scrollbar custom bar', () => {
    const custom: BodyRectSpec = { bodySelector: '.body', scrollbars: { virtualBar: undefined, scrollWrap: '', customBar: '.cbar' } }
    const container = document.createElement('div')
    const body = document.createElement('div')
    body.className = 'body'
    const bar = document.createElement('div')
    bar.className = 'cbar'
    body.appendChild(bar)
    container.appendChild(body)
    stubRect(container, rectOf({ right: 200, width: 200 }))
    stubRect(body, rectOf({ left: 0, right: 200, width: 200, height: 50 }))
    stubRect(bar, rectOf({ left: 190, right: 200, width: 10 }))
    Object.defineProperty(body, 'scrollHeight', { value: 100, configurable: true })
    Object.defineProperty(body, 'clientHeight', { value: 50, configurable: true })
    Object.defineProperty(body, 'offsetWidth', { value: 200, configurable: true })
    Object.defineProperty(body, 'clientWidth', { value: 200, configurable: true })
    const out = getBodyContainerRect(container, custom)
    expect(out.width).toBe(190)
  })
})

describe('locateRowByKey', () => {
  const rowSpec: RowLocateSpec = {
    rowSelector: 'tr',
    bodyRect: spec,
  }

  it('returns undefined for nullish key', () => {
    const container = document.createElement('div')
    expect(locateRowByKey(container, null, rowSpec)).toBeUndefined()
    expect(locateRowByKey(container, undefined, rowSpec)).toBeUndefined()
  })

  it('returns undefined when marker is missing', () => {
    const container = document.createElement('div')
    container.innerHTML = '<div class="body"><table><tr><td>x</td></tr></table></div>'
    expect(locateRowByKey(container, '9', rowSpec)).toBeUndefined()
  })

  it('returns undefined when marker has no row ancestor', () => {
    const container = document.createElement('div')
    container.innerHTML = '<div class="body"><span data-adv-table-row-key="1">x</span></div>'
    expect(locateRowByKey(container, '1', rowSpec)).toBeUndefined()
  })

  it('locates a visible row', () => {
    const container = document.createElement('div')
    container.innerHTML = '<div class="body"><table><tr data-adv-table-row-key="1"><td>x</td></tr></table></div>'
    const row = container.querySelector('tr')!
    stubRect(container, rectOf({ top: 0, bottom: 500 }))
    const body = container.querySelector('.body')!
    stubRect(body, rectOf({ top: 0, bottom: 500 }))
    stubRect(row, rectOf({ top: 20, bottom: 40, height: 20 }))
    const found = locateRowByKey(container, '1', rowSpec)
    expect(found?.rect.top).toBe(20)
  })

  it('returns undefined when row scrolled out of view', () => {
    const container = document.createElement('div')
    container.innerHTML = '<div class="body"><table><tr data-adv-table-row-key="1"><td>x</td></tr></table></div>'
    const row = container.querySelector('tr')!
    stubRect(container, rectOf({ top: 0, bottom: 100 }))
    const body = container.querySelector('.body')!
    stubRect(body, rectOf({ top: 0, bottom: 100 }))
    stubRect(row, rectOf({ top: 200, bottom: 220, height: 20 }))
    expect(locateRowByKey(container, '1', rowSpec)).toBeUndefined()
  })
})

describe('clampRowToContainer', () => {
  it('clamps row into container bounds', () => {
    const out = clampRowToContainer(
      rectOf({ top: -10, bottom: 30, height: 40 }),
      rectOf({ top: 0, bottom: 100, left: 0, right: 200 }),
    )
    expect(out.top).toBe(0)
    expect(out.height).toBe(30)
    expect(out.containerRight).toBe(200)
    expect(out.containerLeft).toBe(0)
  })
})
