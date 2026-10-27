<!-- <zh/> 5.2 手动触发排序(API) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 5.2 手动触发排序(API) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElButton } from 'element-plus'
import { filterSortColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { filterSortData, manualSortLog, manualSortRef, manualSortV2Ref } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>5.2 手动触发排序 (API)</h1>
    <p>通过 API 手动控制排序。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <div style="margin-bottom: 10px">
          <ElButton @click="manualSortRef?.setSort?.('age', 'ascending')">
            按年龄升序
          </ElButton>
          <ElButton @click="manualSortRef?.setSort?.('salary', 'descending')">
            按薪资降序
          </ElButton>
          <ElButton @click="manualSortRef?.clearSort?.()">
            清除排序
          </ElButton>
        </div>
        <adv-table
          ref="manualSortRef"
          mode="default"
          :data="filterSortData"
          :columns="filterSortColumns"
          height="400px"
        />
        <div style="margin-top: 10px">
          当前排序: {{ manualSortLog }}
        </div>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <div style="margin-bottom: 10px">
          <ElButton @click="manualSortV2Ref?.setSort?.('age', 'ascending')">
            按年龄升序
          </ElButton>
          <ElButton @click="manualSortV2Ref?.setSort?.('salary', 'descending')">
            按薪资降序
          </ElButton>
          <ElButton @click="manualSortV2Ref?.clearSort?.()">
            清除排序
          </ElButton>
        </div>
        <adv-table
          ref="manualSortV2Ref"
          mode="virtual"
          :data="filterSortData"
          :columns="filterSortColumns"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
