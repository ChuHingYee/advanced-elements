<!-- <zh/> 10.14 API 方法调用 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 10.14 API 方法调用 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElButton } from 'element-plus'
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'
import { handleGetCurrentPage } from '../../helpers'

const { apiV2Ref, basicRef, pageData60 } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>10.14 API 方法调用</h1>
    <p>通过 ref 调用表格 API。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <div style="margin-bottom: 10px">
          <ElButton @click="basicRef?.deselectAllFiltered?.()">
            清空选择
          </ElButton>
          <ElButton @click="basicRef?.selectAll?.()">
            全选
          </ElButton>
          <ElButton @click="handleGetCurrentPage('Default', basicRef)">
            获取当前页
          </ElButton>
        </div>
        <adv-table
          ref="basicRef"
          mode="default"
          :data="pageData60"
          :columns="allValueTypeColumns.slice(0, 6)"
          :row-config="{ rowSelection: 'multiple' }"
          :pagination="{ pageSize: 10 }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <div style="margin-bottom: 10px">
          <ElButton @click="apiV2Ref?.deselectAllFiltered?.()">
            清空选择
          </ElButton>
          <ElButton @click="apiV2Ref?.selectAll?.()">
            全选
          </ElButton>
          <ElButton @click="handleGetCurrentPage('Virtual', apiV2Ref)">
            获取当前页
          </ElButton>
        </div>
        <adv-table
          ref="apiV2Ref"
          mode="virtual"
          :data="pageData60"
          :columns="allValueTypeColumns.slice(0, 6)"
          :row-config="{ rowSelection: 'multiple' }"
          :pagination="{ pageSize: 10 }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
