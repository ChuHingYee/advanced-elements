<!-- <zh/> 11.4 预估行高(estimatedRowHeight) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 11.4 预估行高(estimatedRowHeight) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { useDemoContext } from '../../demo-context'

const { surfaceCols, surfaceData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>11.4 预估行高 (estimatedRowHeight)</h1>
    <p>仅 <code>mode="virtual"</code> 生效，透传给 ElTableV2 的 <code>estimated-row-height</code>。设为数值后切换为 DynamicSizeGrid，逐行测量真实高度，性能下降；内部在检测到 <code>append</code> 插槽或已展开的详情行时自动回退到 <code>rowHeight</code> 以避免裁切。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Virtual · 固定行高 (默认)</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          height="300px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual · estimatedRowHeight=48</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          :estimated-row-height="48"
          height="300px"
        />
      </div>
    </div>
    <div
      class="mode-panel"
      style="margin-top:16px"
    >
      <h4>Virtual · estimatedRowHeight=80 + append 合成行（自动回退验证）</h4>
      <adv-table
        mode="virtual"
        :data="surfaceData"
        :columns="surfaceCols"
        :estimated-row-height="80"
        height="300px"
      >
        <template #append>
          <div class="surface-append-row">
            —— append 合成行触发动态行高回退 ——
          </div>
        </template>
      </adv-table>
    </div>
  </div>
</template>
