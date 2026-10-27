<!--
  @component RowActionBar
  @displayName 行悬停操作按钮栏
  @displayName Row Action Bar
  @description <zh/> 在表格行悬停时显示操作按钮列表，支持行内 absolute 定位和 Teleport fixed 定位两种模式
  @description <en/> Shows action button list on table row hover, supports inline absolute and Teleport fixed positioning modes
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script lang="tsx" setup>
import type { CSSProperties } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { ActionConfig } from '../../types/column'
import { ArrowLeft } from '@element-plus/icons-vue'
import { useEventListener } from '@vueuse/core'
import { ElButton, ElIcon } from 'element-plus'
import { computed, inject, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { useOptionButtons } from '../../composables/features/use-option-buttons'
import { useSafeInject } from '../../composables/shared/use-safe-inject'
import { useAdvLocale } from '../../locale'
import { advTableHoverLayerKey } from '../../types/config'
import { advTableKey } from '../../types/injection-keys'

export interface RowRect {
  top: number
  height: number
  containerRight: number
  containerLeft: number
}

const props = withDefaults(defineProps<{
  visible: boolean
  /** <zh/> collapsed 不再由 props 传入，改从 inject 的 hoverApi 获取。保留 prop 用于 teleport 模式外部传入 | <en/> collapsed is no longer passed via props, instead obtained from the injected hoverApi. The prop is kept for external passing in teleport mode */
  collapsed?: boolean
  hoverOptionColumns: ProcessedColumn[]
  row: Record<string, unknown>
  rowIndex: number
  style?: CSSProperties
  /**
   * <zh/> - false：行内渲染，absolute 定位。
   * <en/> - false: inline rendering, absolute positioning.
   * <zh/> - true：通过 Teleport 到 body，fixed 定位。
   * <en/> - true: teleport to body, fixed positioning.
   */
  isTeleport?: boolean
  /** <zh/> isTeleport 为 true 时必需，提供行位置信息。 | <en/> Required when isTeleport is true, provides row position info. */
  rowRect?: RowRect
  /**
   * <zh/> 默认 `var(--el-index-top, 2000)`，与 Element Plus 弹层一致；
   * <en/> Defaults to `var(--el-index-top, 2000)`, consistent with Element Plus overlay;
   * <zh/> 调用方可显式传入以适配特定场景。
   * <en/> Callers can explicitly pass it to fit specific scenarios.
   */
  zIndex?: number | string
  /**
   * <zh/> 滚动状态标志：teleport 模式下滚动期间为 true，RowActionBar 通过 CSS visibility 隐藏而非切换 hiddenStyle，
   * <zh/> 避免 teleportRowRect 在 undefined ↔ valid 之间切换引发 reactivity 级联和 DOM style 频繁 patch
   * <en/> Scroll state flag: true during scrolling in teleport mode, RowActionBar hides via CSS visibility
   * <en/> instead of switching hiddenStyle, avoiding reactivity cascade and DOM style patching from rect toggling
   */
  isScrolling?: boolean
}>(), {})

const emit = defineEmits<{
  (e: 'toggleCollapse', event: Event): void
  (e: 'mouseenter', event: MouseEvent): void
  (e: 'mouseleave', event: MouseEvent): void
  (e: 'forceHide'): void
}>()

/** <zh/> 鼠标进入事件转发 | <en/> Mouse enter event forwarder */
function handleMouseEnter(event: MouseEvent): void {
  emit('mouseenter', event)
}

/** <zh/> 鼠标离开事件转发 | <en/> Mouse leave event forwarder */
function handleMouseLeave(event: MouseEvent): void {
  emit('mouseleave', event)
}

const tableContext = inject(advTableKey, undefined)
/** <zh/> 通过 inject 获取 hoverApi，在组件 render effect 内读取 hoverLayerStyle/hoverLayerCollapsed，避免在 ElTable 插槽内读取这些响应式状态污染 EP render effect | <en/> Obtain hoverApi via inject, read hoverLayerStyle/hoverLayerCollapsed inside the component render effect, avoiding polluting EP render effect by reading these reactive states inside ElTable slots */
const hoverApi = useSafeInject(advTableHoverLayerKey, 'RowActionBar')
const { t } = useAdvLocale()

/**
 * <zh/> collapsed 解析优先级：inject 的 hoverApi 为权威来源（inline 与 teleport 模式共用同一个 hoverLayerCollapsed ref），
 * <zh/>A 其次回退到 props.collapsed（独立使用 RowActionBar 且未提供 inject 时）。
 * <zh/>A 不能用 `props.collapsed ?? hoverApi?.hoverLayerCollapsed?.value`：
 * <zh/>A inline 模式下 buildCellContent 不传 collapsed prop，Vue 会把缺席的 Boolean prop 默认为 false，
 * <zh/>A 导致 `false ?? inject` 短路为 false，inject 的 hoverLayerCollapsed 永远无法生效，收起按钮失效。
 * <en/> collapsed resolution priority: the injected hoverApi is the authoritative source (inline and teleport modes share the same hoverLayerCollapsed ref),
 * <en/>A then falls back to props.collapsed (when RowActionBar is used standalone without inject).
 * <en/>A Must NOT use `props.collapsed ?? hoverApi?.hoverLayerCollapsed?.value`:
 * <en/>A in inline mode buildCellContent does not pass the collapsed prop, Vue defaults the absent Boolean prop to false,
 * <en/>A causing `false ?? inject` to short-circuit to false, so the injected hoverLayerCollapsed never takes effect and the collapse toggle breaks.
 */
const collapsed = computed(() => hoverApi?.hoverLayerCollapsed?.value ?? props.collapsed ?? false)

function onToggleCollapse(e: Event) {
  e.stopPropagation()
  e.preventDefault()
  if (hoverApi?.onToggleCollapse)
    hoverApi.onToggleCollapse(e)
  else
    emit('toggleCollapse', e)
}

/**
 * <zh/> Teleport 模式下操作栏 fixed 定位到 body，不在 table 滚动容器内。
 * <zh/> 滚轮事件通过 scrollBody 手动转发到表格滚动容器，使首次滚动即生效。
 * <zh/> 当 scrollBody 不可用或表格已到边缘时回退到 forceHide 策略。
 * <zh/> 中键按下（mousedown button 1）仍通过 forceHide 处理，避免自动滚动被劫持。
 * <en/> In Teleport mode, the action bar is fixed-positioned to body, outside the table scroll container.
 * <en/> Wheel events are manually forwarded to the table scroll container via scrollBody,
 * <en/> making the first wheel scroll the table. Falls back to forceHide when scrollBody is
 * <en/> unavailable or the table is at the scroll edge.
 * <en/> Middle-click auto-scroll still uses forceHide to avoid being hijacked.
 */
function handleScrollTrigger(e: WheelEvent | MouseEvent) {
  if (!props.isTeleport)
    return
  if ('deltaX' in e) {
    // WheelEvent — scroll the table manually
    const scrolled = hoverApi?.scrollBody?.(e.deltaX, e.deltaY) ?? false
    if (scrolled) {
      e.preventDefault()
    }
    else {
      // Table at edge or scrollBody unavailable — fall back to forceHide
      emit('forceHide')
    }
    return
  }
  // MouseEvent — only handle middle-click (button === 1) for auto-scroll
  if ('button' in e && e.button === 1) {
    emit('forceHide')
  }
}

const containerVisible = computed(() => tableContext?.containerVisible?.value ?? true)

/**
 * 延迟初始化 resize 监听：仅在 Teleport 模式下注册 window resize 监听器。
 * 行内模式不需要 windowWidth，避免不必要的 resize 监听和重渲染检查。
 *
 * SSR 安全：window 访问延迟到 onMounted，避免 setup 同步执行时
 * 在服务端环境抛 ReferenceError。
 * SSR safe: window access deferred to onMounted, avoids ReferenceError in server-side environment during setup synchronous execution.
 */
const windowWidth = ref<number>(0)
let windowSizeStop: (() => void) | null = null

function syncWindowSizeListener(teleport: boolean) {
  if (typeof window === 'undefined')
    return
  if (teleport && !windowSizeStop) {
    windowWidth.value = window.innerWidth
    windowSizeStop = useEventListener(window, 'resize', () => {
      windowWidth.value = window.innerWidth
    })
  }
  else if (!teleport && windowSizeStop) {
    windowSizeStop()
    windowSizeStop = null
  }
}

onMounted(() => syncWindowSizeListener(props.isTeleport))
watch(() => props.isTeleport, teleport => syncWindowSizeListener(teleport))

/**
 * <zh/> KeepAlive deactivate / 组件卸载时清理 window resize 监听器，避免泄漏
 * <en/> Clean up window resize listener on KeepAlive deactivate / unmount to prevent leak
 */
onBeforeUnmount(() => {
  windowSizeStop?.()
  windowSizeStop = null
})
onDeactivated(() => {
  windowSizeStop?.()
  windowSizeStop = null
})
onActivated(() => {
  if (props.isTeleport && !windowSizeStop) {
    syncWindowSizeListener(true)
  }
})

/**
 * <zh/> 根元素 ref——用于 inert 切换时 blur 已聚焦的子元素
 * <en/> Root element ref — used to blur focused descendant when inert toggles
 */
const rootRef = ref<HTMLElement | null>(null)

const allActions = computed<ActionConfig[]>((prev) => {
  const result = props.hoverOptionColumns.flatMap(col => col.actions ?? [])
  if (prev && prev.length === result.length && prev.every((item, i) => item === result[i]))
    return prev
  return result
})

const { visibleActions, isDisabled, handleClick } = useOptionButtons({
  actions: allActions,
  row: computed(() => props.row),
  index: computed(() => props.rowIndex),
})

/**
 * <zh/> 单源可见性——“该不该显”唯一的 JS 真相（替代 CSS :hover + !important 三方共治）。
 * <zh/> 在组件自身 render effect 内订阅 hoverRowKey（模式隔离）：hover 切换仅重渲染各行 bar
 * <zh/> 自身，不触碰 RowViewModel/CellState 计算链，不污染 EP 插槽 render effect。
 * <zh/> 置于 useOptionButtons 之后：`watch(isInert)` 在 setup 期即求值，引用后声明的
 * <zh/> `visibleActions` 会触发 TDZ，故单源块必须位于其后。
 * <zh/> - teleport：行外单实例，无行可比，由 hoverLayerVisible 统管（与旧语义逐字一致）；
 * <zh/> - inline：本行 key 与 hoverRowKey 相等才显；hoverRowKey 为 null 即藏；
 * <zh/> - 无 inject 独立使用：回退旧语义（visible 即显），保持向后兼容。
 * <zh/> 行 key 经 tableContext.rowKeyMeta.keyFn 推导，与 hover 层 effectiveRowKey 同源
 * <zh/> （模块级 WeakMap，同一行对象恒得同一 key）；hover 为空时短路，keyFn 零调用。
 * <en/> Single-source visibility — the sole JS truth of "should it show" (replacing the CSS
 * <en/> :hover + !important three-way rule). Subscribes hoverRowKey inside the component's own
 * <en/> render effect (-pattern isolation): hover switches only re-render each row's bar,
 * <en/> never touching the RowViewModel/CellState chain nor polluting EP slot render effects.
 * <en/> Placed after useOptionButtons: `watch(isInert)` evaluates during setup, referencing the
 * <en/> later-declared `visibleActions` would throw a TDZ error, so the single-source block must follow.
 * <en/> - teleport: single out-of-row instance, nothing to compare; governed by hoverLayerVisible
 * <en/>   (verbatim legacy semantics);
 * <en/> - inline: shown only when this row's key equals hoverRowKey; null hides;
 * <en/> - standalone without inject: falls back to legacy (visible shows), backward compatible.
 * <en/> Row keys derive via tableContext.rowKeyMeta.keyFn, same source as the hover layer's
 * <en/> effectiveRowKey (module-level WeakMap, one row object always yields one key); short-circuits
 * <en/> with zero keyFn calls when nothing hovers.
 */
const isSelfHovered = computed(() => {
  if (props.isTeleport)
    return true
  const hoverKey = hoverApi?.hoverRowKey?.value
  if (hoverKey == null)
    return hoverApi == null
  const keyFn = tableContext?.rowKeyMeta?.value?.keyFn
  if (!keyFn)
    return false
  let mine: unknown
  try {
    mine = keyFn(props.row)
  }
  catch {
    return false
  }
  return mine != null && String(mine) === String(hoverKey)
})

/**
 * <zh/> 生效可见性——`--visible` 类与 `data-hover-visible` 属性的共同来源。
 * <zh/> 附带修复：旧 `isInert` 仅看 props.visible，视觉隐藏的非悬停行仍可被辅助技术聚焦；
 * <zh/> 现与可见性同源，不可见即 inert。
 * <en/> Effective visibility — shared source of the `--visible` class and the `data-hover-visible`
 * <en/> attribute. Also fixes: the old `isInert` only watched props.visible, leaving visually hidden
 * <en/> non-hovered rows focusable to assistive tech; now sourced identically, invisible means inert.
 */
const isEffectivelyVisible = computed(() =>
  props.visible && visibleActions.value.length > 0 && containerVisible.value && isSelfHovered.value,
)

/**
 * <zh/> 是否应对辅助技术隐藏并阻止交互
 * <zh/> 使用 inert 替代 aria-hidden：inert 同时阻止 focus 和隐藏辅助技术可见性，
 * <zh/> 避免子元素聚焦后被 aria-hidden 遮挡引发浏览器警告
 * <zh/> 与单源可见性同源（置于其后：setup 期求值顺序要求）：不可见即 inert，
 * <zh/> 视觉隐藏的非悬停行不再可被辅助技术聚焦。
 * <en/> Whether to hide from assistive technology and prevent interaction
 * <en/> Uses inert instead of aria-hidden: inert simultaneously prevents focus and hides from AT,
 * <en/> avoiding browser warnings from focused descendants being hidden by aria-hidden
 * <en/> Sourced identically with single-source visibility (placed after it: setup-time evaluation
 * <en/> order requires it); invisible means inert, visually hidden non-hovered rows are no longer
 * <en/> focusable to assistive tech.
 */
const isInert = computed(() => !isEffectivelyVisible.value)

/**
 * <zh/> inert 切换为 true 时，主动 blur 容器内已聚焦的元素
 * <zh/> 兼容不支持 inert 属性的旧浏览器
 * <en/> When inert toggles to true, proactively blur the focused element within the container
 * <en/> Compatible with older browsers that don't support the inert attribute
 */
watch(isInert, (inert) => {
  if (inert && typeof document !== 'undefined') {
    const rootEl = rootRef.value
    if (rootEl && rootEl.contains(document.activeElement)) {
      ;(document.activeElement as HTMLElement).blur()
    }
  }
})

const hiddenStyle: CSSProperties = {
  position: 'fixed',
  top: '-9999px',
  left: '-9999px',
  /**
   * <zh/> 基类同时声明了 right: 0；隐藏态只改 left 会令 fixed 盒子的左右边同时生效，
   * <zh/> 宽度被拉伸为 9999px + 视口宽（实测 11439×900 的离屏盒子）。right: auto 让其按内容收缩。
   * <en/> The base class also sets right: 0; overriding only left makes both edges apply to the fixed box,
   * <en/> stretching its width to 9999px + viewport width (measured as an off-screen 11439×900 box). right: auto shrinks it to content.
   */
  right: 'auto',
  opacity: 0,
  pointerEvents: 'none',
  zIndex: -1,
}

const computedZIndex = computed<number | string>(() => props.zIndex ?? 'var(--el-index-top, 2000)')

const teleportStyle = computed<CSSProperties>(() => {
  if (!props.isTeleport)
    return {}
  if (!containerVisible.value || !props.rowRect)
    return hiddenStyle
  const rightOffset = windowWidth.value - props.rowRect.containerRight
  /**
   * <zh/> isScrolling 安全网：teleportRowRect 已在滚动开始时同步 invalidate，
   * <zh/> 但 prop 更新存在极端时序窗口（settle timer 先更新 rect 再置 isScrolling=false 的同帧内，
   * <zh/> props.isScrolling 仍为 true 而 props.rowRect 已有效），此分支确保该窗口内 bar 不可见。
   * <en/> isScrolling safety net: teleportRowRect is synchronously invalidated on scroll start,
   * <en/> but prop updates have an extreme timing window (within the same frame where settle timer
   * <en/> updates rect then sets isScrolling=false, props.isScrolling may still be true while
   * <en/> props.rowRect is already valid), this branch ensures the bar is invisible in that window.
   */
  if (props.isScrolling) {
    return {
      position: 'fixed',
      top: `${props.rowRect.top}px`,
      height: `${props.rowRect.height}px`,
      right: `${rightOffset}px`,
      /**
       * <zh/> 限制 action bar 最大宽度为容器可视宽度，防止按钮过多时溢出到容器左边缘之外。
       * <zh/> 配合 CSS __btns 的 overflow-x: auto，超出部分在按钮区域内滚动。
       * <en/> Limit action bar max width to container visible width, preventing overflow beyond container's left edge when there are too many buttons.
       * <en/> Combined with CSS __btns overflow-x: auto, excess content scrolls within the button area.
       */
      maxInlineSize: `${props.rowRect.containerRight - props.rowRect.containerLeft}px`,
      zIndex: computedZIndex.value,
      visibility: 'hidden',
      pointerEvents: 'none',
    }
  }
  return {
    position: 'fixed',
    top: `${props.rowRect.top}px`,
    height: `${props.rowRect.height}px`,
    right: `${rightOffset}px`,
    /**
     * <zh/> 限制 action bar 最大宽度为容器可视宽度，防止按钮过多时溢出到容器左边缘之外。
     * <zh/> 配合 CSS __btns 的 overflow-x: auto，超出部分在按钮区域内滚动。
     * <en/> Limit action bar max width to container visible width, preventing overflow beyond container's left edge when there are too many buttons.
     * <en/> Combined with CSS __btns overflow-x: auto, excess content scrolls within the button area.
     */
    maxInlineSize: `${props.rowRect.containerRight - props.rowRect.containerLeft}px`,
    zIndex: computedZIndex.value,
  }
})

const mergedStyle = computed<CSSProperties>(() => {
  if (props.isTeleport)
    return teleportStyle.value
  /** <zh/> hoverLayerStyle 从 inject 的 hoverApi 获取，不在插槽内读取 | <en/> hoverLayerStyle is obtained from the injected hoverApi, not read inside slots */
  const inlineStyle = hoverApi?.hoverLayerStyle?.value ?? props.style ?? {}
  return {
    ...inlineStyle,
    zIndex: computedZIndex.value,
  }
})

// 实际锁定逻辑由父级 useHoverLayer 通过 handleHoverLayerEnter/Leave 维护，
// 此处通过 emit('mouseenter' / 'mouseleave') 透传鼠标事件，父级在回调中清除延迟隐藏定时器。
// The actual lock logic is maintained by the parent useHoverLayer via handleHoverLayerEnter/Leave;
// here we forward mouse events via emit('mouseenter' / 'mouseleave'), and the parent clears
// the delayed-hide timer in the callback.
</script>

<template>
  <!--
    <zh/> Teleport :disabled 统一行内/Teleport 两种模式，消除模板重复：
    <en/> Teleport :disabled unifies inline/Teleport modes, eliminating template duplication:
    <zh/> - isTeleport=false：disabled=true，内容原地渲染在 cell 内（absolute 定位）
    <en/> - isTeleport=false: disabled=true, content renders in-place inside the cell (absolute positioning)
    <zh/> - isTeleport=true：disabled=false，内容传送到 body（fixed 定位）
    <en/> - isTeleport=true: disabled=false, content is teleported to body (fixed positioning)
    <zh/> 行内模式每行虽创建一个 Teleport VNode，但 disabled 时不产生额外 DOM，
    <en/> Inline mode creates one Teleport VNode per row, but when disabled it produces no extra DOM,
    <zh/> 开销可忽略；行内大数据量的真正瓶颈在按钮 DOM，通过下方 collapsed v-if 优化
    <en/> overhead is negligible; the real bottleneck for large inline data is button DOM, optimized via the collapsed v-if below
  -->
  <Teleport
    to="body"
    :disabled="!isTeleport"
  >
    <div
      ref="rootRef"
      class="adv-table-row-action-bar adv-table-row-action-bar--inline"
      :class="{
        'adv-table-row-action-bar--visible': isEffectivelyVisible,
        'adv-table-row-action-bar--collapsed': collapsed,
        'adv-table-row-action-bar--teleport': isTeleport,
      }"
      :data-hover-visible="isEffectivelyVisible ? 'true' : undefined"
      :style="mergedStyle"
      role="toolbar"
      :aria-label="t('table.rowAction')"
      :inert="isInert || undefined"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @wheel="handleScrollTrigger"
      @mousedown="handleScrollTrigger"
    >
      <!--
        <zh/> 使用 CSS --collapsed 类控制收起动画（max-inline-size + opacity + padding 过渡），
        <zh/> 而非 v-if 移除 DOM。原因：
        <zh/> 1. v-if 移除 DOM 会中断 CSS transition，收起/展开无动画，用户感知"没有收起"
        <zh/> 2. inline 模式下每行渲染 RowActionBar（VNode 常驻），可见性由单源
        <zh/>    `isEffectivelyVisible`（行 key == hoverRowKey）经 `--visible` /
        <zh/>    `data-hover-visible` 控制；同时只有一行可见，DOM 开销可控，无需 v-if 优化
        <zh/> 3. teleport 模式下全局仅一个 RowActionBar 实例，v-if 无性能收益
        <en/> Use CSS --collapsed class for collapse animation (max-inline-size + opacity + padding transition),
        <en/> instead of v-if removing DOM. Reasons:
        <en/> 1. v-if removing DOM interrupts CSS transition, collapse/expand has no animation, user perceives "didn't collapse"
        <en/> 2. In inline mode every row renders a RowActionBar (VNode resident), visibility governed by the
        <en/>    single-source `isEffectivelyVisible` (row key == hoverRowKey) via `--visible` /
        <en/>    `data-hover-visible`; only one row is visible at a time, DOM overhead is manageable, no v-if optimization needed
        <en/> 3. In teleport mode, there's only one global RowActionBar instance, v-if has no performance benefit
      -->
      <div class="adv-table-row-action-bar__btns">
        <!--
          <zh/> key 取 `${label}-${i}` 的原因：ActionConfig 无稳定 id 字段（仅 label），去索引会
          <zh/> 在 label 重复时碰撞；保留索引后缀则重排时复用错位风险极低（按钮无状态），为当前最优。
          <zh/> ActionConfig 补充 id 字段后改用它做 key。公共 API 冻结期不加字段。
          <en/> Why `${label}-${i}`: ActionConfig has no stable id field (label only); dropping the
          <en/> index suffix would collide on duplicate labels, while keeping it risks negligible
          <en/> mis-reuse on reorder (buttons are stateless) — the current optimum. Use an id field
          <en/> as the key once ActionConfig provides one. No new fields while the public API is frozen.
        -->
        <template
          v-for="(action, i) in visibleActions"
          :key="`${action.label}-${i}`"
        >
          <ElButton
            :type="action.type ?? 'primary'"
            :size="action.size ?? 'small'"
            :link="action.link ?? true"
            :disabled="isDisabled(action)"
            :icon="action.icon"
            v-bind="action.buttonProps"
            @click="handleClick(action, $event)"
          >
            {{ action.label }}
          </ElButton>
          <span
            v-if="i < visibleActions.length - 1"
            class="adv-table-row-action-bar__divider"
            aria-hidden="true"
          />
        </template>
      </div>
      <button
        type="button"
        class="adv-table-row-action-bar__toggle"
        :aria-label="collapsed ? t('table.rowActionExpand') : t('table.rowActionCollapse')"
        :aria-expanded="!collapsed"
        @click="onToggleCollapse"
      >
        <ElIcon :size="14">
          <ArrowLeft />
        </ElIcon>
      </button>
    </div>
  </Teleport>
</template>
