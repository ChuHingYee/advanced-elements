/**
 * @vitest-environment happy-dom
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { useEditorBlur } from '../../src/composables/editing/use-editor-blur'

/**
 * <zh/> 编辑器失焦提交单测——覆盖激活态、外部点击提交、容器内/弹层点击放行。
 * <en/> Editor-blur tests — active state, outside-click commit, inside/popup clicks ignored.
 */
function setupHarness(opts: {
  editType?: string
  stopEditingWhenCellsLoseFocus?: boolean
} = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const stopEditing = vi.fn()
  const editingCell = ref<{ rowIndex: number, columnKey: string } | null>(null)
  const editingRowIndex = ref<number | null>(null)
  let active!: ReturnType<typeof useEditorBlur>
  const wrapper = mount(defineComponent({
    setup() {
      active = useEditorBlur({
        containerRef: ref<HTMLElement | null>(container),
        editingCell: editingCell as any,
        editingRowIndex: editingRowIndex as any,
        editConfig: () => ({ editType: opts.editType ?? 'cell', stopEditingWhenCellsLoseFocus: opts.stopEditingWhenCellsLoseFocus ?? true }) as any,
        stopEditing,
      })
      return () => h('div')
    },
  }), { attachTo: document.body })
  return {
    wrapper,
    container,
    stopEditing,
    editingCell,
    editingRowIndex,
    active,
    cleanup: () => {
      wrapper.unmount()
      container.remove()
    },
  }
}

function clickOn(el: Element) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
}

describe('useEditorBlur', () => {
  it('reports inactive without editing state', () => {
    const t = setupHarness()
    expect(t.active.value).toBe(false)
    t.cleanup()
  })

  it('reports active with editing cell', async () => {
    const t = setupHarness()
    t.editingCell.value = { rowIndex: 0, columnKey: 'name' }
    await nextTick()
    expect(t.active.value).toBe(true)
    t.cleanup()
  })

  it('commits on outside click while editing', async () => {
    const t = setupHarness()
    t.editingCell.value = { rowIndex: 0, columnKey: 'name' }
    await nextTick()
    clickOn(document.body)
    expect(t.stopEditing).toHaveBeenCalledWith('blur', true)
    t.cleanup()
  })

  it('ignores clicks inside the container', async () => {
    const t = setupHarness()
    t.editingCell.value = { rowIndex: 0, columnKey: 'name' }
    await nextTick()
    t.stopEditing.mockClear()
    const inner = document.createElement('span')
    t.container.appendChild(inner)
    inner.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
    expect(t.stopEditing).not.toHaveBeenCalled()
    t.cleanup()
  })

  it('ignores clicks on editor popup layers', async () => {
    const t = setupHarness()
    t.editingCell.value = { rowIndex: 0, columnKey: 'name' }
    await nextTick()
    t.stopEditing.mockClear()
    const popup = document.createElement('div')
    popup.className = 'el-select-popper'
    document.body.appendChild(popup)
    clickOn(popup)
    expect(t.stopEditing).not.toHaveBeenCalled()
    popup.remove()
    t.cleanup()
  })

  it('does not commit when config disables blur commit', async () => {
    const t = setupHarness({ editType: 'cell', stopEditingWhenCellsLoseFocus: false })
    t.editingCell.value = { rowIndex: 0, columnKey: 'name' }
    await nextTick()
    clickOn(document.body)
    expect(t.stopEditing).not.toHaveBeenCalled()
    t.cleanup()
  })

  it('commits in fullRow mode regardless of lose-focus flag', async () => {
    const t = setupHarness({ editType: 'fullRow', stopEditingWhenCellsLoseFocus: false })
    t.editingRowIndex.value = 2
    await nextTick()
    expect(t.active.value).toBe(true)
    clickOn(document.body)
    expect(t.stopEditing).toHaveBeenCalledWith('blur', true)
    t.cleanup()
  })
})
