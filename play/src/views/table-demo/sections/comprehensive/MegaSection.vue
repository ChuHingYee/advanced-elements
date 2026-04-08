<!-- <zh/> ⭐ 整合示例（集所有功能于一体） section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> ⭐ 整合示例（集所有功能于一体） section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElButton, ElInput, ElOption, ElRadio, ElRadioGroup, ElSelect, ElSwitch } from 'element-plus'
import { useDemoContext } from '../../demo-context'

const { megaBareOn, megaClearLog, megaColumns, megaDataset, megaDebugOn, megaEventHandlers, megaEventLog, megaEventTotal, megaExpandOn, megaExtFilterOn, megaLoading, megaLowPerfOn, megaMenuOn, megaModeSwitchBehavior, megaPinOn, megaPropsLeft, megaPropsRight, megaQuickFilter, megaRangeSelOn, megaRef, megaRequestOn, megaRowDragOn, megaRowGroupOn, megaSearchValues, megaSelectedRowKeys, megaShowHeader, megaSize, megaSpanOn, megaStripe, megaTableLayout, megaTooltipEffect, megaTreeOn, megaTriggeredEventCount, megaUnfiredEvents } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>⭐ 总示例（mega）— 全部表格级 API 一次装配</h1>
    <p>
      左面板 default 模式、右面板 virtual 模式。两面板通过 <code>v-bind="megaPropsLeft/Right"</code>
      绑定全部 46 个 props、通过 <code>v-on="megaEventHandlers"</code> 绑定全部 53 个事件；
      左面板使用全部 6 个 v-model（data / columns / loading / quickFilter / searchValues / selectedRowKeys），右面板对同一份状态单向绑定。
    </p>

    <div class="mega-controls">
      <ElInput
        v-model="megaQuickFilter"
        placeholder="全局搜索..."
        clearable
        style="width: 200px"
      />
      <ElButton
        type="primary"
        @click="megaRef?.exportCsv?.()"
      >
        导出 CSV
      </ElButton>
      <ElButton @click="megaRef?.validate?.()">
        校验数据
      </ElButton>
      <ElButton @click="megaRef?.deselectAllFiltered?.()">
        清空选择
      </ElButton>
    </div>

    <!-- <zh/> 功能开关：配置对象常绑定，enabled/取值由这些开关翻转 <en/> Feature toggles: config objects stay bound; enabled/value flipped by these switches -->
    <div
      class="mega-controls"
      style="flex-wrap: wrap"
    >
      <span><ElSwitch v-model="megaRequestOn" /> request 数据源</span>
      <span><ElSwitch v-model="megaTreeOn" /> 树形数据</span>
      <span><ElSwitch v-model="megaRowGroupOn" /> 行分组</span>
      <span><ElSwitch v-model="megaExpandOn" /> 展开行</span>
      <span><ElSwitch v-model="megaPinOn" /> 行固定</span>
      <span><ElSwitch v-model="megaSpanOn" /> 单元格合并</span>
      <span><ElSwitch v-model="megaRangeSelOn" /> 范围选择</span>
      <span><ElSwitch v-model="megaMenuOn" /> 右键菜单</span>
      <span><ElSwitch v-model="megaRowDragOn" /> 行拖拽</span>
      <span><ElSwitch v-model="megaExtFilterOn" /> 外部筛选(仅启用)</span>
      <span><ElSwitch v-model="megaDebugOn" /> debug</span>
      <span><ElSwitch v-model="megaLowPerfOn" /> 性能降档 low</span>
      <span><ElSwitch v-model="megaStripe" /> stripe</span>
      <span><ElSwitch v-model="megaShowHeader" /> showHeader</span>
      <span><ElSwitch v-model="megaLoading" /> loading</span>
      <span><ElSwitch v-model="megaBareOn" /> 容器 bare</span>
    </div>

    <div
      class="mega-controls"
      style="flex-wrap: wrap"
    >
      <ElSelect
        v-model="megaSize"
        style="width: 120px"
      >
        <ElOption
          label="size: large"
          value="large"
        />
        <ElOption
          label="size: default"
          value="default"
        />
        <ElOption
          label="size: small"
          value="small"
        />
      </ElSelect>
      <ElSelect
        v-model="megaTableLayout"
        style="width: 140px"
      >
        <ElOption
          label="layout: fixed"
          value="fixed"
        />
        <ElOption
          label="layout: auto"
          value="auto"
        />
      </ElSelect>
      <ElSelect
        v-model="megaTooltipEffect"
        style="width: 150px"
      >
        <ElOption
          label="tooltip: dark"
          value="dark"
        />
        <ElOption
          label="tooltip: light"
          value="light"
        />
      </ElSelect>
      <ElRadioGroup v-model="megaModeSwitchBehavior">
        <ElRadio value="warn">
          warn
        </ElRadio>
        <ElRadio value="error">
          error
        </ElRadio>
        <ElRadio value="silent">
          silent
        </ElRadio>
      </ElRadioGroup>
      <span style="font-size: 12px; color: #909399">modeSwitchBehavior</span>
    </div>

    <p style="font-size: 12px; color: #909399">
      说明：request 开关打开时 <code>request.source</code> 优先于 <code>data</code>（以分页切片返回当前数据集副本）；
      树形/展开行开关会整体切换面板数据集与列（关闭即恢复扁平数据）；行分组叠加在扁平数据上；
      urlState 已绑定但默认关闭（同页两表共用 URL key 会互踩）。
    </p>
    <p style="font-size: 12px; color: #909399">
      交互触发提示：单击/双击可编辑单元格（姓名/年龄/薪资列）→ cellEditingStarted / cellValueChanged / cellEditingStopped；
      表头拖动边界 → headerDragend；Shift+点击表头 → sortChange（多列上限 2）；
      列设置面板 → columnVisible / columnMoved；勾选行 → select / selectionChange / rowSelected；
      右键 → rowContextmenu / contextMenuClick；范围选择拖拽 → cellRangeSelected；
      工具栏导入确认后 → dataImport；编辑提交后 → modelUpdated；树/展开行点击 → rowExpand / rowCollapse；
      滚动 → scroll / endReached / rowsRendered（高频事件仅计数不进日志）。
      exportExcel / exportCsv / print / triggerImport 为暴露 API（非事件），undo/redo 走 Ctrl+Z / Ctrl+Shift+Z。
    </p>

    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式（6 个 v-model + 全 props + 全事件）</h4>
        <adv-table
          ref="megaRef"
          v-model:data="megaDataset"
          v-model:columns="megaColumns"
          v-model:loading="megaLoading"
          v-model:quick-filter="megaQuickFilter"
          v-model:search-values="megaSearchValues"
          v-model:selected-row-keys="megaSelectedRowKeys"
          mode="default"
          height="600px"
          v-bind="megaPropsLeft"
          v-on="megaEventHandlers"
        >
          <template
            v-if="megaExpandOn"
            #expandRow="{ row }: any"
          >
            <div style="padding: 8px 12px; font-size: 13px">
              {{ row.orderNo }} · {{ row.customer }} · 状态 {{ row.status }} —— 展开行内容（触发 rowExpand / rowCollapse）
            </div>
          </template>
        </adv-table>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式（同一份状态，单向绑定）</h4>
        <adv-table
          mode="virtual"
          :data="megaDataset"
          :columns="megaColumns"
          :loading="megaLoading"
          :quick-filter="megaQuickFilter"
          :search-values="megaSearchValues"
          :selected-row-keys="megaSelectedRowKeys"
          height="600px"
          v-bind="megaPropsRight"
          v-on="megaEventHandlers"
        >
          <template
            v-if="megaExpandOn"
            #expandRow="{ row }: any"
          >
            <div style="padding: 8px 12px; font-size: 13px">
              {{ row.orderNo }} · {{ row.customer }} · 状态 {{ row.status }} —— 展开行内容（触发 rowExpand / rowCollapse）
            </div>
          </template>
        </adv-table>
      </div>
    </div>

    <div class="log-panel">
      <div class="log-header">
        <strong>事件覆盖：已触发 {{ megaTriggeredEventCount }}/{{ megaEventTotal }} · 日志 {{ megaEventLog.length }}/50</strong>
        <ElButton
          size="small"
          @click="megaClearLog()"
        >
          清空日志
        </ElButton>
      </div>
      <p
        v-if="megaUnfiredEvents.length"
        style="font-size: 12px; color: #909399"
      >
        未触发事件：<code>{{ megaUnfiredEvents.join('、') }}</code>
      </p>
      <p
        v-else
        style="font-size: 13px; color: #67c23a"
      >
        🎉 全部 53 个事件均已触发
      </p>
      <div class="log-content">
        <div
          v-for="(entry, i) in megaEventLog"
          :key="i"
          class="log-entry"
        >
          {{ entry }}
        </div>
        <div
          v-if="megaEventLog.length === 0"
          class="log-empty"
        >
          暂无事件日志（高频事件只计数：scroll / rowsRendered / cellMouseEnter / cellMouseLeave / 键盘三事件）
        </div>
      </div>
    </div>
  </div>
</template>
