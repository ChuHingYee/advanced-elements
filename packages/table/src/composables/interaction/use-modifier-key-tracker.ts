import type { MaybeRefOrGetter, Ref } from 'vue'
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, toValue, watch } from 'vue'

export interface UseModifierKeyTrackerOptions {
  /** <zh/> 是否启用键盘追踪，禁用时不绑定 keydown/keyup 监听器。默认 true | <en/> Whether to enable keyboard tracking, when disabled no keydown/keyup listeners are bound. Default true */
  enabled?: MaybeRefOrGetter<boolean>
}

export interface UseModifierKeyTrackerReturn {
  /** <zh/> 表格根元素 ref | <en/> Table root element ref */
  tableRootRef: Ref<HTMLElement | null>
  /** <zh/> Shift 键是否按下 | <en/> Whether Shift key is pressed */
  shiftKeyPressed: Ref<boolean>
  /** <zh/> Shift 或 Ctrl/Meta 任一按下时为 true | <en/> True when Shift or Ctrl/Meta is pressed */
  modifierPressed: Ref<boolean>
  /** <zh/> Shift 按下时添加到 table root 的类名，用于 user-select: none（不阻止 Ctrl+C 复制） | <en/> Class name added to table root when Shift is pressed, for user-select: none (doesn't prevent Ctrl+C copy) */
  noSelectClass: string
}

/**
 * <zh/> 追踪 Shift/Ctrl 键状态的 Composable
 * <en/> Composable for tracking Shift/Ctrl key state across table instances
 * @remarks
 * <zh/> 每个 AdvTable 实例拥有自己的 ref，避免跨实例污染。使用 watch 动态绑定/解绑键盘事件，处理条件渲染和挂载后赋值的情况
 * <en/> Each AdvTable instance has its own ref, avoiding cross-instance contamination. Uses watch to dynamically bind/unbind keyboard events, handling cases where the element is conditionally rendered and assigned after mount
 */
export function useModifierKeyTracker(options: UseModifierKeyTrackerOptions = {}) {
  const { enabled } = options

  const shiftKeyPressed = ref(false)
  const ctrlKeyPressed = ref(false)
  const tableRootRef = ref<HTMLElement | null>(null)

  /** Shift 或 Ctrl/Meta 任一按下 */
  const modifierPressed = computed(() => shiftKeyPressed.value || ctrlKeyPressed.value)

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Shift')
      shiftKeyPressed.value = true
    if (e.key === 'Control' || e.key === 'Meta')
      ctrlKeyPressed.value = true
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.key === 'Shift')
      shiftKeyPressed.value = false
    if (e.key === 'Control' || e.key === 'Meta')
      ctrlKeyPressed.value = false
  }

  /** <zh/> 窗口失焦时重置状态，防止修饰键卡住 | <en/> Reset state on window blur to prevent stuck modifier keys */
  function onBlur() {
    shiftKeyPressed.value = false
    ctrlKeyPressed.value = false
  }

  function bindListeners(el: HTMLElement) {
    el.addEventListener('keydown', onKeyDown)
    el.addEventListener('keyup', onKeyUp)
    if (typeof window !== 'undefined')
      window.addEventListener('blur', onBlur)
  }

  function unbindListeners(el: HTMLElement) {
    el.removeEventListener('keydown', onKeyDown)
    el.removeEventListener('keyup', onKeyUp)
    if (typeof window !== 'undefined')
      window.removeEventListener('blur', onBlur)
  }

  /** enabled 或 tableRootRef 变化时动态绑定/解绑 */
  watch(
    [tableRootRef, () => toValue(enabled)],
    ([newEl, isEnabled], [oldEl]) => {
      if (oldEl)
        unbindListeners(oldEl)
      if (newEl && isEnabled !== false)
        bindListeners(newEl)
    },
  )

  onBeforeUnmount(() => {
    if (tableRootRef.value)
      unbindListeners(tableRootRef.value)
  })

  /** KeepAlive deactivated 时重置修饰键状态并解绑监听器，避免隐藏表格中响应键盘事件 */
  onDeactivated(() => {
    shiftKeyPressed.value = false
    ctrlKeyPressed.value = false
    if (tableRootRef.value)
      unbindListeners(tableRootRef.value)
  })

  /** KeepAlive activated 时重新绑定监听器 */
  onActivated(() => {
    if (tableRootRef.value && toValue(enabled) !== false)
      bindListeners(tableRootRef.value)
  })

  return {
    tableRootRef,
    shiftKeyPressed,
    modifierPressed,
    noSelectClass: 'adv-table--no-select',
  }
}
