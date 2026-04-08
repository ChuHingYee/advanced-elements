<!-- <zh/> 11.8 行固定(rowPinConfig) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 11.8 行固定(rowPinConfig) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElButton } from 'element-plus'
import { useDemoContext } from '../../demo-context'
import { surfaceLog } from '../../surface-state'

const { surfaceApi2Ref, surfaceApiRef, surfaceCols, surfaceData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>11.8 行固定 (rowPinConfig)</h1>
    <p>将指定行固定在顶部或底部，滚动时始终可见。配合 API <code>pinRow/unpinRow/isRowPinned/clearPinnedRows</code> 动态控制。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default · topRowKeys:['1'] bottomRowKeys:['5']</h4>
        <adv-table
          ref="surfaceApiRef"
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          :row-config="{ rowKey: 'id' }"
          :row-pin-config="{ topRowKeys: ['1'], bottomRowKeys: ['5'] }"
          height="320px"
        />
        <div style="margin-top:8px;display:flex;gap:6px">
          <ElButton
            size="small"
            @click="surfaceApiRef?.pinRow?.('2', 'top')"
          >
            pin 2 top
          </ElButton>
          <ElButton
            size="small"
            @click="surfaceApiRef?.unpinRow?.('1')"
          >
            unpin 1
          </ElButton>
          <ElButton
            size="small"
            @click="surfaceApiRef?.clearPinnedRows?.()"
          >
            clear
          </ElButton>
        </div>
      </div>
      <div class="mode-panel">
        <h4>Virtual · topRowKeys:['2'] bottomRowKeys:['6']</h4>
        <adv-table
          ref="surfaceApi2Ref"
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          :row-config="{ rowKey: 'id' }"
          :row-pin-config="{ topRowKeys: ['2'], bottomRowKeys: ['6'] }"
          height="320px"
        />
        <div style="margin-top:8px;display:flex;gap:6px">
          <ElButton
            size="small"
            @click="surfaceApi2Ref?.pinRow?.('3', 'bottom')"
          >
            pin 3 bottom
          </ElButton>
          <ElButton
            size="small"
            @click="surfaceApi2Ref?.isRowPinned?.('2') && surfaceLog.push('isRowPinned 2 true')"
          >
            isPinned 2
          </ElButton>
        </div>
      </div>
    </div>
  </div>
</template>
