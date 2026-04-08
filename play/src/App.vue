<script setup lang="ts">
/**
 * Play 演示应用布局壳
 *
 * 顶部导航 + router-view，各组件 demo 位于 views/ 目录下独立路由。
 * 全局命名空间切换（el/demo）：Provider 包裹 router-view 使整站进入自定义前缀，
 * 用于在 TableDemo 全功能页端到端验证；切到 demo 时懒加载对应重编样式。
 */
import { ref, watch } from 'vue'
import { ensureNamespaceStyles } from './utils/ensure-namespace-styles'

const ns = ref<'el' | 'demo'>('el')
watch(ns, (v) => {
  if (v === 'demo')
    void ensureNamespaceStyles()
})
</script>

<template>
  <div class="play-layout">
    <nav class="top-nav">
      <router-link
        to="/table"
        class="top-nav__link"
      >
        Table 演示
      </router-link>
      <router-link
        to="/namespace"
        class="top-nav__link"
      >
        命名空间演示
      </router-link>
      <div class="top-nav__ns">
        <span class="top-nav__ns-label">命名空间</span>
        <el-radio-group
          v-model="ns"
          size="small"
        >
          <el-radio value="el">
            el
          </el-radio>
          <el-radio value="demo">
            demo
          </el-radio>
        </el-radio-group>
      </div>
    </nav>
    <div class="play-content">
      <el-config-provider :namespace="ns">
        <router-view />
      </el-config-provider>
    </div>
  </div>
</template>

<style lang="scss">
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
}

.play-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.top-nav {
  display: flex;
  gap: 16px;
  padding: 8px 20px;
  background: #303133;
  flex-shrink: 0;
  align-items: center;

  &__link {
    color: #ffffffb3;
    text-decoration: none;
    font-size: 14px;
    padding: 4px 12px;
    border-radius: 4px;
    transition: all 0.2s;

    &:hover {
      color: #fff;
      background: #ffffff1a;
    }

    &.router-link-exact-active {
      color: #409eff;
      font-weight: 600;
    }
  }

  &__ns {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__ns-label {
    color: #ffffffb3;
    font-size: 13px;
  }
}

.play-content {
  flex: 1;
  overflow: hidden;
}
</style>
