<!-- <zh/> 11.10 虚拟配置(virtual) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 11.10 虚拟配置(virtual) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { useDemoContext } from '../../demo-context'

const { surfaceCols, surfaceData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>11.10 虚拟滚动配置 (virtual)</h1>
    <p>Virtual 模式下通过 <code>estimatedRowHeight</code> + <code>height</code> 控制虚拟滚动视口与动态行高。Default 模式忽略 <code>estimatedRowHeight</code>。下方对比固定行高 vs 动态行高 + 合成行触发回退。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Virtual · 固定行高（默认，FixedSizeGrid）</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          height="320px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual · estimatedRowHeight=48（DynamicSizeGrid）</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          :estimated-row-height="48"
          height="320px"
        />
      </div>
    </div>
  </div>
</template>
