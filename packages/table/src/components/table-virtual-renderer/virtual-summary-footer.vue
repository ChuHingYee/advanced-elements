<!--
  @component VirtualSummaryFooter
  @displayName 虚拟滚动汇总表尾
  @displayName Virtual Summary Footer
  @description <zh/> 用于虚拟滚动模式（ElTableV2）的固定表尾，按左/中/右三区域并排排列汇总单元格（与 ElTableV2 的 fixed 列布局一致）。左/右固定区域使用 flex-shrink:0 固定宽度，主区域 flex:1 填充剩余空间并通过原生滚动与表体水平同步
  @description <en/> Fixed summary footer for virtual scrolling mode (ElTableV2), arranges summary cells in left/center/right areas side-by-side (consistent with ElTableV2's fixed column layout). Left/right fixed areas use flex-shrink:0 for fixed width, main area uses flex:1 to fill remaining space and syncs horizontal scrolling with the table body via native scroll
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script setup lang="ts">
import type { VNode } from 'vue'
import { computed, ref } from 'vue'
import SummaryCell from './summary-cell.vue'

interface SummaryCellItem {
  key: string
  value: string | VNode | undefined
  style: Record<string, any>
}

const props = defineProps<{
  leftCells: SummaryCellItem[]
  mainCells: SummaryCellItem[]
  rightCells: SummaryCellItem[]
  mainWidth?: number
  onScroll: (params: { scrollLeft: number, scrollTop: number }) => void
}>()

/**
 * <zh/> 主区域汇总行内联宽度——当列总宽 > 100%（needsFixedWidth=true）时显式设为总和，
 * <zh/> 避免 width:100% 限宽导致的单元格压缩与表体列宽失配；否则交由 CSS max-content/min-width 处理。
 * <en/> Main-area summary inline width — when total column width > 100% (needsFixedWidth=true),
 * <en/> set explicitly to the sum to avoid width:100% clamping and summary/body misalignment;
 * <en/> otherwise let the CSS max-content/min-width handle it.
 */
const mainSummaryStyle = computed(() => {
  if (props.mainWidth == null || props.mainWidth <= 0)
    return undefined
  const w = `${props.mainWidth}px`
  return { width: w, minWidth: w } as Record<string, string>
})

const scrollbarRef = ref<HTMLElement | null>(null)

/**
 * <zh/> 汇总条带实例契约——VirtualSummaryFooter 经模板 ref 暴露的唯一方法。
 * <zh/> 引用方（表尾滚动同步器）一律以此接口声明，禁止 `shallowRef<any>` 透传；
 * <zh/> 方法增删即编译报错，改名静默失配转为编译失败。
 * <en/> Summary-strip instance contract — the only method VirtualSummaryFooter exposes via template ref.
 * <en/> Referrers (the footer scroll synchronizer) must declare this interface, never `shallowRef<any>`;
 * <en/> adding/removing methods fails the build, turning silent rename drift into compile errors.
 */
export interface VirtualSummaryFooterExpose {
  /** <zh/> 将内层可滚动区置于指定横向位置 | <en/> Move the inner scrollable area to the given horizontal position */
  scrollTo: (scrollLeft: number) => void
}

function scrollTo(scrollLeft: number) {
  if (scrollbarRef.value)
    scrollbarRef.value.scrollLeft = scrollLeft
}

/** <zh/> 原生 scroll 事件适配：从 currentTarget 取出 scrollLeft/scrollTop 转发给 props.onScroll | <en/> Adapt native scroll event: read scrollLeft/scrollTop from currentTarget and forward to props.onScroll */
function handleNativeScroll(event: Event) {
  const target = event.currentTarget as HTMLElement
  props.onScroll({ scrollLeft: target.scrollLeft, scrollTop: target.scrollTop })
}

defineExpose({ scrollTo } satisfies VirtualSummaryFooterExpose)
</script>

<template>
  <div class="adv-table__v2-summary-wrapper">
    <div
      v-if="leftCells.length > 0"
      class="adv-table__v2-summary adv-table__v2-summary-fixed adv-table__v2-summary-fixed--left"
    >
      <div
        v-for="cell in leftCells"
        :key="cell.key"
        class="adv-table__v2-summary-cell"
        :style="cell.style"
      >
        <SummaryCell :value="cell.value" />
      </div>
    </div>
    <div
      ref="scrollbarRef"
      class="adv-table__v2-summary-scrollbar"
      @scroll="handleNativeScroll"
    >
      <div
        class="adv-table__v2-summary"
        :style="mainSummaryStyle"
      >
        <div
          v-for="cell in mainCells"
          :key="cell.key"
          class="adv-table__v2-summary-cell"
          :style="cell.style"
        >
          <SummaryCell :value="cell.value" />
        </div>
      </div>
    </div>
    <div
      v-if="rightCells.length > 0"
      class="adv-table__v2-summary adv-table__v2-summary-fixed adv-table__v2-summary-fixed--right"
    >
      <div
        v-for="cell in rightCells"
        :key="cell.key"
        class="adv-table__v2-summary-cell"
        :style="cell.style"
      >
        <SummaryCell :value="cell.value" />
      </div>
    </div>
  </div>
</template>
