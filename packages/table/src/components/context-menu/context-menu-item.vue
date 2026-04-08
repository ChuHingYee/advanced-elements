<!--
  @component ContextMenuItem
  @displayName 右键菜单项
  @displayName Context Menu Item
  @description <zh/> 渲染单个菜单项，支持图标、选中标记、快捷键后缀、子菜单箭头，并处理子菜单的延迟打开/关闭
  @description <en/> Renders a single menu item, supports icon, checkmark, shortcut suffix, submenu arrow, and handles submenu delayed open/close
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script lang="ts" setup generic="T">
import type { ContextMenuItem } from '../../types/context-menu'
import { onBeforeUnmount, onDeactivated } from 'vue'

const props = defineProps<{
  /** <zh/> 菜单项数据 | <en/> menu item data */
  item: ContextMenuItem<T>
  /** <zh/> 当前项是否获得焦点（键盘导航高亮） | <en/> whether the current item is focused (keyboard navigation highlight) */
  focused: boolean
  /** <zh/> 当前项的子菜单是否已展开 | <en/> whether the current item's submenu is expanded */
  expanded: boolean
}>()

const emit = defineEmits<{
  /** <zh/> 点击菜单项 | <en/> click menu item */
  (e: 'click'): void
  /** <zh/> 鼠标进入菜单项 | <en/> mouse enter menu item */
  (e: 'mouseenter'): void
  /** <zh/> 子菜单打开 | <en/> submenu open */
  (e: 'submenuOpen'): void
  /** <zh/> 子菜单关闭 | <en/> submenu close */
  (e: 'submenuClose'): void
}>()

const SUBMENU_OPEN_DELAY = 150
const SUBMENU_CLOSE_DELAY = 200

let openTimer: ReturnType<typeof setTimeout> | null = null
let closeTimer: ReturnType<typeof setTimeout> | null = null

function clearTimers() {
  if (openTimer) {
    clearTimeout(openTimer)
    openTimer = null
  }
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
}

function handleMouseenter() {
  emit('mouseenter')
  if (!props.item.children?.length)
    return
  clearTimers()
  closeTimer = null
  openTimer = setTimeout(() => {
    emit('submenuOpen')
    openTimer = null
  }, SUBMENU_OPEN_DELAY)
}

function handleMouseleave() {
  if (!props.item.children?.length)
    return
  clearTimers()
  openTimer = null
  closeTimer = setTimeout(() => {
    emit('submenuClose')
    closeTimer = null
  }, SUBMENU_CLOSE_DELAY)
}

onBeforeUnmount(() => {
  clearTimers()
})

onDeactivated(() => {
  clearTimers()
})
</script>

<template>
  <div
    class="adv-table-context-menu-item"
    :class="{
      'adv-table-context-menu-item--focused': focused,
      'adv-table-context-menu-item--expanded': expanded,
      'adv-table-context-menu-item--disabled': item.disabled,
      'adv-table-context-menu-item--loading': item.loading,
    }"
    role="menuitem"
    :tabindex="item.disabled || item.loading ? -1 : (focused ? 0 : -1)"
    :aria-disabled="item.disabled || item.loading"
    :aria-haspopup="item.children?.length ? 'menu' : undefined"
    :aria-expanded="item.children?.length ? expanded : undefined"
    @click="!item.disabled && !item.loading && emit('click')"
    @mouseenter="handleMouseenter"
    @mouseleave="handleMouseleave"
  >
    <span
      v-if="item.checked && !item.prefixIcon"
      class="adv-table-context-menu-item__check"
    >
      <svg
        viewBox="0 0 16 16"
        width="12"
        height="12"
        fill="currentColor"
      ><path d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z" /></svg>
    </span>
    <span
      v-else-if="item.prefixIcon"
      class="adv-table-context-menu-item__prefix"
    >
      <component
        :is="item.prefixIcon"
        v-if="typeof item.prefixIcon !== 'string'"
        class="adv-table-context-menu-item__icon"
      />
      <i
        v-else
        :class="item.prefixIcon"
        class="adv-table-context-menu-item__icon"
      />
    </span>
    <span class="adv-table-context-menu-item__label">{{ item.name }}</span>
    <span
      v-if="item.suffix"
      class="adv-table-context-menu-item__suffix"
    >
      <component
        :is="item.suffix.icon"
        v-if="item.suffix.icon && typeof item.suffix.icon !== 'string'"
        class="adv-table-context-menu-item__icon"
      />
      <i
        v-else-if="item.suffix.icon"
        :class="item.suffix.icon"
        class="adv-table-context-menu-item__icon"
      />
      <span
        v-if="item.suffix.content"
        class="adv-table-context-menu-item__shortcut"
      >{{ item.suffix.content }}</span>
    </span>
    <span
      v-if="item.children?.length"
      class="adv-table-context-menu-item__arrow"
    >
      <svg
        viewBox="0 0 16 16"
        width="12"
        height="12"
        fill="currentColor"
      ><path d="M6 3l5 5-5 5V3z" /></svg>
    </span>
  </div>
</template>
