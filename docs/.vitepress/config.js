import { resolve } from 'node:path'
import VueJsx from '@vitejs/plugin-vue-jsx'
import { demoContainerPlugin } from './markdown/demo-container.mjs'

const docsDir = import.meta.dirname

export default {
  title: 'AdvancedElements',
  description: 'element-plus,advanced,中后台',
  base: '/advanced-elements/',
  themeConfig: {
    lastUpdated: true,
    nav: [
      { text: '首页', link: '/' },
      { text: '指南', link: '/guide/getting-started' },
      { text: '组件', link: '/components/table' },
      {
        text: 'GitHub',
        link: 'https://github.com/ChuHingYee/advanced-elements',
      },
    ],
    sidebar: {
      '/guide/': [
        {
          text: '指南',
          collapsed: false,
          items: [
            {
              text: '快速开始',
              link: '/guide/getting-started',
            },
          ],
        },
        {
          text: '表格指南',
          collapsed: false,
          items: [
            { text: '编辑', link: '/guide/table/editing' },
            { text: '范围选择', link: '/guide/table/range-selection' },
            { text: '行固定', link: '/guide/table/row-pin' },
            { text: '合并', link: '/guide/table/span' },
            { text: '树形', link: '/guide/table/tree' },
            { text: '双引擎架构', link: '/guide/table/dual-engine-architecture' },
            { text: '性能指南', link: '/guide/table/performance-guide' },
            { text: '事件订阅选型', link: '/guide/table/event-subscription' },
            { text: '体积分析', link: '/guide/table/bundle-analysis' },
            { text: '无障碍', link: '/guide/table/a11y-guide' },
            { text: '安全指南', link: '/guide/table/security-guide' },
            { text: '国际化', link: '/guide/table/i18n-guide' },
            { text: '迁移指南', link: '/guide/table/migration-guide' },
            { text: 'v2.1 迁移', link: '/guide/table/migration-v2.1' },
            { text: 'AG-Grid 迁移', link: '/guide/table/migration-ag-grid' },
            { text: 'API 覆盖', link: '/guide/table/api-coverage' },
            { text: '数据列拆分', link: '/guide/table/data-columns-split' },
            { text: '管线', link: '/guide/table/pipeline' },
            { text: '过滤排序管线', link: '/guide/table/filter-sort-pipeline' },
            { text: '端到端', link: '/guide/table/e2e' },
            { text: '深拷贝选型', link: '/guide/table/cloneDeep' },
          ],
        },
        {
          text: '协作',
          collapsed: false,
          items: [
            { text: '协作开发指南', link: '/guide/contributing' },
            { text: '构建底座', link: '/guide/build' },
          ],
        },
      ],
      '/components/': [
        {
          text: '配置',
          collapsed: false,
          items: [
            {
              text: '全局配置',
              link: '/components/config-provider',
            },
            {
              text: '按需导入',
              link: '/components/resolver',
            },
            {
              text: '统一导出包',
              link: '/components/elements',
            },
          ],
        },
        {
          text: '数据展示',
          collapsed: false,
          items: [
            {
              text: '表格',
              link: '/components/table',
            },
          ],
        },
      ],
    },
  },
  vite: {
    plugins: [VueJsx()],
    resolve: {
      // 直连 config-provider / table 源码：文档构建不再依赖其 dist 产物（与 vitest alias 同理）。
      // table 的裸导入别名让 examples/ 下的 demo 能写出与消费方一致的 `@advanced-elements/table` 代码。
      alias: {
        '@advanced-elements/config-provider': resolve(docsDir, '../../packages/config-provider/src/index.ts'),
        '@advanced-elements/table': resolve(docsDir, '../../packages/table/src/index.ts'),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          // 同 play：vite 8 的 sass 默认走 legacy API，table 样式是 modern 语法（@use）
          api: 'modern-compiler',
        },
      },
    },
  },
  markdown: {
    anchor: { permalink: false },
    toc: { includeLevel: [1, 2] },
    config(md) {
      // `:::demo <标题> <文件>` —— 预览 + 代码双栏，源码取自 examples/ 下的 .vue
      md.use(demoContainerPlugin, { srcDir: resolve(docsDir, '..') })
    },
  },
}
