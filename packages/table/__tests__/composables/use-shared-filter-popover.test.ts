/**
 * useSharedFilterPopover 测试
 *
 * 共享筛选弹窗组合式函数——管理 1 个 ElPopover 的可见性、激活列、触发元素，
 * 处理 click-outside / Escape / 容器隐藏 / 触发元素销毁等生命周期守卫。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { useSharedFilterPopover } from '../../src/composables/shared/use-shared-filter-popover'

describe('useSharedFilterPopover', () => {
  const containerVisible = ref(true)

  beforeEach(() => {
    containerVisible.value = true
  })

  function createPopover() {
    return useSharedFilterPopover({
      containerVisible: () => containerVisible.value,
    })
  }

  describe('初始状态', () => {
    it('初始时 activeColumnKey 为 null', () => {
      const popover = createPopover()
      expect(popover.activeColumnKey.value).toBeNull()
    })

    it('初始时 activeFilterType 为 null', () => {
      const popover = createPopover()
      expect(popover.activeFilterType.value).toBeNull()
    })

    it('初始时 visible 为 false', () => {
      const popover = createPopover()
      expect(popover.visible.value).toBe(false)
    })

    it('popoverProps 的 visible 为 false', () => {
      const popover = createPopover()
      expect(popover.popoverProps.value.visible).toBe(false)
    })
  })

  describe('open', () => {
    it('打开弹窗后设置正确的状态', () => {
      const popover = createPopover()
      const el = document.createElement('div')

      popover.open('name', el, 'text')
      expect(popover.activeColumnKey.value).toBe('name')
      expect(popover.activeFilterType.value).toBe('text')
      expect(popover.visible.value).toBe(true)
    })

    it('连续打开不同列直接切换', () => {
      const popover = createPopover()
      const el1 = document.createElement('div')
      const el2 = document.createElement('div')

      popover.open('name', el1, 'text')
      expect(popover.activeColumnKey.value).toBe('name')

      popover.open('age', el2, 'number')
      expect(popover.activeColumnKey.value).toBe('age')
      expect(popover.activeFilterType.value).toBe('number')
      expect(popover.visible.value).toBe(true)
    })
  })

  describe('close', () => {
    it('关闭弹窗设置 visible=false 但保留 activeColumnKey', () => {
      const popover = createPopover()
      const el = document.createElement('div')

      popover.open('name', el, 'text')
      popover.close()
      expect(popover.visible.value).toBe(false)
      expect(popover.activeColumnKey.value).toBe('name')
      expect(popover.activeFilterType.value).toBe('text')
    })
  })

  describe('toggle', () => {
    it('同列切换：关闭已打开的弹窗', () => {
      const popover = createPopover()
      const el = document.createElement('div')

      popover.toggle('name', el, 'text')
      expect(popover.visible.value).toBe(true)

      popover.toggle('name', el, 'text')
      expect(popover.visible.value).toBe(false)
    })

    it('不同列切换：切换到新列', () => {
      const popover = createPopover()
      const el1 = document.createElement('div')
      const el2 = document.createElement('div')

      popover.toggle('name', el1, 'text')
      expect(popover.activeColumnKey.value).toBe('name')

      popover.toggle('age', el2, 'number')
      expect(popover.activeColumnKey.value).toBe('age')
      expect(popover.activeFilterType.value).toBe('number')
      expect(popover.visible.value).toBe(true)
    })
  })

  describe('popoverProps', () => {
    it('根据 filterType 返回合适的宽度', () => {
      const popover = createPopover()
      const el = document.createElement('div')

      popover.open('name', el, 'text')
      expect(popover.popoverProps.value.width).toBe(180)

      popover.close()

      popover.open('age', el, 'number')
      expect(popover.popoverProps.value.width).toBe(180)

      popover.close()

      popover.open('birth', el, 'date')
      expect(popover.popoverProps.value.width).toBe(260)
    })

    it('包含正确的 popperClass', () => {
      const popover = createPopover()
      const el = document.createElement('div')

      popover.open('name', el, 'text')
      expect(popover.popoverProps.value.popperClass).toBe('adv-table__filter-popover')
    })

    it('设置 virtualTriggering=true', () => {
      const popover = createPopover()
      const el = document.createElement('div')

      popover.open('name', el, 'text')
      expect(popover.popoverProps.value.virtualTriggering).toBe(true)
    })
  })

  describe('容器不可见', () => {
    it('容器隐藏时强制关闭弹窗', async () => {
      const popover = createPopover()
      const el = document.createElement('div')

      popover.open('name', el, 'text')
      expect(popover.visible.value).toBe(true)

      containerVisible.value = false
      await nextTick()
      expect(popover.visible.value).toBe(false)
    })

    it('容器不可见时 disabled=true', () => {
      containerVisible.value = false
      const popover = createPopover()

      expect(popover.popoverProps.value.disabled).toBe(true)
    })
  })

  describe('click-outside', () => {
    it('点击弹窗外部关闭弹窗', async () => {
      const popover = createPopover()
      const el = document.createElement('div')

      popover.open('name', el, 'text')
      // watch(visible) 是异步的，需等待事件监听器注册
      await nextTick()

      // 模拟点击弹窗外部
      const outsideEl = document.createElement('div')
      document.body.appendChild(outsideEl)
      // 使用 capture 阶段 dispatch，因为 onDocumentClick 注册在 capture 阶段
      outsideEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

      expect(popover.visible.value).toBe(false)
      document.body.removeChild(outsideEl)
    })

    it('点击弹窗内容不关闭', async () => {
      const popover = createPopover()
      const el = document.createElement('div')
      document.body.appendChild(el)

      popover.open('name', el, 'text')
      await nextTick()

      // 模拟点击 popover 内容（包含 .adv-table__filter-popover）
      const popoverContent = document.createElement('div')
      popoverContent.className = 'adv-table__filter-popover'
      document.body.appendChild(popoverContent)
      popoverContent.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

      expect(popover.visible.value).toBe(true)
      document.body.removeChild(popoverContent)
      document.body.removeChild(el)
    })

    it('点击 filter trigger 不关闭', async () => {
      const popover = createPopover()
      const el = document.createElement('div')
      el.className = 'adv-table__filter-trigger'
      document.body.appendChild(el)

      popover.open('name', el, 'text')
      await nextTick()

      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      expect(popover.visible.value).toBe(true)
      document.body.removeChild(el)
    })

    it('点击 floating filter clickable input 不关闭', async () => {
      const popover = createPopover()
      const el = document.createElement('div')
      document.body.appendChild(el)

      popover.open('name', el, 'text')
      await nextTick()

      const clickableInput = document.createElement('div')
      clickableInput.className = 'adv-table-floating-filter__input--clickable'
      document.body.appendChild(clickableInput)
      clickableInput.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

      expect(popover.visible.value).toBe(true)
      document.body.removeChild(clickableInput)
      document.body.removeChild(el)
    })
  })

  describe('escape 键', () => {
    it('按下 Escape 关闭弹窗', async () => {
      const popover = createPopover()
      const el = document.createElement('div')

      popover.open('name', el, 'text')
      expect(popover.visible.value).toBe(true)
      await nextTick()

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      expect(popover.visible.value).toBe(false)
    })

    it('弹窗未打开时 Escape 无效', () => {
      const popover = createPopover()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(popover.visible.value).toBe(false)
    })
  })
})
