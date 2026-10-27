<!-- <zh/> 10.20 虚拟滚动失步自愈 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 10.20 虚拟滚动失步自愈 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElButton, ElDrawer } from 'element-plus'
import { useDemoContext } from '../../demo-context'

const { keepAliveComponent, keepAliveShow, refreshScrollSyncData, scrollSyncColumns, scrollSyncData, scrollSyncDrawerOpen, scrollSyncPanelHeight, simulateScrollSyncDesync } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>10.20 虚拟滚动失步自愈</h1>
    <p>
      ElTableV2 在弹层开关、KeepAlive 停用/复活、容器尺寸变化或数据更新时，内部滚动状态可能与 DOM
      滚动位置失步，表现为「滚动条未动但顶部出现空白带、渲染行整体下移」，鼠标微微一滚即恢复。
      本库通过 rAF 检测失步并回写内部状态，实现零跳变自愈。
    </p>
    <p>
      操作步骤：先将下方表格滚动到中部（约第 1000 行），点击「模拟失步」——
      DOM 滚动位置被静默重置、而内部状态仍停留在旧位置（顶部出现空白带），
      根节点 capture 监听到滚动、静默约 120ms 后自动以 DOM 为准回写内部状态
      （行未动时直接恢复 DOM 位置以保留阅读进度，零跳变），内容立即对齐，无需任何滚动或后续操作。
      修复生效时观察 Console 出现 <code>[AdvTable] virtual scroll desync healed</code> 日志。
    </p>
    <p>
      说明：KeepAlive 按钮演示组件卸载/重挂载（无失步风险）；容器尺寸变化与数据替换时
      浏览器与 EP 均会派发滚动事件自行同步。真正需要本库兜底的是
      「DOM 滚动位置被外部改写、而 EP 滚动监听没跑」——即「模拟失步」按钮所模拟的场景
      （直写 scrollTop + 拦截 EP 监听；库侧经根节点 capture 独立感知滚动静默后自愈）。
    </p>
    <div class="mode-panel">
      <h4>触发场景</h4>
      <ElButton
        type="primary"
        @click="keepAliveShow = !keepAliveShow"
      >
        {{ keepAliveShow ? '隐藏表格（KeepAlive 停用）' : '重新显示表格（KeepAlive 复活）' }}
      </ElButton>
      <ElButton
        type="primary"
        @click="scrollSyncDrawerOpen = true"
      >
        打开 Drawer（弹层开关）
      </ElButton>
      <ElButton
        type="primary"
        @click="refreshScrollSyncData"
      >
        替换数据（新 2000 行数组）
      </ElButton>
      <ElButton
        type="primary"
        @click="simulateScrollSyncDesync"
      >
        模拟失步（重置 DOM 滚动位置）
      </ElButton>
      <ElButton
        type="primary"
        @click="scrollSyncPanelHeight = scrollSyncPanelHeight === 600 ? 800 : 600"
      >
        切换容器高度（{{ scrollSyncPanelHeight }}px → {{ scrollSyncPanelHeight === 600 ? 800 : 600 }}px）
      </ElButton>
      <component :is="keepAliveComponent">
        <div :style="{ height: `${scrollSyncPanelHeight}px` }">
          <adv-table
            v-if="keepAliveShow"
            mode="virtual"
            :data="scrollSyncData"
            :columns="scrollSyncColumns"
          />
        </div>
      </component>
    </div>
    <ElDrawer
      v-model="scrollSyncDrawerOpen"
      title="虚拟滚动失步演示"
      size="600px"
    >
      <p>
        Drawer 弹层开关会锁 body 滚动并引起布局重排，是 ElTableV2 虚拟滚动失步的常见触发源。
        关闭后观察页面表格内容是否仍保持对齐。
      </p>
    </ElDrawer>
  </div>
</template>
