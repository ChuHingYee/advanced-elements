<!--
  @component ContextMenuHost
  @displayName 右键菜单宿主
  @displayName Context Menu Host
  @description <zh/> 右键菜单的渲染宿主：菜单态的唯一消费点，隔离 AdvTable 根渲染效应
  @description <en/> Render host for the context menu: the only consumer of menu state, isolating the AdvTable root render effect
  @category 数据展示 | Data Display
  @since 2.2.0
-->
<script setup lang="ts">
import type { ContextMenuItemOrSeparator, ContextMenuParams } from '../../types/context-menu'
import ContextMenu from './context-menu.vue'

/**
 * <zh/> 菜单域解包形状（reactive 代理下 ref/computed 已解包）——仅声明本组件消费的字段，
 * <zh/> 不复用 useContextMenuOrchestrator 返回类型（其 Ref 属性与代理传参类型不匹配）。
 * <en/> Unwrapped menu-domain shape (refs/computeds unwrapped through the reactive proxy) — declares
 * <en/> only the fields this host consumes; the raw useContextMenuOrchestrator return type does not
 * <en/> match a reactive-proxy prop (its Ref properties arrive unwrapped).
 */
interface MenuDomain {
  menuVisible: boolean
  menuStyle: { left: string, top: string }
  currentItems: ContextMenuItemOrSeparator<any>[][]
  currentParams: ContextMenuParams<any> | null
  menuToken: number
  setMenuElRef: (el: unknown) => void
  closeMenu: () => void
  onMenuItemClick: (item: ContextMenuItemOrSeparator<any>) => void
}

const props = defineProps<{
  /**
   * <zh/> 菜单域（reactive 代理）——menuVisible/menuStyle/currentItems/currentParams/menuToken
   * <zh/> 只允许在本组件模板内读取：根模板一旦读取这些高频态，每次右键打开都会经
   * <zh/> DYNAMIC_SLOTS 强制重渲染整表体（实测 100 行均摊 ≈42ms/次）。
   * <en/> Menu domain (reactive proxy) — menuVisible/menuStyle/currentItems/currentParams/menuToken
   * <en/> may only be read inside THIS component's template: once the root template reads these
   * <en/> high-frequency states, every menu open force-re-renders the whole tbody via DYNAMIC_SLOTS
   * <en/> (measured ≈42ms per open amortized at 100 rows).
   */
  menu: MenuDomain
  /**
   * <zh/> 交互域——仅读 isContainerVisible（容器零宽/deactivated 时菜单随隐）；它由
   * <zh/> ResizeObserver 驱动，读进根效应会让窗口拖拽缩放逐帧重渲染根节点。
   * <en/> Interaction domain — reads isContainerVisible only (menu hides with a zero-width or
   * <en/> deactivated container); it is ResizeObserver-driven, so a root-effect read would re-render
   * <en/> the root every frame during window drag-resize.
   */
  interaction: { isContainerVisible: boolean }
}>()

/**
 * <zh/> 菜单元素引用转发——ContextMenu 根元素经局部 ref 供二次校正 O(1) 度量，避免 document 全局扫
 * <en/> Forward the menu root element for O(1) re-measure in repositioning
 */
function setContextMenuRef(inst: unknown): void {
  try {
    const el = (inst as { $el?: unknown } | null)?.$el ?? inst ?? null
    props.menu.setMenuElRef(el)
  }
  catch {
    // <zh/> ref 转发异常不影响菜单主体 | <en/> Ref-forward failures must not break the menu
  }
}
</script>

<template>
  <ContextMenu
    :ref="setContextMenuRef"
    :visible="menu.menuVisible && interaction.isContainerVisible"
    :style="menu.menuStyle"
    :items="menu.currentItems"
    :params="menu.currentParams"
    :menu-token="menu.menuToken"
    @close="menu.closeMenu"
    @item-click="menu.onMenuItemClick"
  />
</template>
