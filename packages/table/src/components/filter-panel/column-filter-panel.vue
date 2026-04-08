<!--
  @component ColumnFilterPanel
  @displayName 列筛选面板触发器
  @displayName Column Filter Panel
  @description <zh/> 表头列的筛选图标按钮，点击图标时通过 inject 获取共享筛选弹窗 API 调用 toggle
  @description <en/> Column header filter icon button, uses inject to get shared filter popover API and calls toggle on click
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script lang="ts" setup>
import type { ColumnFilterType } from '../../types/column'
import { Filter } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'
import { computed } from 'vue'
import { useSafeInject } from '../../composables/shared/use-safe-inject'
import { advTableSharedFilterPopoverKey } from '../../types/config'
import { useRendererLocale } from '../renderer-core/render-helpers'

/**
 * <zh/> 列筛选面板触发器属性。
 * <en/> Column filter panel trigger props.
 */
interface ColumnFilterPanelProps {
  /** <zh/> 列的唯一标识键。 | <en/> unique identifier key of the column. */
  columnKey: string
  /** <zh/> 筛选类型：text（文本）/ number（数值）/ date（日期）/ enum（枚举）。 | <en/> filter type: text / number / date / enum. */
  filterType: ColumnFilterType
  /** <zh/> 当前列是否有激活的筛选条件（控制筛选图标的高亮状态）。 | <en/> whether the current column has an active filter condition (controls filter icon highlight). */
  active: boolean
}

const props = defineProps<ColumnFilterPanelProps>()

/** <zh/> 注入共享筛选弹窗 API——由 table.vue 通过 provide 提供 | <en/> inject the shared filter popover API, provided by table.vue via provide */
const sharedPopover = useSafeInject(advTableSharedFilterPopoverKey, 'ColumnFilterPanel')

/** <zh/> 国际化翻译函数 | <en/> i18n translation function */
const { t: tFn } = useRendererLocale()
const t = tFn()

/** <zh/> aria-label 走 i18n，t 不可用时回退到硬编码 | <en/> aria-label via i18n, falls back to hardcoded when t is unavailable */
const ariaLabel = computed(() => {
  if (t) {
    return props.active ? t('table.filterClear') : t('table.filterOpen')
  }
  return props.active ? '清除筛选' : '打开筛选'
})

/**
 * <zh/> 点击筛选图标——调用共享弹窗的 toggle 方法。
 * <en/> Click the filter icon — call the shared popover's toggle method.
 * <zh/> @click.stop 阻止冒泡，避免触发表头点击事件；
 * <en/> @click.stop prevents bubbling to avoid triggering the header click event;
 * <zh/> 共享弹窗的 capture 阶段 click-outside 检测会识别 .adv-table__filter-trigger 不关闭。
 * <en/> the shared popover's capture-phase click-outside detection recognizes .adv-table__filter-trigger and keeps it open.
 */
function handleClick(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement
  sharedPopover?.toggle(props.columnKey, target, props.filterType)
}

/**
 * <zh/> 键盘激活筛选——Enter / Space 触发与点击等价的操作，保证键盘可访问性。
 * <en/> Keyboard activation — Enter / Space triggers an operation equivalent to click, ensuring keyboard accessibility.
 */
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    sharedPopover?.toggle(props.columnKey, target, props.filterType)
  }
}
</script>

<template>
  <ElIcon
    class="adv-table__filter-trigger"
    :class="{ 'adv-table__filter-trigger--active': active }"
    role="button"
    tabindex="0"
    :aria-label="ariaLabel"
    style="user-select: none"
    @click.stop="handleClick"
    @keydown.stop="handleKeydown"
    @mousedown.stop.prevent
  >
    <Filter />
  </ElIcon>
</template>
