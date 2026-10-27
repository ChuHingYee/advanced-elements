<!-- <zh/> 11.12 斑马纹(stripe) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 11.12 斑马纹(stripe) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElSwitch } from 'element-plus'
import { useDemoContext } from '../../demo-context'

const { stripeEnabled, surfaceCols, surfaceData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>11.12 斑马纹 (stripe)</h1>
    <p><code>stripe</code> 控制斑马纹。Default 模式透传给 ElTable，Virtual 模式通过 row-class-name 实现等价效果。下方开关实时切换，观察奇偶行背景差异。</p>
    <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px">
      <span style="font-size: 13px; color: #606266">斑马纹开关：</span>
      <ElSwitch
        v-model="stripeEnabled"
        active-text="开启"
        inactive-text="关闭"
      />
      <span style="font-size: 12px; color: #909399; margin-left: 12px">当前：{{ stripeEnabled ? 'stripe=true' : 'stripe=false' }}</span>
    </div>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default · {{ stripeEnabled ? 'stripe=true' : 'stripe=false' }}</h4>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          :stripe="stripeEnabled"
          height="300px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual · {{ stripeEnabled ? 'stripe=true' : 'stripe=false' }}</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          :stripe="stripeEnabled"
          height="300px"
        />
      </div>
    </div>
  </div>
</template>
