<!--
  @component TableFooter
  @displayName 分页底栏
  @displayName Table Footer
  @description <zh/> 分页底栏组件，启用分页时渲染 ElPagination 组件，支持 footer-extra 插槽
  @description <en/> Pagination footer component, renders ElPagination when pagination is enabled, supports footer-extra slot
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script lang="ts" setup>
/**
 * <zh/> 分页底栏组件
 * <en/> Pagination footer component
 * <zh/> - 启用分页时渲染 ElPagination 组件（右侧）
 * <en/> - Renders ElPagination component when pagination is enabled (right side)
 * <zh/> - footer-extra 插槽：分页左侧的额外内容区域
 * <en/> - footer-extra slot: extra content area on the left of pagination
 * <zh/> - footer 插槽：完全替换整个底栏，接收分页信息作为作用域参数
 * <en/> - footer slot: fully replaces the entire footer, receives pagination info as scoped params
 * <zh/> - 手动加载模式下显示"加载更多"按钮
 * <en/> - Shows "load more" button in manual-load mode
 */
import { ElButton, ElPagination } from 'element-plus'
import { computed } from 'vue'

const props = defineProps<{
  /** <zh/> 是否启用分页功能 | <en/> whether pagination is enabled */
  paginationEnabled: boolean
  /** <zh/> 分页器的自定义 class | <en/> custom class for the paginator */
  paginationClass: string | string[] | Record<string, boolean>
  /** <zh/> 是否为手动加载模式（点击"加载更多"而非翻页） | <en/> whether in manual-load mode (click "load more" instead of paging) */
  isManual: boolean
  /** <zh/> 手动模式下是否还有更多数据可供加载 | <en/> whether more data is available in manual mode */
  hasMore: boolean
  /** <zh/> 加载更多时是否显示加载中状态 | <en/> whether to show loading state when loading more */
  loading: boolean
  /** <zh/> 国际化翻译函数 | <en/> i18n translation function */
  t: (key: string) => string
  /** <zh/> 透传给 ElPagination 的额外属性（如 hide-on-single-page 等） | <en/> extra props passed to ElPagination (e.g. hide-on-single-page) */
  tableAttrs: Record<string, any>
  /** <zh/> Element Plus 组件尺寸规格 | <en/> Element Plus component size spec */
  elementSize?: string
  /** <zh/> ElPagination 的 ref 引用 | <en/> ref of ElPagination */
  paginationRef?: any
  /** <zh/> 当前页码 | <en/> current page number */
  currentPage: number
  /** <zh/> 每页条数 | <en/> page size */
  pageSize: number
  /** <zh/> 可选的每页条数选项列表 | <en/> optional page size options list */
  pageSizes: number[]
  /** <zh/> 分页布局配置 | <en/> pagination layout config */
  layout: string
  /** <zh/> 数据总条数 | <en/> total data count */
  total: number
  /** <zh/> 是否存在 footer 插槽内容 | <en/> whether footer slot content exists */
  hasFooterSlot: boolean
  /** <zh/> 是否存在 footer-extra 插槽内容 | <en/> whether footer-extra slot content exists */
  hasFooterExtraSlot: boolean
}>()

const emit = defineEmits<{
  (e: 'loadMore'): void
  /**
   * <zh/> 当前页变更——刻意保持 camel（`update:currentPage`）：
   * <zh/> 与 ElPagination 的 kebab（`update:current-page`）口径不一致，但 Vue 对 `update:` 事件
   * <zh/> 做 camel↔kebab 归一化，双写法监听均可触发；且 `footer.test.ts` 已锁定 camel 断言，
   * <zh/> 公共 API 冻结期不改名。监听侧（AdvTable/ElPagination）用 kebab 即可。
   * <en/> Current page change — deliberately kept camel (`update:currentPage`):
   * <en/> inconsistent with ElPagination's kebab (`update:current-page`), but Vue normalizes
   * <en/> camel↔kebab for `update:` events so both listener spellings fire; `footer.test.ts`
   * <en/> locks the camel assertion and the public API is frozen, so no rename. Listeners
   * <en/> (AdvTable/ElPagination) may use kebab.
   */
  (e: 'update:currentPage', val: number): void
  /**
   * <zh/> 每页条数变更——同上，保持 camel，原因同上。
   * <en/> Page size change — same as above, kept camel for the same reason.
   */
  (e: 'update:pageSize', val: number): void
}>()

/** <zh/> 加载更多 | <en/> Load more */
function handleLoadMore(): void {
  emit('loadMore')
}

/** <zh/> 当前页变更 | <en/> Current page change */
function handleCurrentPageChange(val: number): void {
  emit('update:currentPage', val)
}

/** <zh/> 每页条数变更 | <en/> Page size change */
function handlePageSizeChange(val: number): void {
  emit('update:pageSize', val)
}

/** <zh/> 传递给 footer 插槽的分页信息 | <en/> pagination info passed to the footer slot */
const paginationInfo = computed(() => ({
  currentPage: props.currentPage,
  pageSize: props.pageSize,
  total: props.total,
}))

const shouldRender = computed(() => {
  if (props.hasFooterSlot)
    return true
  if (props.hasFooterExtraSlot)
    return true
  if (!props.paginationEnabled)
    return false

  if (props.isManual)
    return true

  if (props.total <= 0)
    return false

  const hideOnSinglePage = props.tableAttrs?.['hide-on-single-page'] ?? false
  const totalPages = Math.ceil(props.total / props.pageSize)
  if (hideOnSinglePage && totalPages <= 1)
    return false

  return true
})
</script>

<template>
  <div
    v-if="shouldRender"
    class="adv-table__page"
    :class="paginationEnabled ? paginationClass : ''"
  >
    <!-- footer 插槽：完全替换底栏内容 | footer slot: fully replaces footer content -->
    <template v-if="hasFooterSlot">
      <slot
        name="footer"
        v-bind="paginationInfo"
      />
    </template>
    <!-- 默认布局：左侧 extra + 右侧分页 | Default layout: left extra + right pagination -->
    <template v-else>
      <div class="adv-table__page-left">
        <slot name="footer-extra" />
      </div>
      <div class="adv-table__page-right">
        <template v-if="paginationEnabled && isManual">
          <ElButton
            v-if="hasMore"
            :loading="loading"
            @click="handleLoadMore"
          >
            {{ t('table.loadMore') }}
          </ElButton>
          <span v-else-if="!hasMore && !loading">{{
            t('table.noMore')
          }}</span>
        </template>
        <template v-else>
          <ElPagination
            v-if="paginationEnabled && total > 0"
            :ref="paginationRef"
            :current-page="currentPage"
            v-bind="tableAttrs"
            :small="elementSize === 'small'"
            :page-size="pageSize"
            :page-sizes="pageSizes"
            :layout="layout"
            :total="total"
            @update:current-page="handleCurrentPageChange"
            @update:page-size="handlePageSizeChange"
          />
        </template>
      </div>
    </template>
  </div>
</template>
