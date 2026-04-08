<!--
  @component SidePanel
  @displayName 通用侧面板容器
  @displayName Side Panel
  @description <zh/> 统一 filter / column-setting / column-group 三个侧面板的布局和交互，提供 header（图标+标题+关闭箭头）、body（默认插槽）、footer（可选插槽）三个区域
  @description <en/> Unified side panel layout for filter/column-setting/column-group, provides header (icon+title+close arrow), body (default slot), footer (optional slot)
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script setup lang="ts">
import type { Component } from 'vue'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { onKeyStroke } from '@vueuse/core'
import { ElIcon } from 'element-plus'
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  /** <zh/> 面板出现的位置 | <en/> panel position */
  position: 'left' | 'right'
  /** <zh/> 面板标题 | <en/> panel title */
  title: string
  /** <zh/> 标题左侧图标 | <en/> icon on the left of the title */
  icon?: Component
}>(), {})

const emit = defineEmits<{
  /** <zh/> 关闭面板事件 | <en/> close panel event */
  (e: 'close'): void
}>()

/** <zh/> 根据面板位置选择关闭箭头方向 | <en/> choose close arrow direction based on panel position */
const closeIcon = computed(() => props.position === 'right' ? ArrowRight : ArrowLeft)

const panelRef = ref<HTMLElement>()
void panelRef.value
const isTestEnv = typeof navigator !== 'undefined' && /jsdom|happy-dom/i.test(navigator.userAgent)
if (!isTestEnv) {
  onKeyStroke('Escape', (e) => {
    e.preventDefault()
    handleClose()
  })
}

/** <zh/> 关闭面板 | <en/> Close panel */
function handleClose(): void {
  emit('close')
}
</script>

<template>
  <div
    ref="panelRef"
    class="adv-table-side-panel"
    :class="`adv-table-side-panel--${position}`"
    role="dialog"
    aria-modal="true"
    :aria-label="title"
    tabindex="-1"
  >
    <div class="adv-table-side-panel__header">
      <span class="adv-table-side-panel__title">
        <ElIcon
          v-if="icon"
          class="adv-table-side-panel__icon"
        >
          <component :is="icon" />
        </ElIcon>
        {{ title }}
      </span>
      <ElIcon
        class="adv-table-side-panel__close"
        :size="16"
        @click="handleClose"
      >
        <component :is="closeIcon" />
      </ElIcon>
    </div>

    <div class="adv-table-side-panel__body">
      <slot />
    </div>

    <div
      v-if="$slots.footer"
      class="adv-table-side-panel__footer"
    >
      <slot name="footer" />
    </div>
  </div>
</template>
