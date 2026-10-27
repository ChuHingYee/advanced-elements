<!-- <zh/> 11.11 容器布局(containerLayout) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 11.11 容器布局(containerLayout) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { basicData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>11.11 容器布局 (containerLayout)</h1>
    <p>
      <code>container-layout="bordered"</code>（默认）：容器自带边框与内边距；
      <code>container-layout="bare"</code>：移除容器边框与内边距，适合嵌入已有边框的父容器。
      下方将同一表格分别以两种布局放入带边框的父容器中对比。
    </p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>bordered（默认）</h4>
        <div style="border: 1px dashed #dcdfe6; padding: 12px">
          <adv-table
            mode="default"
            :data="basicData"
            :columns="allValueTypeColumns.slice(0, 6)"
            container-layout="bordered"
            height="320px"
          />
        </div>
      </div>
      <div class="mode-panel">
        <h4>bare</h4>
        <div style="border: 1px dashed #dcdfe6; padding: 12px">
          <adv-table
            mode="default"
            :data="basicData"
            :columns="allValueTypeColumns.slice(0, 6)"
            container-layout="bare"
            height="320px"
          />
        </div>
      </div>
    </div>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Virtual - bordered</h4>
        <div style="border: 1px dashed #dcdfe6; padding: 12px">
          <adv-table
            mode="virtual"
            :data="basicData"
            :columns="allValueTypeColumns.slice(0, 6)"
            container-layout="bordered"
            height="320px"
          />
        </div>
      </div>
      <div class="mode-panel">
        <h4>Virtual - bare</h4>
        <div style="border: 1px dashed #dcdfe6; padding: 12px">
          <adv-table
            mode="virtual"
            :data="basicData"
            :columns="allValueTypeColumns.slice(0, 6)"
            container-layout="bare"
            height="320px"
          />
        </div>
      </div>
    </div>
  </div>
</template>
