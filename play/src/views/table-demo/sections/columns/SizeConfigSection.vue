<!-- <zh/> 8.8 尺寸自定义(sizeConfig) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 8.8 尺寸自定义(sizeConfig) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElOption, ElSelect } from 'element-plus'
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { basicData, sizeConfigPreset, sizeConfigValue } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>8.8 尺寸自定义 (sizeConfig)</h1>
    <p>通过 <code>ui-config.size</code> 切换内置尺寸预设（large / default / small），或通过 <code>ui-config.sizeConfig</code> 覆盖个别尺寸值（headerCellHeight、cellPadding、rowHeight 等）。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <div style="margin-bottom: 10px">
          尺寸预设:
          <ElSelect
            v-model="sizeConfigPreset"
            size="small"
            style="width: 120px"
          >
            <ElOption
              label="Large"
              value="large"
            />
            <ElOption
              label="Default"
              value="default"
            />
            <ElOption
              label="Small"
              value="small"
            />
            <ElOption
              label="Custom"
              value="custom"
            />
          </ElSelect>
        </div>
        <adv-table
          mode="default"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          :ui-config="{ size: sizeConfigPreset !== 'custom' ? sizeConfigPreset : undefined, sizeConfig: sizeConfigValue }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          :ui-config="{ size: sizeConfigPreset !== 'custom' ? sizeConfigPreset : undefined, sizeConfig: sizeConfigValue }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
