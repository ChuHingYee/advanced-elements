<!--
  @component FloatingFilterCell
  @displayName 浮动筛选单元格
  @displayName Floating Filter Cell
   @description <zh/> 只读展示当前筛选条件摘要；不承载 ColumnFilterPanel 的筛选逻辑，支持通过 floatingFilterComponent 注册自定义筛选组件
  @description <en/> Left readonly input shows current filter text, right reuses ColumnFilterPanel filter logic, supports custom filter component via floatingFilterComponent injection
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script lang="ts" setup>
import type { Component } from 'vue'
import type { ColumnFilterType, EnumFilterOption } from '../../types/column'
import type { ColumnFilterValue } from '../../types/filter'
import { ElInput } from 'element-plus'
import { computed } from 'vue'
import { formatFilterCondition } from '../../composables/data/use-column-filter'
import { useSafeInject } from '../../composables/shared/use-safe-inject'
import { advTableSharedFilterPopoverKey } from '../../types/config'
import ColumnFilterPanel from './column-filter-panel.vue'

const props = defineProps<{
  /** <zh/> 列的唯一标识 | <en/> unique identifier key of the column */
  columnKey: string
  /** <zh/> 筛选类型 | <en/> filter type */
  filterType: ColumnFilterType
  /** <zh/> 是否激活（存在筛选条件时高亮） | <en/> whether active (highlighted when filter condition exists) */
  active: boolean
  /** <zh/> 枚举筛选的选项列表 | <en/> option list for enum filter */
  enumOptions?: EnumFilterOption[] | (() => EnumFilterOption[])
  /** <zh/> 自定义浮动筛选组件 | <en/> custom floating filter component */
  floatingFilterComponent?: Component
  /** <zh/> 传递给自定义浮动筛选组件的额外参数 | <en/> extra params passed to the custom floating filter component */
  floatingFilterParams?: Record<string, any>
  /** <zh/> 国际化翻译函数 | <en/> i18n translation function */
  t?: (key: string) => string
  /** <zh/> 隐藏筛选按钮（suppressFloatingFilterButton） | <en/> hide filter button (suppressFloatingFilterButton) */
  suppressFilterButton?: boolean
}>()

/** <zh/> 当前筛选值（v-model 双向绑定） | <en/> current filter value (v-model two-way binding) */
const modelValue = defineModel<ColumnFilterValue>()

/** <zh/> 注入共享筛选弹层 API——由 table.vue 通过 provide 提供 | <en/> inject the shared filter popover API, provided by table.vue via provide */
const sharedPopover = useSafeInject(advTableSharedFilterPopoverKey, 'FloatingFilterCell')

/** <zh/> 解析后的枚举选项 | <en/> resolved enum options */
const resolvedEnumOptions = computed(() => {
  if (!props.enumOptions)
    return []
  return typeof props.enumOptions === 'function' ? props.enumOptions() : props.enumOptions
})

/** <zh/> 筛选条件的可读文字 | <en/> human-readable text of the filter condition */
const filterText = computed(() =>
  formatFilterCondition(modelValue.value, resolvedEnumOptions.value, props.t),
)

/**
  * <zh/> suppressFilterButton 模式下，输入框也可打开共享筛选弹层
 * <en/> In suppressFilterButton mode, clicking the input opens the shared filter popover.
 * <zh/> @click.stop 阻止冒泡；共享弹窗的 capture 阶段 click-outside 检测会识别
 * <en/> @click.stop prevents bubbling; the shared popover's capture-phase click-outside detection recognizes
  * <zh/> .adv-table-floating-filter__input--clickable 样式关闭
 * <en/> .adv-table-floating-filter__input--clickable and keeps it open.
 */
function handleInputClick(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement
  sharedPopover?.toggle(props.columnKey, target, props.filterType)
}
</script>

<template>
  <div class="adv-table-floating-filter">
    <!-- 自定义浮动筛选组件 | Custom floating filter component -->
    <component
      :is="floatingFilterComponent"
      v-if="floatingFilterComponent"
      :model-value="modelValue"
      :params="floatingFilterParams ?? {}"
      @update:model-value="modelValue = $event"
    />

    <!-- 默认：readonly 展示 + 复用 ColumnFilterPanel 的筛选按钮 -->
    <template v-else>
      <!--
        suppressFilterButton 模式下输入框行为为可点击的触发器，
        点击时调用 sharedPopover.toggle 由 table.vue 统一渲染 ElPopover。
        suppressFilterButton mode: the input acts as the shared popover trigger;
        clicking calls sharedPopover.toggle to open the ElPopover rendered centrally by table.vue.
      -->
      <template v-if="suppressFilterButton">
        <ElInput
          :model-value="filterText"
          size="small"
          readonly
          :placeholder="active ? '' : ' '"
          class="adv-table-floating-filter__input adv-table-floating-filter__input--clickable"
          :class="{
            'adv-table-floating-filter__input--active': active,
          }"
          @click.stop="handleInputClick"
          @mousedown.stop
        />
      </template>

      <!--
        正常模式：输入框 + ColumnFilterPanel（筛选图标触发器，同样委托共享弹窗）
        Normal mode: input + ColumnFilterPanel (filter icon trigger, also delegates to the shared popover)
      -->
      <template v-else>
        <ElInput
          :model-value="filterText"
          size="small"
          readonly
          :placeholder="active ? '' : ' '"
          class="adv-table-floating-filter__input"
          :class="{ 'adv-table-floating-filter__input--active': active }"
          @click.stop
          @mousedown.stop
        />
        <ColumnFilterPanel
          :column-key="columnKey"
          :filter-type="props.filterType"
          :active="active"
        />
      </template>
    </template>
  </div>
</template>
