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
}

/**
 * <zh/> 追踪 Shift/Ctrl 键状态的 Composable
 * <en/> Composable for tracking Shift/Ctrl key state across table instances
 * @remarks
 * <zh/> 每个 AdvTable 实例拥有自己的 ref，避免跨实例污染。使用 watch 动态绑定/解绑键盘事件，处理条件渲染和挂载后赋值的情况
 * <en/> Each AdvTable instance has its own ref, avoiding cross-instance contamination. Uses watch to dynamically bind/unbind keyboard events, handling cases where the element is conditionally rendered and assigned after mount
 */
/** <zh/> 根元素 no-select 属性名——Shift 按下期间由本 composable 命令式写入 | <en/> Root no-select attribute — applied imperatively by this composable while Shift is held */
const NO_SELECT_ATTR = 'data-adv-table-no-select'

export function useModifierKeyTracker(options: UseModifierKeyTrackerOptions = {}) {
  const { enabled } = options

  const shiftKeyPressed = ref(false)
  const ctrlKeyPressed = ref(false)
  const tableRootRef = ref<HTMLElement | null>(null)

  /** Shift 或 Ctrl/Meta 任一按下 */
  const modifierPressed = computed(() => shiftKeyPressed.value || ctrlKeyPressed.value)

  // <zh/> Shift 态命令式同步为根元素属性，不得进根渲染效应：根模板 :class 一旦读取 shiftKeyPressed，
  // <zh/> 每次 Shift keydown/keyup 都会整表重渲染（实测 100 行 ≈57ms/次）；类名也不可用——patchClass
  // <zh/> 是 el.className = value 整体覆盖。watch 覆盖全部写点（含 resetInteractionState 与 blur/deactivated
  // <zh/> 复位），回调不在渲染效应内，不建立根依赖。
  // <en/> Sync the Shift state imperatively as a root attribute, never inside the root render effect:
  // <en/> once the root template :class reads shiftKeyPressed, every Shift keydown/keyup re-renders the
  // <en/> whole tbody (measured ≈57ms per event at 100 rows); a class is also unusable — patchClass is
  // <en/> an el.className = value wholesale overwrite. The watch covers every write point (including
  // <en/> resetInteractionState and the blur/deactivated resets); its callback is outside the render
  // <en/> effect and establishes no root dependency.
  watch(shiftKeyPressed, (pressed) => {
    tableRootRef.value?.toggleAttribute(NO_SELECT_ATTR, pressed)
  })

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
  }
}
