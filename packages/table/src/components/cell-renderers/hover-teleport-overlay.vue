<!--
  @component HoverTeleportOverlay
  @displayName Teleport 悬浮操作条渲染域
  @displayName Hover Teleport Overlay
  @description <zh/> 从渲染器模板中隔离出的 teleport 悬浮操作条：只在本组件自身 render 内读取 hover 状态，避免父渲染器因 hover 变化重渲染整表
  @description <en/> Teleported hover action bar isolated from the renderer template: reads hover state only inside its own render, keeping parent renderer re-renders (and the full-row patch they cause) out of the hover path
  @category 数据展示 | Data Display
  @since 3.0.0
-->
<script setup lang="ts">
import { computed, inject } from 'vue'
import { advTableHoverLayerKey } from '../../types/injection-keys'
import { EMPTY_ROW } from '../../utils/shared'
import RowActionBar from './row-action-bar.vue'

defineOptions({ name: 'HoverTeleportOverlay' })

const api = inject(advTableHoverLayerKey, undefined)
const overlay = api?.teleportOverlay

/** <zh/> 仅 teleport 可用且渲染器已装配 overlay 域时渲染 | <en/> Renders only when teleport is usable and the renderer assembled the overlay domain */
const enabled = computed(() => !!overlay && api?.shouldUseTeleport.value === true)
/** <zh/> 与旧模板表达式逐字一致：可见且当前有悬停行 | <en/> Same expression as the old template: visible with a hovered row */
const visible = computed(() => api?.hoverLayerVisible.value === true && !!overlay?.hoverRowData.value)
</script>

<template>
  <RowActionBar
    v-if="enabled"
    :visible="visible"
    :collapsed="api?.hoverLayerCollapsed.value"
    :hover-option-columns="api?.hoverOptionColumns.value ?? []"
    :row="overlay?.hoverRowData.value ?? EMPTY_ROW"
    :row-index="overlay && overlay.hoverRowIndex.value >= 0 ? overlay.hoverRowIndex.value : 0"
    :row-rect="overlay?.rowRect.value"
    :is-scrolling="overlay?.isScrolling.value"
    :z-index="overlay?.zIndex.value"
    is-teleport
    @mouseenter="overlay?.onEnter()"
    @mouseleave="overlay?.onLeave()"
    @force-hide="overlay?.onForceHide()"
  />
</template>
