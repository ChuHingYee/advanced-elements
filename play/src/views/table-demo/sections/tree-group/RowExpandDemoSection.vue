<!-- <zh/> 9.5 主/明细视图(rowExpandConfig) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 9.5 主/明细视图(rowExpandConfig) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElCheckbox } from 'element-plus'
import { rowExpandColumns, rowExpandDetailColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { orderDetailsMap, rowExpandAccordion, rowExpandConfig, rowExpandData, rowExpandRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>9.5 主/明细视图 (rowExpandConfig)</h1>
    <p>展开行显示详细信息（双模式均渲染订单明细嵌套表）。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <div style="margin-bottom: 10px">
          <ElCheckbox v-model="rowExpandAccordion">
            手风琴模式
          </ElCheckbox>
        </div>
        <adv-table
          ref="rowExpandRef"
          mode="default"
          :data="rowExpandData"
          :columns="rowExpandColumns"
          :row-config="{ rowKey: 'id' }"
          :row-expand-config="rowExpandConfig"
          height="400px"
        >
          <template #expandRow="{ row }">
            <div style="padding: 10px">
              <h4>订单明细 - {{ row.orderNo }}</h4>
              <adv-table
                mode="default"
                :data="orderDetailsMap[row.id] || []"
                :columns="rowExpandDetailColumns"
                height="150px"
              />
            </div>
          </template>
        </adv-table>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <div style="margin-bottom: 10px">
          <ElCheckbox v-model="rowExpandAccordion">
            手风琴模式
          </ElCheckbox>
        </div>
        <adv-table
          mode="virtual"
          :data="rowExpandData"
          :columns="rowExpandColumns"
          :row-config="{ rowKey: 'id' }"
          :row-expand-config="rowExpandConfig"
          height="400px"
        >
          <template #expandRow="{ row }">
            <div style="padding: 10px">
              <h4>订单明细 - {{ row.orderNo }}</h4>
              <adv-table
                mode="default"
                :data="orderDetailsMap[row.id] || []"
                :columns="rowExpandDetailColumns"
                height="150px"
              />
            </div>
          </template>
        </adv-table>
      </div>
    </div>
  </div>
</template>
