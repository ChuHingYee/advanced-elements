<!--
  @component ContextMenu
  @displayName 右键菜单
  @displayName Context Menu
  @description <zh/> 右键菜单组件，支持菜单项分组、分隔线、嵌套子菜单及键盘导航
  @description <en/> Context menu component, supports menu item groups, separators, nested submenus, and keyboard navigation
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script lang="ts" setup generic="T">
/**
 * <zh/> ContextMenu — 右键菜单组件
 * <en/> ContextMenu — right-click context menu component
 *
 * <zh/> 支持菜单项分组、分隔线、嵌套子菜单，以及键盘导航（方向键/回车/Esc）。
 * <en/> Supports menu item groups, separators, nested submenus, and keyboard navigation (arrows/Enter/Esc).
 * <zh/> 子菜单会根据视口位置自动调整展开方向，避免溢出屏幕。
 * <en/> Submenus auto-adjust their open direction based on viewport position to avoid overflowing the screen.
 */
import type { ContextMenuItemOrSeparator, ContextMenuItem as ContextMenuItemType, ContextMenuParams } from '../../types/context-menu'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { isMenuItem } from '../../composables/features/use-context-menu'
import ContextMenuItem from './context-menu-item.vue'

/**
 * <zh/> Props 定义 | <en/> Props definition
 */
const props = defineProps<{
  /** <zh/> 是否显示菜单 | <en/> whether the menu is visible */
  visible: boolean
  /** <zh/> 菜单位置样式（left/top 像素值） | <en/> menu position style (left/top pixel values) */
  style: { left: string, top: string }
  /** <zh/> 菜单项二维数组，外层按组分组，组内可包含菜单项或分隔线 | <en/> 2D menu item array, outer array groups items, each group may contain items or separators */
  items: ContextMenuItemOrSeparator<T>[][]
  /** <zh/> 右键触发时的上下文参数 | <en/> context params at right-click trigger */
  params: ContextMenuParams<T> | null
  /** <zh/> 菜单层级（0 为根菜单，子菜单递增），用于计算 z-index | <en/> menu nesting level (0 is root, increments for submenus), used to compute z-index */
  level?: number
  /**
   * <zh/> 本次打开的菜单令牌——根菜单渲染为 `data-adv-table-menu-token` 属性，
   * <zh/> teleport 到 body 后宿主按令牌找回自家菜单，多实例互不干扰。
   * <en/> Token of the current menu open — rendered as a `data-adv-table-menu-token` attribute on the
   * <en/> root menu so the host finds its own teleported menu by token across coexisting instances.
   */
  menuToken?: number
}>()

/**
 * <zh/> 事件:
 * <en/> Events:
 * <zh/> - close: 关闭菜单（Esc 键、点击外部、子菜单返回等场景触发）
 * <en/> - close: close the menu (triggered by Esc, outside click, submenu return, etc.)
 * <zh/> - itemClick: 点击菜单项时触发，携带被点击的菜单项对象
 * <en/> - itemClick: triggered when a menu item is clicked, carries the clicked item object
 */
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'itemClick', item: ContextMenuItemType<T>): void
}>()

const menuRef = ref<HTMLElement | null>(null)
const focusedIndex = ref(-1)
const expandedIndex = ref(-1)
const submenuStyle = ref<{ left: string, top: string }>({ left: '0px', top: '0px' })

// <zh/> 用模板 ref 替代 document.querySelectorAll 全局 DOM 查询
// <en/> Replace document.querySelectorAll global DOM query with a template ref
const submenuEl = ref<HTMLElement | null>(null)

function setSubmenuRef(instance: any) {
  submenuEl.value = instance?.$el as HTMLElement | null
}

const computedStyle = computed(() => {
  const nestingLevel = props.level ?? 0
  const base = nestingLevel > 0 ? submenuStyle.value : props.style
  if (nestingLevel > 0) {
    return { ...base, zIndex: 3000 + nestingLevel }
  }
  return base
})

const flatItems = shallowRef<ContextMenuItemOrSeparator<T>[]>([])

watch(() => props.items, (items) => {
  flatItems.value = items.flat()
  focusedIndex.value = -1
  expandedIndex.value = -1
}, { immediate: true })

function asMenuItem(item: ContextMenuItemOrSeparator<T>): ContextMenuItemType<T> {
  return item as ContextMenuItemType<T>
}

function getClickableIndices(): number[] {
  return flatItems.value
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => isMenuItem(item) && item.visible !== false && !item.disabled && !item.loading)
    .map(({ i }) => i)
}

function getSubmenuItem(index: number): ContextMenuItemType<T> | null {
  const item = flatItems.value[index]
  if (!item || !isMenuItem(item) || !item.children?.length)
    return null
  return item
}

/**
 * <zh/> 当前展开项的子菜单 items（模板每次渲染新建数组改为 computed 缓存引用稳定）
 * <en/> Expanded submenu items (computed instead of per-render array literal)
 */
const expandedSubmenuItems = computed(() => {
  const item = getSubmenuItem(expandedIndex.value)
  return item?.children ? [item.children] : []
})

function openSubmenu(index: number) {
  if (expandedIndex.value === index)
    return
  expandedIndex.value = index
  positionSubmenu(index)
}

function closeSubmenu() {
  expandedIndex.value = -1
}

function positionSubmenu(index: number) {
  nextTick(() => {
    const menuEl = menuRef.value
    if (!menuEl)
      return
    const items = menuEl.querySelectorAll('.adv-table-context-menu-item')
    const targetEl = items[index] as HTMLElement | undefined
    if (!targetEl)
      return

    const rect = targetEl.getBoundingClientRect()
    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 0
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 0
    const padding = 4

    let left = rect.right
    let top = rect.top

    // <zh/> 使用模板 ref 获取子菜单元素尺寸，替代 document.querySelectorAll 全局查询
    // <en/> Use template ref to get submenu element dimensions, replacing document.querySelectorAll global query
    const actualW = submenuEl.value?.offsetWidth ?? 180
    const actualH = submenuEl.value?.offsetHeight ?? (getSubmenuItem(index)?.children?.flat().length ?? 1) * 32

    if (left + actualW + padding > viewportW)
      left = rect.left - actualW
    if (top + actualH + padding > viewportH)
      top = viewportH - actualH - padding

    left = Math.max(padding, left)
    top = Math.max(padding, top)

    submenuStyle.value = { left: `${left}px`, top: `${top}px` }
  })
}

function handleSubmenuOpen(index: number) {
  openSubmenu(index)
}

function handleSubmenuClose() {
  closeSubmenu()
}

function handleSubmenuItemClick(item: ContextMenuItemType<T>) {
  emit('itemClick', item)
}

function handleSubmenuCloseFromChild() {
  closeSubmenu()
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.visible)
    return

  const clickable = getClickableIndices()

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!clickable.length)
      return
    const currentPos = clickable.indexOf(focusedIndex.value)
    const nextPos = currentPos < clickable.length - 1 ? currentPos + 1 : 0
    focusedIndex.value = clickable[nextPos]
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (!clickable.length)
      return
    const currentPos = clickable.indexOf(focusedIndex.value)
    const nextPos = currentPos > 0 ? currentPos - 1 : clickable.length - 1
    focusedIndex.value = clickable[nextPos]
  }
  else if (e.key === 'ArrowRight') {
    const item = getSubmenuItem(focusedIndex.value)
    if (item) {
      e.preventDefault()
      openSubmenu(focusedIndex.value)
    }
  }
  else if (e.key === 'ArrowLeft') {
    if (expandedIndex.value >= 0) {
      e.preventDefault()
      closeSubmenu()
    }
    else if ((props.level ?? 0) > 0) {
      e.preventDefault()
      emit('close')
    }
  }
  else if (e.key === 'Enter' && focusedIndex.value >= 0) {
    e.preventDefault()
    const item = flatItems.value[focusedIndex.value]
    if (item && isMenuItem(item) && !item.disabled && !item.loading) {
      if (item.children?.length) {
        openSubmenu(focusedIndex.value)
      }
      else {
        emit('itemClick', item)
      }
    }
  }
  else if (e.key === 'Escape') {
    e.preventDefault()
    if (expandedIndex.value >= 0) {
      closeSubmenu()
    }
    else {
      emit('close')
    }
  }
}

watch(() => props.visible, (visible) => {
  if (visible) {
    focusedIndex.value = -1
    expandedIndex.value = -1
    nextTick(() => {
      menuRef.value?.focus()
    })
  }
})

onBeforeUnmount(() => {
  expandedIndex.value = -1
})
</script>

<template>
  <Teleport to="body">
    <Transition name="adv-table-context-menu">
      <div
        v-if="visible"
        ref="menuRef"
        class="adv-table-context-menu"
        :class="{ 'adv-table-context-menu--submenu': (level ?? 0) > 0 }"
        :data-adv-table-menu-token="menuToken"
        :style="computedStyle"
        tabindex="-1"
        role="menu"
        @keydown="handleKeydown"
      >
        <template
          v-for="(group, gi) in items"
          :key="`group-${gi}-${group.map(i => i.code).join('|')}`"
        >
          <div class="adv-table-context-menu__group">
            <template
              v-for="(item, ii) in group"
              :key="item.code === 'separator' ? `sep-${gi}-${ii}-${group.length}` : item.code"
            >
              <div
                v-if="item.code === 'separator'"
                class="adv-table-context-menu-separator"
                role="separator"
              />
              <ContextMenuItem
                v-else
                :item="asMenuItem(item)"
                :focused="flatItems.indexOf(item) === focusedIndex"
                :expanded="flatItems.indexOf(item) === expandedIndex"
                @click="asMenuItem(item).children?.length ? openSubmenu(flatItems.indexOf(item)) : emit('itemClick', asMenuItem(item))"
                @mouseenter="focusedIndex = flatItems.indexOf(item)"
                @submenu-open="handleSubmenuOpen(flatItems.indexOf(item))"
                @submenu-close="handleSubmenuClose"
              />
            </template>
          </div>
        </template>
      </div>
    </Transition>

    <Transition name="adv-table-context-menu">
      <ContextMenu
        v-if="expandedIndex >= 0 && getSubmenuItem(expandedIndex)"
        :key="`submenu-${getSubmenuItem(expandedIndex)?.code ?? expandedIndex}`"
        :ref="setSubmenuRef"
        :visible="true"
        :style="submenuStyle"
        :items="expandedSubmenuItems"
        :params="params"
        :level="(level ?? 0) + 1"
        @close="handleSubmenuCloseFromChild"
        @item-click="handleSubmenuItemClick"
      />
    </Transition>
  </Teleport>
</template>
