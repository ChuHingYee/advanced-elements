/**
 * <zh/> 搜索表单自适应宽度布局 composable
 * <en/> Search form adaptive-width layout composable
 *
 * @remarks
 * <zh/> 职责单一：管理表单项的自适应宽度布局，包含影子可见性计算、rAF/debounce 调度、ResizeObserver。
 * <zh/> 自管理生命周期钩子（onMounted/onBeforeUnmount/onActivated/onDeactivated），组件只需调用暴露的函数并读取响应式状态。
 * <en/> Single responsibility: manages adaptive-width layout for form items, including shadow visibility calculation, rAF/debounce scheduling, and ResizeObserver.
 * <en/> Self-manages lifecycle hooks (onMounted/onBeforeUnmount/onActivated/onDeactivated); the component only needs to call exposed functions and read reactive state.
 */
import type { CSSProperties, Ref } from 'vue'
import type { FormField, ItemRefsMap } from './types'
import { useDebounceFn, useResizeObserver } from '@vueuse/core'
import { nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { rafSchedule } from '../../utils/raf'

export interface UseSearchLayoutDeps {
  /** <zh/> 字段配置（响应式 getter） | <en/> Field config (reactive getter) */
  fields: () => FormField[]
  /** <zh/> 表单项间距（响应式 getter） | <en/> Form item gap (reactive getter) */
  itemGap: () => number
  /** <zh/> 是否禁用自适应宽度折叠（响应式 getter） | <en/> Whether to disable adaptive-width collapse (reactive getter) */
  disableResize: () => boolean
  /** <zh/> 防抖延迟（响应式 getter） | <en/> Debounce delay (reactive getter) */
  debounceTime: () => number
  /** <zh/> 展开状态（与主组件共享） | <en/> Expand state (shared with main component) */
  expanded: Ref<boolean>
  /** <zh/> 用户主动展开标志（与主组件共享） | <en/> User-initiated expand flag (shared with main component) */
  userExpanded: Ref<boolean>
  /** <zh/> 自定义隐藏映射（与主组件共享，只读） | <en/> Custom hidden map (shared with main component, read-only) */
  customHiddenMap: Ref<Record<string, boolean>>
  /** <zh/> 表单项引用映射（与主组件共享） | <en/> Form item refs map (shared with main component) */
  formItemRefs: ItemRefsMap
  /** <zh/> 表单 DOM 元素获取器（用于 ResizeObserver 目标元素） | <en/> Form DOM element getter (for ResizeObserver target element) */
  formEl: () => HTMLElement | undefined
  /** <zh/> 按钮容器引用（用于计算可用宽度） | <en/> Button container ref (for available width calculation) */
  btnRef: Ref<any>
  /** <zh/> 展开状态变化回调 | <en/> Expand state change callback */
  onExpandChange: (val: boolean) => void
}

export interface UseSearchLayoutReturn {
  /** <zh/> 系统隐藏映射（由布局计算决定） | <en/> System hidden map (determined by layout calculation) */
  systemHiddenMap: Ref<Record<string, boolean>>
  /** <zh/> 表单项宽度缓存 | <en/> Form item width cache */
  formItemWidths: Ref<Record<string, number | null>>
  /** <zh/> 是否已初始化 | <en/> Whether initialized */
  initialized: Ref<boolean>
  /** <zh/> 最近一次展开状态下所有可见字段的 prop 集合 | <en/> Set of visible field props from last expanded state */
  lastVisibleProps: Ref<Set<string>>
  /** <zh/> 容器宽度 | <en/> Container width */
  width: Ref<number>
  /** <zh/> 判断字段是否可见 | <en/> Check if a field is visible */
  isVisible: (prop: string) => boolean
  /** <zh/> 获取可见性 CSS 类 | <en/> Get visibility CSS class */
  getVisibilityClass: (prop: string) => string
  /** <zh/> 获取可见性内联样式 | <en/> Get visibility inline style */
  getVisibilityStyle: (prop: string, zIndex: number) => CSSProperties
  /** <zh/> 触发布局重新计算（防抖） | <en/> Trigger layout recalculation (debounced) */
  triggerLayoutRecalc: () => void
  /** <zh/> 计算可见性 | <en/> Calculate visibility */
  calculateVisibility: (reason?: 'resize' | 'data' | 'init') => void
  /** <zh/> 捕获当前可见字段快照 | <en/> Capture snapshot of currently visible fields */
  captureVisibleSnapshot: () => void
  /** <zh/> 移除已删除字段的布局状态 | <en/> Remove layout state for a deleted field */
  removeField: (prop: string) => void
  /** <zh/> 重置展开按钮宽度缓存 | <en/> Reset expand button width cache */
  resetExpandBtnWidthCache: () => void
  /** <zh/> 更新表单项宽度缓存 | <en/> Update form item width cache */
  setFormItemWidth: (prop: string, width: number | null) => void
}

const EXPAND_BUTTON_WIDTH_FALLBACK = 54

/**
 * <zh/> 创建搜索表单自适应宽度布局管理器
 * <en/> Create search form adaptive-width layout manager
 *
 * @param deps - <zh/> 依赖项 | <en/> Dependencies
 * @returns <zh/> 布局状态、计算函数和生命周期管理 | <en/> Layout state, calculation functions, and lifecycle management
 */
export function useSearchLayout(deps: UseSearchLayoutDeps): UseSearchLayoutReturn {
  const {
    fields,
    itemGap,
    disableResize,
    debounceTime,
    expanded,
    userExpanded,
    customHiddenMap,
    formItemRefs,
    formEl,
    btnRef,
    onExpandChange,
  } = deps

  const systemHiddenMap = ref<Record<string, boolean>>({})
  const formItemWidths = ref<Record<string, number | null>>({})
  const initialized = ref(false)
  const width = ref(0)
  const lastVisibleProps = ref<Set<string>>(new Set())

  let cachedExpandBtnFullWidth: number | null = null
  let resizeObserver: ReturnType<typeof useResizeObserver> | null = null
  let observerPending = false
  let isTornDown = false

  /**
   * <zh/> rAF 批处理（共享工具）：resize 时在同一帧内完成计算+DOM 更新，避免 30ms 防抖延迟导致按钮换行闪烁。
   * <zh/> 多次 resize 事件在同一帧内自动合并，仅执行一次计算。
   * <en/> rAF batching (shared util): compute + DOM update within the same frame on resize,
   * <en/> avoiding button-wrap flicker caused by the 30ms debounce delay. Coalesced per frame.
   */
  const resizeCalcHandle = rafSchedule(() => calculateVisibility('resize'))

  function scheduleResizeCalc() {
    resizeCalcHandle.schedule()
  }

  /**
   * <zh/> 防抖 calculateVisibility 函数。
   * <zh/> useDebounceFn 返回 PromisifyFn< => void> =  => Promise<void>，
   * <zh/> 运行时由 createFilterWrapper 注入 cancel 方法，但 VueUse 类型定义未暴露该成员。
   * <en/> Debounced calculateVisibility function.
   * <en/> useDebounceFn returns PromisifyFn< => void> =  => Promise<void>,
   * <en/> cancel method is injected at runtime by createFilterWrapper, but VueUse type definitions don't expose this member.
   */
  let debouncedCalculate: () => Promise<void> = useDebounceFn(() => calculateVisibility('data'), debounceTime())
  watch(() => debounceTime(), (newTime) => {
    // 注意：cancel 运行时由 createFilterWrapper 注入，VueUse 的 PromisifyFn<T> 类型未暴露该成员，需通过 unknown 中间断言访问
    // Note: cancel is injected at runtime by createFilterWrapper; VueUse's PromisifyFn<T> type doesn't expose this member, so we access it via an unknown intermediate cast
    ;(debouncedCalculate as unknown as { cancel: () => void }).cancel()
    debouncedCalculate = useDebounceFn(() => calculateVisibility('data'), newTime)
  })

  function triggerLayoutRecalc() {
    if (disableResize()) {
      initialized.value = true
      return
    }
    debouncedCalculate()
  }

  function isVisible(prop: string): boolean {
    if (!initialized.value)
      return false
    if (customHiddenMap.value[prop])
      return false
    if (expanded.value)
      return true
    return !systemHiddenMap.value[prop]
  }

  function getVisibilityClass(prop: string): string {
    return isVisible(prop) ? 'adv-table-search-form__item--visible' : ''
  }

  function getVisibilityStyle(prop: string, zIndex: number): CSSProperties {
    return { zIndex: isVisible(prop) ? zIndex : -1 }
  }

  function getFormItemWidth(item: FormField): number {
    const itemRef = formItemRefs[item.prop]
    if (!itemRef)
      return 0
    const cached = formItemWidths.value[item.prop]
    let itemWidth = cached || 0
    if (cached === null || item.dynamicWidth) {
      itemWidth = Math.ceil(itemRef.el.$el.getBoundingClientRect().width)
      formItemWidths.value[item.prop] = itemWidth
      itemRef.width = itemWidth
    }
    return itemWidth
  }

  function getBaseButtonWidth(): number {
    const btnEl = btnRef.value?.$el
    if (!btnEl)
      return 0
    const total = Math.ceil(btnEl.getBoundingClientRect().width || 0)
    const expandBtn = btnEl.querySelector('[data-expand-btn]') as HTMLElement | null
    if (!expandBtn || expandBtn.offsetWidth === 0)
      return total
    const style = getComputedStyle(expandBtn)
    const marginLeft = Number.parseInt(style.marginLeft) || 0
    const marginRight = Number.parseInt(style.marginRight) || 0
    return total - Math.ceil(expandBtn.getBoundingClientRect().width) - marginLeft - marginRight
  }

  function getExpandButtonFullWidth(): number {
    if (cachedExpandBtnFullWidth !== null)
      return cachedExpandBtnFullWidth
    const btnEl = btnRef.value?.$el
    if (btnEl) {
      const expandBtn = btnEl.querySelector('[data-expand-btn]') as HTMLElement | null
      if (expandBtn && expandBtn.offsetWidth > 0) {
        const style = getComputedStyle(expandBtn)
        const marginLeft = Number.parseInt(style.marginLeft) || 0
        const marginRight = Number.parseInt(style.marginRight) || 0
        cachedExpandBtnFullWidth = Math.ceil(expandBtn.getBoundingClientRect().width) + marginLeft + marginRight
        return cachedExpandBtnFullWidth
      }
    }
    return EXPAND_BUTTON_WIDTH_FALLBACK
  }

  function getAvailableWidth(includeExpandBtn: boolean): number {
    const gap = itemGap()
    const expandWidth = includeExpandBtn ? getExpandButtonFullWidth() : 0
    return Math.max(0, width.value - getBaseButtonWidth() - expandWidth - gap)
  }

  /**
   * <zh/> 影子计算：根据可用宽度计算各字段是否应被布局隐藏
   * @returns <zh/> 影子隐藏映射（prop → 是否隐藏），不修改任何响应式状态 | <en/> shadow hidden map (prop → boolean), does not mutate any reactive state
   * <en/> Shadow calculation: compute whether each field should be hidden by layout based on available width
   */
  function computeShadowVisibility(items: FormField[], availableWidth: number): Record<string, boolean> {
    const result: Record<string, boolean> = {}
    let currentTotal = 0
    let isLastItem = false
    const gap = itemGap()

    items.forEach((item, index) => {
      if (isLastItem) {
        result[item.prop] = true
        return
      }
      const itemWidth = getFormItemWidth(item)
      if (index === items.length - 1) {
        result[item.prop] = !(currentTotal + itemWidth <= availableWidth)
      }
      else {
        const total = currentTotal + itemWidth + gap
        if (total <= availableWidth) {
          result[item.prop] = false
          currentTotal = total
        }
        else {
          isLastItem = true
          result[item.prop] = true
        }
      }
    })

    return result
  }

  function captureVisibleSnapshot() {
    const next = new Set<string>()
    for (const item of fields()) {
      if (item.hidden)
        continue
      if (customHiddenMap.value[item.prop])
        continue
      if (!expanded.value && systemHiddenMap.value[item.prop])
        continue
      next.add(item.prop)
    }
    lastVisibleProps.value = next
  }

  function calculateVisibility(reason: 'resize' | 'data' | 'init' = 'init') {
    if (disableResize()) {
      const allVisible: Record<string, boolean> = {}
      fields().forEach(item => (allVisible[item.prop] = false))
      systemHiddenMap.value = allVisible
      initialized.value = true
      captureVisibleSnapshot()
      return
    }

    const visibleItems = fields().filter(
      item => !item.hidden && !customHiddenMap.value[item.prop],
    )

    let shadowMap = computeShadowVisibility(visibleItems, getAvailableWidth(false))

    // 如果有项被隐藏，需要显示展开按钮，重新计算（预留展开按钮空间） | If items are hidden, need to show expand button, recalculate (reserve expand button space)
    if (visibleItems.some(item => shadowMap[item.prop])) {
      shadowMap = computeShadowVisibility(visibleItems, getAvailableWidth(true))
    }

    // 数据变化时：当前可见的表单项变隐藏 → 自动展开（非用户主动，userExpanded 保持 false）
    // On data change: a currently visible item becomes hidden → auto-expand (not user-initiated, userExpanded stays false)
    if (reason === 'data' && !expanded.value) {
      const newlyHidden = visibleItems.some(
        item => shadowMap[item.prop] && lastVisibleProps.value.has(item.prop),
      )
      if (newlyHidden) {
        expanded.value = true
        // 不设 userExpanded = true，此为程序自动展开
        // Do not set userExpanded = true; this is programmatic auto-expand
        onExpandChange(true)
      }
    }

    // 容器宽度变化时：
    // On container width change:
    // - 用户主动展开（userExpanded = true）：不自动折叠，尊重用户意愿
    // - User-initiated expand (userExpanded = true): don't auto-collapse, respect user intent
    // - 程序自动展开或折叠态（userExpanded = false）：宽度变小允许折叠溢出项
    // - Programmatic auto-expand or collapsed state (userExpanded = false): shrink allows collapsing overflow items
    if (reason === 'resize' && expanded.value && !userExpanded.value && visibleItems.some(item => shadowMap[item.prop])) {
      expanded.value = false
      onExpandChange(false)
    }

    // 初始化时：自动折叠溢出项
    // On initialization: auto-collapse overflow items
    if (reason === 'init' && expanded.value && visibleItems.some(item => shadowMap[item.prop])) {
      expanded.value = false
      userExpanded.value = false
      onExpandChange(false)
    }

    systemHiddenMap.value = { ...systemHiddenMap.value, ...shadowMap }

    captureVisibleSnapshot()
    initialized.value = true
  }

  function initResizeObserver() {
    if (resizeObserver || observerPending)
      return
    // 无原生 ResizeObserver（旧端/SSR 残缺环境）时不同步降级：首帧同步量测一次，
    // 后续靠数据/显隐变更触发的 triggerLayoutRecalc 推进，避免 useResizeObserver 抛错
    if (typeof ResizeObserver === 'undefined') {
      isTornDown = false
      nextTick(() => {
        if (isTornDown)
          return
        triggerLayoutRecalc()
      })
      return
    }
    isTornDown = false
    observerPending = true
    nextTick(() => {
      observerPending = false
      // 失活/卸载后 tick 才执行时直接放弃，避免建后即泄漏
      if (isTornDown)
        return
      const el = formEl()
      if (!el)
        return
      resizeObserver = useResizeObserver(el, (entries) => {
        const entry = entries[0]
        const { height, width: newWidth } = entry.contentRect
        if (newWidth !== 0 && height !== 0 && newWidth !== width.value) {
          width.value = newWidth
          scheduleResizeCalc()
        }
      })
    })
  }

  function cleanObserver() {
    isTornDown = true
    resizeCalcHandle.cancel()
    if (resizeObserver) {
      resizeObserver.stop()
      resizeObserver = null
    }
  }

  function handleActivated() {
    isTornDown = false
    initResizeObserver()
    nextTick(() => triggerLayoutRecalc())
  }

  function removeField(prop: string) {
    delete formItemWidths.value[prop]
    delete systemHiddenMap.value[prop]
  }

  function resetExpandBtnWidthCache() {
    cachedExpandBtnFullWidth = null
  }

  function setFormItemWidth(prop: string, itemWidth: number | null) {
    formItemWidths.value[prop] = itemWidth
  }

  onMounted(initResizeObserver)
  onBeforeUnmount(cleanObserver)
  onActivated(handleActivated)
  onDeactivated(cleanObserver)

  return {
    systemHiddenMap,
    formItemWidths,
    initialized,
    lastVisibleProps,
    width,
    isVisible,
    getVisibilityClass,
    getVisibilityStyle,
    triggerLayoutRecalc,
    calculateVisibility,
    captureVisibleSnapshot,
    removeField,
    resetExpandBtnWidthCache,
    setFormItemWidth,
  }
}
