<!-- <zh/> 7.3 跨字段校验 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 7.3 跨字段校验 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { orderColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { crossValidateRef, orderData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>7.3 跨字段校验</h1>
    <p>跨字段联动校验。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="crossValidateRef"
          mode="default"
          :data="orderData"
          :columns="orderColumns"
          :edit-config="{}"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="orderData"
          :columns="orderColumns"
          :edit-config="{}"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
