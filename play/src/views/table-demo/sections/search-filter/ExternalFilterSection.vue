<!-- <zh/> 4.5 外部筛选器 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 4.5 外部筛选器 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElInputNumber } from 'element-plus'
import { filterSortColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { externalFilterRef, filterAgeThreshold, filterSortData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>4.5 外部筛选器</h1>
    <p>使用外部组件控制筛选。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <div style="margin-bottom: 10px">
          年龄筛选: >=
          <ElInputNumber
            v-model="filterAgeThreshold"
            :min="0"
            :max="100"
            size="small"
            style="width: 100px"
          />
        </div>
        <adv-table
          ref="externalFilterRef"
          mode="default"
          :data="filterSortData"
          :columns="filterSortColumns"
          :external-filter="{ isExternalFilterPresent: () => true, doesExternalFilterPass: (row: any) => row.age >= filterAgeThreshold }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="filterSortData"
          :columns="filterSortColumns"
          :external-filter="{ isExternalFilterPresent: () => true, doesExternalFilterPass: (row: any) => row.age >= filterAgeThreshold }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
