<!-- <zh/> 全部展示 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 全部展示 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { allValueTypeColumns, editColumns, filterSortColumns, treeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { basicData, editData, editRef, editV2Ref, filterSortData, treeConfig, treeData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>全部功能展示</h1>
    <p>此处展示所有功能的缩略版，详细演示请从左侧导航选择具体功能。</p>

    <!-- <zh/> 基础展示 <en/> Basic display -->
    <section class="demo-block">
      <h3>1. 基础展示</h3>
      <div class="dual-mode">
        <div class="mode-panel">
          <h4>Default 模式</h4>
          <adv-table
            mode="default"
            :data="basicData"
            :columns="allValueTypeColumns.slice(0, 8)"
            :pagination="{ pageSize: 5 }"
            height="300px"
          />
        </div>
        <div class="mode-panel">
          <h4>Virtual 模式</h4>
          <adv-table
            mode="virtual"
            :data="basicData"
            :columns="allValueTypeColumns.slice(0, 8)"
            :pagination="{ pageSize: 5 }"
            height="300px"
          />
        </div>
      </div>
    </section>

    <!-- <zh/> 选择功能 <en/> Selection features -->
    <section class="demo-block">
      <h3>2. 选择功能</h3>
      <div class="dual-mode">
        <div class="mode-panel">
          <h4>多选 + Shift 选择</h4>
          <adv-table
            mode="default"
            :data="filterSortData"
            :columns="filterSortColumns"
            :row-config="{ rowSelection: 'multiple' }"
            height="300px"
          />
        </div>
        <div class="mode-panel">
          <h4>Virtual 模式</h4>
          <adv-table
            mode="virtual"
            :data="filterSortData"
            :columns="filterSortColumns"
            :row-config="{ rowSelection: 'multiple' }"
            height="300px"
          />
        </div>
      </div>
    </section>

    <!-- <zh/> 编辑功能 <en/> Editing features -->
    <section class="demo-block">
      <h3>3. 编辑功能</h3>
      <div class="dual-mode">
        <div class="mode-panel">
          <h4>单元格编辑</h4>
          <adv-table
            ref="editRef"
            v-model:data="editData"
            mode="default"
            :columns="editColumns"
            :edit-config="{}"
            height="300px"
          />
        </div>
        <div class="mode-panel">
          <h4>Virtual 模式</h4>
          <adv-table
            ref="editV2Ref"
            :data="editData"
            mode="virtual"
            :columns="editColumns"
            :edit-config="{}"
            height="300px"
          />
        </div>
      </div>
    </section>

    <!-- <zh/> 树形与分组 <en/> Tree & grouping -->
    <section class="demo-block">
      <h3>4. 树形与分组</h3>
      <div class="dual-mode">
        <div class="mode-panel">
          <h4>树形数据</h4>
          <adv-table
            mode="default"
            :data="treeData"
            :columns="treeColumns"
            :tree-config="treeConfig"
            :row-config="{ rowKey: 'id' }"
            height="300px"
          />
        </div>
        <div class="mode-panel">
          <h4>Virtual 模式</h4>
          <adv-table
            mode="virtual"
            :data="treeData"
            :columns="treeColumns"
            :tree-config="treeConfig"
            :row-config="{ rowKey: 'id' }"
            height="300px"
          />
        </div>
      </div>
    </section>
  </div>
</template>
