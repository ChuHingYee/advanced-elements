<script setup lang="ts">
import { ref } from 'vue'
import { demoCategories } from './table-demo/categories'
import { provideDemoContext } from './table-demo/demo-context'
import { sectionRegistry } from './table-demo/section-registry'
import { useDemoLocal } from './table-demo/use-demo-local'
import { useTableDemoState } from './table-demo/use-table-demo-state'
import './table-demo/demo.scss'
import '@advanced-elements/table/style/index.scss'

// <zh/> 壳层状态：仅导航与挂载 | <en/> Shell state: navigation and mounting only
const selectedDemo = ref('mega')

// <zh/> 全量演示绑定单点下发：状态域展开 + 本地 fixtures 展开 + 壳层选中项；键集合与拆分前一致，sections 零改动
// <en/> All demo bindings provided in one spot: state spread + local-fixture spread + the shell's selected value; the key set matches pre-split exactly, sections untouched
const demoState = useTableDemoState()
const demoLocal = useDemoLocal()
provideDemoContext({ ...demoState, ...demoLocal, selectedDemo })
</script>

<template>
  <div class="table-demo">
    <!-- <zh/> 侧边栏导航 <en/> Sidebar navigation -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2>AdvTable 功能演示</h2>
      </div>
      <nav class="sidebar-nav">
        <div
          v-for="category in demoCategories"
          :key="category.label"
          class="category-group"
        >
          <div class="category-label">
            {{ category.label }}
          </div>
          <div
            v-for="option in category.options"
            :key="option.value"
            class="nav-item"
            :class="{ active: selectedDemo === option.value }"
            @click="selectedDemo = option.value"
          >
            {{ option.label }}
          </div>
        </div>
      </nav>
    </aside>

    <!-- <zh/> 主内容区 <en/> Main content area -->
    <main class="main-content">
      <!-- <zh/> 已迁移 section 的动态挂载点（见 table-demo/section-registry.ts；未迁移值走下方 v-if 链） <en/> Dynamic mount for migrated sections (see table-demo/section-registry.ts; unmigrated values fall through to the v-if chain below) -->
      <component
        :is="sectionRegistry[selectedDemo]"
        v-if="sectionRegistry[selectedDemo]"
      />
      <!-- <zh/> 全部展示 <en/> All features showcase -->

      <!-- <zh/> 整合示例 <en/> Mega example -->

      <!-- <zh/> 1. 基础展示 <en/> 1. Basic display -->

      <!-- <zh/> 1.7 表尾合计 <en/> 1.7 Summary row -->

      <!-- <zh/> 2. 选择功能 <en/> 2. Selection features -->

      <!-- <zh/> 3. 分页与数据 <en/> 3. Pagination & data -->

      <!-- <zh/> 4. 搜索与筛选 <en/> 4. Search & filter -->

      <!-- <zh/> 5. 排序与拖拽 <en/> 5. Sort & drag -->

      <!-- <zh/> 6. 编辑功能 <en/> 6. Editing features -->

      <!-- <zh/> 7. 数据校验 <en/> 7. Data validation -->

      <!-- <zh/> 8. 列管理 <en/> 8. Column management -->

      <!-- <zh/> 9. 树形与分组 <en/> 9. Tree & grouping -->

      <!-- <zh/> 10. 高级功能 <en/> 10. Advanced features -->

      <!-- <zh/> 10.19 容器布局 <en/> 10.19 Container layout -->

      <!-- <zh/> 11.1 表面全覆盖 <en/> 11.1 Surface full coverage -->

      <!-- <zh/> 11.2 performanceProfile 独立演示 <en/> 11.2 performanceProfile standalone demo -->

      <!-- <zh/> 默认显示整合示例；已迁移 section 值由上方挂载点渲染，不走此兜底 <en/> Default welcome; registry-migrated values render at the mount point above and never reach this fallback -->
      <div
        v-else-if="!sectionRegistry[selectedDemo]"
        class="demo-section"
      >
        <h1>欢迎使用 AdvTable 功能演示</h1>
        <p>请从左侧导航选择要查看的功能。</p>
        <p>
          或点击 <a
            href="#"
            @click.prevent="selectedDemo = 'mega'"
          >整合示例</a> 查看所有功能的综合演示。
        </p>
      </div>
    </main>
  </div>
</template>
