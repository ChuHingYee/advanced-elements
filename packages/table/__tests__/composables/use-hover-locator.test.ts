/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createHoverLocator } from '../../src/composables/rendering/use-hover-locator'

/**
 * <zh/> hover 定位器单测——覆盖容器缺失、键缺失、行命中与 cell 回退。
 * <en/> Hover-locator composable tests — missing container/key, row hit and cell fallback.
 */
const dom = {
  getRowSelector: () => 'tr',
  getBodySelector: () => '.body',
  getBodyScrollbarSpec: () => ({ virtualBar: undefined, scrollWrap: '', customBar: undefined }),
}

function rect(partial: Record<string, number> = {}) {
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

describe('createHoverLocator', () => {
  it('returns undefined without container or key', () => {
    const hoverRowKey = ref<string | number | null>(null)
    const locate = createHoverLocator({ getContainer: () => null, dom: dom as any, hoverRowKey })
    expect(locate()).toBeUndefined()
    const locate2 = createHoverLocator({
      getContainer: () => document.createElement('div'),
      dom: dom as any,
      hoverRowKey,
    })
    expect(locate2()).toBeUndefined()
  })

  it('locates a row element', () => {
    const container = document.createElement('div')
    container.innerHTML = '<div class="body"><table><tr data-adv-table-row-key="1"><td>x</td></tr></table></div>'
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(rect({ bottom: 500 }))
    const body = container.querySelector('.body')!
    vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect({ bottom: 500 }))
    const row = container.querySelector('tr')!
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(rect({ top: 20, bottom: 40, height: 20 }))
    const locate = createHoverLocator({
      getContainer: () => container,
      dom: dom as any,
      hoverRowKey: ref('1'),
    })
    expect(locate()).toMatchObject({ top: 20, height: 20 })
    vi.restoreAllMocks()
  })

  it('falls back to the cell rect when the row is gone', () => {
    const container = document.createElement('div')
    container.innerHTML = '<div class="body"><span data-adv-table-row-key="9">x</span></div>'
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(rect({ bottom: 500 }))
    const body = container.querySelector('.body')!
    vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect({ bottom: 500 }))
    const cell = container.querySelector('span')!
    vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue(rect({ top: 5, bottom: 15, height: 10 }))
    const locate = createHoverLocator({
      getContainer: () => container,
      dom: dom as any,
      hoverRowKey: ref('9'),
    })
    expect(locate()).toMatchObject({ top: 5, height: 10 })
    vi.restoreAllMocks()
  })

  it('returns undefined when nothing matches', () => {
    const container = document.createElement('div')
    container.innerHTML = '<div class="body"></div>'
    const locate = createHoverLocator({
      getContainer: () => container,
      dom: dom as any,
      hoverRowKey: ref('missing'),
    })
    expect(locate()).toBeUndefined()
  })
})
