import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { ProcessedColumn } from '../../types/column'
import type { BuiltinMenuCode, ContextMenuArea, ContextMenuConfig, ContextMenuItem, ContextMenuItemOrSeparator, ContextMenuParams, ContextMenuVisibleParams, ImplementedBuiltinMenuCode, MenuOptionInput } from '../../types/context-menu'
import type { InterceptorShowMenuParams } from '../../types/interceptor'
import type { UseInterceptorReturn } from '../editing/use-interceptor'
import { computed, nextTick, onBeforeUnmount, onDeactivated, ref, shallowRef, watch } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { EP_ANY_POPPER_SELECTOR } from '../../utils/ep-selectors'
import { isBuiltinCode, PENDING_BUILTIN_MENU_CODES, resolveBuiltinItems } from '../features/use-context-menu-builtins'

/**
 * <zh/> useContextMenu 配置选项
 * <en/> Options for useContextMenu composable
 *
 * @typeParam T - <zh/> 行数据类型 | <en/> row data type
 */
export interface UseContextMenuOptions<T> {
  /** <zh/> 获取菜单配置 | <en/> Get menu config */
  menuConfig: () => ContextMenuConfig<T> | undefined
  /** <zh/> 获取有效列列表 | <en/> Get effective columns */
  effectiveColumns: () => ProcessedColumn[]
  /** <zh/> 拦截器实例，用于 showMenu 拦截 | <en/> Interceptor instance, for showMenu interception */
  interceptor: UseInterceptorReturn
  /** <zh/> 国际化翻译函数 | <en/> Internationalization translate function */
  t: (path: string) => string
  /** <zh/> 菜单项点击回调 | <en/> Menu item click callback */
  onMenuClick?: (params: { area: ContextMenuArea, menu: ContextMenuItem<T>, context: ContextMenuParams<T> }) => void
  /** <zh/> 内置菜单项动作回调（仅已实现项可达） | <en/> Built-in menu item action callback (only implemented codes can reach here) */
  onBuiltinAction?: (params: { code: ImplementedBuiltinMenuCode, context: ContextMenuParams<T> }) => void
}

/**
 * <zh/> useContextMenu 返回值
 * <en/> Return type of useContextMenu composable
 *
 * @remarks
 * <zh/> 提供右键菜单的响应式状态和方法
 * <en/> Provides reactive state and methods for the context menu
 * @typeParam T - <zh/> 行数据类型 | <en/> row data type
 */
export interface UseContextMenuReturn<T> {
  /** <zh/> 菜单是否可见 | <en/> Whether menu is visible */
  menuVisible: Ref<boolean>
  /** <zh/> 菜单位置 X（像素） | <en/> Menu position X (pixels) */
  menuX: Ref<number>
  /** <zh/> 菜单位置 Y（像素） | <en/> Menu position Y (pixels) */
  menuY: Ref<number>
  /** <zh/> 当前菜单项分组列表 | <en/> Current grouped menu item list */
  currentItems: ShallowRef<ContextMenuItemOrSeparator<T>[][]>
  /** <zh/> 当前菜单上下文参数 | <en/> Current menu context params */
  currentParams: ShallowRef<ContextMenuParams<T> | null>
  /** 菜单内联样式（left/top） */
  menuStyle: ComputedRef<{ left: string, top: string }>
  /** <zh/> 本次打开的菜单令牌——teleport 到 body 后按令牌定位自家菜单，多实例互不干扰 | <en/> Token of the current menu open — locates this instance's teleported menu by token across coexisting instances */
  menuToken: Ref<number>
  /** <zh/> 菜单根元素（二次校正优先走局部 ref） | <en/> Menu root element for re-measure */
  menuElRef: Ref<HTMLElement | null>
  /** <zh/> 设置菜单根元素（SFC ref 转发） | <en/> Set the menu root element (SFC ref forward) */
  setMenuElRef: (el: unknown) => void
  /** <zh/> 处理右键事件，显示菜单 | <en/> Handle the contextmenu event and show the menu */
  handleContextMenu: (params: ContextMenuParams<T>) => Promise<void>
  /** <zh/> 关闭菜单 | <en/> Close the menu */
  closeMenu: () => void
  /** <zh/> 菜单项点击事件处理 | <en/> Menu item click handler */
  onMenuItemClick: (item: ContextMenuItemOrSeparator<T>) => void
}

/**
 * 判断是否为菜单项（而非分隔符）
 * Type guard for menu items vs separators
 * @param item - 菜单项或分隔符
 * @returns 是否为菜单项
 */
export function isMenuItem<T>(item: ContextMenuItemOrSeparator<T>): item is ContextMenuItem<T> {
  return item.code !== 'separator'
}

/**
 * 展开内置菜单项编码为完整的菜单项配置
 * Expand builtin menu codes into full menu item configs
 *
 * 递归处理菜单项分组，将纯编码的内置菜单项解析为包含国际化名称和图标的完整项。
 * 子菜单也会递归展开。
 * @param items - 原始菜单项列表
 * @param t - 国际化翻译函数
 * @param params - 右键菜单上下文参数
 * @param disabledCodes - 需要禁用的内置菜单编码列表
 * @returns 展开后的菜单项列表
 */
function expandBuiltinCodes<T>(
  items: MenuOptionInput<T>[],
  t: (path: string) => string,
  params: ContextMenuParams<T>,
  disabledCodes?: BuiltinMenuCode[],
): ContextMenuItemOrSeparator<T>[] {
  const result: ContextMenuItemOrSeparator<T>[] = []
  for (const item of items) {
    /**
     * 字符串简写支持：用户可传入内置编码字符串（如 'copyCell'）代替完整对象。
     * 此处将字符串转换为 { code: string } 形式，交由后续内置编码解析逻辑处理。
     *
     * String shorthand support: users can pass builtin code strings (e.g. 'copyCell')
     * instead of full objects. Here we convert strings to { code: string } form
     * for the subsequent builtin code resolution logic to process.
     */
    const normalized: ContextMenuItemOrSeparator<T> = typeof item === 'string'
      ? item === 'separator'
        ? { code: 'separator' }
        : { code: item, name: '' }
      : item

    if (normalized.code === 'separator') {
      result.push(normalized)
      continue
    }
    if (isBuiltinCode(normalized.code) && isMenuItem(normalized) && !normalized.name) {
      const resolved = resolveBuiltinItems([normalized.code], t, params, disabledCodes)
      if (resolved.length) {
        const builtin = resolved[0] as ContextMenuItem<T>
        result.push({
          ...builtin,
          ...normalized,
          name: normalized.name || builtin.name,
          prefixIcon: normalized.prefixIcon ?? builtin.prefixIcon,
          suffix: normalized.suffix ?? builtin.suffix,
          visible: normalized.visible ?? builtin.visible,
          disabled: normalized.disabled ?? builtin.disabled,
        })
      }
      continue
    }
    // <zh/> 已声明但尚未实现的内置 code：dev 告警并跳过，不压入空名字菜单项
    // <en/> Declared-but-unimplemented builtin code: warn in dev and skip, never push a nameless item
    if (typeof normalized.code === 'string' && (PENDING_BUILTIN_MENU_CODES as readonly string[]).includes(normalized.code)) {
      if (isDev)
        devWarn(`[AdvTable] builtin menu code "${normalized.code}" is declared but not implemented yet; skipped`)
      continue
    }
    if (isMenuItem(normalized) && normalized.children?.length) {
      result.push({
        ...normalized,
        children: expandBuiltinCodes(normalized.children, t, params, disabledCodes) as ContextMenuItem<T>[],
      })
      continue
    }
    result.push(normalized)
  }
  return result
}

/**
 * <zh/> 菜单及关联弹出层的选择器列表（模块级常量，每实例复用）——点击这些元素之外的区域时关闭菜单。
 * <en/> Selectors of the menu and its related popups (module-level, shared per instance) — clicking
 * <en/> outside these elements closes the menu.
 */
const MENU_RELATED_SELECTORS = [
  '.adv-table-context-menu',
  EP_ANY_POPPER_SELECTOR,
]

/**
 * 右键菜单组合式函数
 * Composable for context menu
 *
 * 管理右键菜单的显示/隐藏、菜单位置调整、内置/自定义菜单项解析。
 * 支持菜单项分组、可视区域自适应定位、拦截器联动、内置菜单展开。
 * @param options - 右键菜单配置
 * @returns 右键菜单状态和方法
 */
export function useContextMenu<T>(options: UseContextMenuOptions<T>): UseContextMenuReturn<T> {
  const { menuConfig, effectiveColumns, interceptor, t, onMenuClick, onBuiltinAction } = options

  const menuVisible = ref(false)
  const menuX = ref(0)
  const menuY = ref(0)
  const currentItems = shallowRef<ContextMenuItemOrSeparator<T>[][]>([])
  const currentParams = shallowRef<ContextMenuParams<T> | null>(null)
  /**
   * <zh/> 菜单打开令牌——每次打开自增，teleport 后按令牌找回自家菜单（多实例下全局 querySelectorAll 取末位会串台）。
   * <en/> Menu-open token — increments per open; the teleported menu is found by token (a global querySelectorAll tail-pick races across instances).
   */
  const menuToken = ref(0)
  let menuTokenSeq = 0
  /**
   * <zh/> 请求代次：连点右键时旧的 visibleMethod await 决议后直接丢弃，避免覆盖新菜单。
   * <zh/> 与 menuTokenSeq 复用同一自增源但语义分离（请求取消 vs 已打开标识），close 即失效。
   * <en/> Request generation: stale visibleMethod resolutions are dropped so rapid
   * <en/> right-clicks cannot overwrite the newer menu. Invalidated on close.
   */
  let menuReqId = 0
  /** <zh/> 菜单根元素引用：二次校正优先走局部 ref，避免 document 全局扫 O(dom) | <en/> Menu root ref for re-measure; avoids a global document scan */
  const menuElRef = ref<HTMLElement | null>(null)
  function setMenuElRef(el: unknown): void {
    menuElRef.value = (el as HTMLElement | null) ?? null
  }

  const menuStyle = computed(() => ({
    left: `${menuX.value}px`,
    top: `${menuY.value}px`,
  }))

  /**
   * 解析右键菜单项分组
   * Resolve context menu items for a given area
   *
   * 按区域（header/body/footer）和列级配置解析菜单项。
   * body 区域优先使用列级 contextMenuItems，再回退到全局配置。
   * @param area - 右键菜单区域
   * @param column - 可选的列配置，用于 body 区域列级菜单
   * @returns 菜单项分组列表
   */
  function resolveMenuItems(area: ContextMenuArea, column?: ProcessedColumn): MenuOptionInput<T>[][] {
    if (area === 'body' && column) {
      const colKey = column.prop ?? column.key
      const col = effectiveColumns().find(c => (c.prop ?? c.key) === colKey)
      if (col?.contextMenuItems?.length) {
        return col.contextMenuItems
      }
    }

    const config = menuConfig()
    if (!config)
      return []

    const areaConfig = config[area]
    if (!areaConfig || areaConfig.enabled === false)
      return []

    return areaConfig.options ?? []
  }

  /**
   * <zh/> 菜单未渲染前的尺寸估算——仅用于初始定位（减少闪烁），挂载后按实际尺寸校正
   * <en/> Size estimation before the menu renders — only for initial placement (reduces flicker), corrected by actual size after mount
   */
  function estimateMenuSize(items: ContextMenuItemOrSeparator<T>[][]): { w: number, h: number } {
    /** 基于 EP 默认 padding + 最长菜单项文字估算 | Estimated from EP default padding + longest menu item text */
    const estimatedW = 180
    const itemCount = items.flat().length || 1
    return { w: estimatedW, h: itemCount * 32 }
  }

  function adjustPosition(x: number, y: number, width: number, height: number): { x: number, y: number } {
    const padding = 4
    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 0
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 0

    let adjustedX = x
    let adjustedY = y

    if (x + width + padding > viewportW) {
      adjustedX = x - width
    }
    if (y + height + padding > viewportH) {
      adjustedY = viewportH - height - padding
    }

    adjustedX = Math.max(padding, adjustedX)
    adjustedY = Math.max(padding, adjustedY)

    return { x: adjustedX, y: adjustedY }
  }

  function closeMenu() {
    // <zh/> 关闭即失效所有在飞请求：旧 visibleMethod 回来后直接丢弃
    // <en/> Closing invalidates all in-flight requests
    menuReqId++
    menuVisible.value = false
    currentItems.value = []
    currentParams.value = null
  }

  async function handleContextMenu(params: ContextMenuParams<T>): Promise<void> {
    // <zh/> 立即 preventDefault——异步化后（如 visibleMethod 为 Promise）再调用已错过浏览器默认菜单的抑制点，
    // <zh/> 导致原生菜单先弹出。副作用：visibleMethod 拒绝显示时原生菜单也被抑制，属可预期的取舍。
    // <en/> preventDefault immediately — calling it after an await misses the suppression window and
    // <en/> the native menu pops first. Trade-off: when visibleMethod denies, the native menu is
    // <en/> suppressed too; acceptable and predictable.
    params.event.preventDefault()

    if (interceptor.trigger('event.showMenu', params as InterceptorShowMenuParams<T>))
      return

    const rawItems = resolveMenuItems(params.area, params.column)
    if (!rawItems.length)
      return

    closeMenu()
    const reqId = ++menuReqId

    const config = menuConfig()
    const disabledCodes = config?.builtins?.disabled

    const items: ContextMenuItemOrSeparator<T>[][] = rawItems.map(group => expandBuiltinCodes(group, t, params, disabledCodes))

    if (config?.visibleMethod) {
      const flatItems = items.flat()
      const visibleParams: ContextMenuVisibleParams<T> = {
        ...params,
        options: items,
      }
      let shouldShow: boolean
      try {
        shouldShow = await config.visibleMethod(visibleParams)
      }
      catch (err) {
        // <zh/> 门控抛错按"不展示"处理并 dev 告警——用户函数抛错不得炸掉整条右键链路（unhandledrejection）。
        // <en/> A throwing gate denies the menu with a dev warning — user code must never break the
        // <en/> contextmenu chain with an unhandled rejection.
        if (isDev)
          devWarn('[AdvTable] context menu visibleMethod threw, menu hidden:', err)
        return
      }
      // <zh/> 过期决议直接丢弃：连点右键时慢的首次 await 不得覆盖新的菜单
      // <en/> Drop stale resolutions so a slow first await cannot overwrite a newer menu
      if (reqId !== menuReqId)
        return
      if (!shouldShow)
        return

      const hasVisible = flatItems.some(item => isMenuItem(item) && item.visible !== false)
      if (!hasVisible)
        return
    }

    if (reqId !== menuReqId)
      return
    const estimated = estimateMenuSize(items)
    const { x, y } = adjustPosition(params.event.clientX, params.event.clientY, estimated.w, estimated.h)
    menuX.value = x
    menuY.value = y
    currentItems.value = items
    currentParams.value = params
    menuTokenSeq += 1
    menuToken.value = menuTokenSeq
    menuVisible.value = true

    // <zh/> 菜单挂载后按实际渲染尺寸二次校正定位——纯估算在长文本/图标/分组场景偏差大
    // <en/> Re-adjust position with actual rendered size after mount — pure estimation drifts with long labels/icons/groups
    const openToken = menuToken.value
    const openReqId = reqId
    nextTick(() => {
      if (openReqId !== menuReqId)
        return
      // <zh/> 优先局部 ref（O(1)），ref 缺失（如 teleport 异常）才回退全局 token 查询
      // <en/> Prefer the local ref; fall back to the token query only when the ref is missing
      const el = menuElRef.value
        ?? document.querySelector<HTMLElement>(
          `.adv-table-context-menu:not(.adv-table-context-menu--submenu)[data-adv-table-menu-token="${openToken}"]`,
        )
      if (!el)
        return
      const { x: adjustedX, y: adjustedY } = adjustPosition(menuX.value, menuY.value, el.offsetWidth, el.offsetHeight)
      menuX.value = adjustedX
      menuY.value = adjustedY
    })
  }

  function onMenuItemClick(item: ContextMenuItemOrSeparator<T>) {
    if (!isMenuItem(item))
      return
    if (item.disabled || item.loading)
      return

    const context = currentParams.value
    if (!context)
      return

    if (isBuiltinCode(item.code)) {
      onBuiltinAction?.({ code: item.code, context })
    }

    onMenuClick?.({
      area: context.area,
      menu: item,
      context,
    })

    closeMenu()
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!menuVisible.value)
      return
    if (e.key === 'Escape') {
      e.stopPropagation() // 右键菜单优先消费 Escape，阻止 use-teleport-popover 同步关闭
      closeMenu()
    }
  }

  /** <zh/> 菜单及关联弹出层的选择器列表见模块级 MENU_RELATED_SELECTORS，点击这些元素之外的区域时关闭菜单（popper 系命名空间无关，见 ep-selectors.ts 注记） | <en/> See module-level MENU_RELATED_SELECTORS for the menu/related-popup selectors (popper matching is namespace-agnostic, see the ep-selectors.ts note) */
  function handleMousedown(e: MouseEvent) {
    if (!menuVisible.value)
      return
    const target = e.target as HTMLElement
    // 检查点击是否在菜单或其关联的弹出层内（EP 弹出层会被 Teleport 到 body）
    const isInside = MENU_RELATED_SELECTORS.some(sel => target.closest(sel))
    if (!isInside) {
      closeMenu()
    }
  }

  // 使用 onCleanup 保证每次 menuVisible 翻转前清理上一次副作用
  // Use onCleanup to ensure previous side effects are cleaned before each menuVisible toggle
  watch(menuVisible, (visible, _prev, onCleanup) => {
    if (visible) {
      document.addEventListener('keydown', handleKeydown, true)
      document.addEventListener('mousedown', handleMousedown, true)
      onCleanup(() => {
        document.removeEventListener('keydown', handleKeydown, true)
        document.removeEventListener('mousedown', handleMousedown, true)
      })
    }
  })

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleKeydown, true)
    document.removeEventListener('mousedown', handleMousedown, true)
  })

  /** KeepAlive deactivated 时关闭菜单并清理全局监听器，避免隐藏表格中响应 Escape/点击 */
  onDeactivated(() => {
    closeMenu()
  })

  return {
    menuVisible,
    menuX,
    menuY,
    currentItems,
    currentParams,
    menuStyle,
    menuToken,
    menuElRef,
    setMenuElRef,
    handleContextMenu,
    closeMenu,
    onMenuItemClick,
  }
}
