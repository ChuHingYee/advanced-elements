<!-- <zh/> 11.7 排序配置(sortConfig) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 11.7 排序配置(sortConfig) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { useDemoContext } from '../../demo-context'
import { surfaceLog } from '../../surface-state'

const { surfaceCols, surfaceData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>11.7 排序配置 (sortConfig)</h1>
    <p><code>sortConfig.maxSortColumns</code> 限制多列排序上限（Shift+点击）。超出时 FIFO 淘汰最早的排序列；设为 1 等价于关闭多列排序。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default · maxSortColumns: 1（单列排序）</h4>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          :sort-config="{ maxSortColumns: 1 }"
          height="320px"
          @sort-change="({ sortState }: any) => surfaceLog.push(`sortChange max1: ${sortState.map((s:any) => `${s.prop}:${s.order}`).join(',')}`)"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual · maxSortColumns: 2</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          :sort-config="{ maxSortColumns: 2 }"
          height="320px"
          @sort-change="({ sortState }: any) => surfaceLog.push(`sortChange max2: ${sortState.map((s:any) => `${s.prop}:${s.order}`).join(',')}`)"
        />
      </div>
    </div>
  </div>
</template>
