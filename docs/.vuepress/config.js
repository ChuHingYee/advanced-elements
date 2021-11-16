const path = require('path')
module.exports = {
  base: '/advanced-elements/',
  chainWebpack: (config) => {
    const pkgPath = path.resolve(__dirname, '../../', 'packages')
    config.resolve.modules.add(pkgPath).add('node_modules')
    config.resolve.alias.set('@element-advanced', pkgPath)
  },
  title: 'AdvancedElements',
  description: 'element-ui,advanced,中后台',
  themeConfig: {
    lastUpdated: 'lastUpdate', // string | boolean
    nav: [
      { text: '首页', link: '/' },
      { text: '指南', link: '/docs/getting-started' },
      { text: '组件', link: '/components/' },
      { text: 'Github', link: 'https://github.com/ChuHingYee/advanced-elements' },
    ],
    sidebar: {
      '/docs/': [
        {
          title: '文档', // 必要的
          collapsable: false, // 可选的, 默认值是 true,
          sidebarDepth: 1, // 可选的, 默认值是 1
          children: [['getting-started', '快速开始']],
        },
      ],
      '/components/': [
        {
          title: '架构设计', // 必要的
          collapsable: false, // 可选的, 默认值是 true,
          sidebarDepth: 1, // 可选的, 默认值是 1
          children: [['', '组件总览']],
        },
        {
          title: '数据展示', // 必要的
          collapsable: false, // 可选的, 默认值是 true,
          sidebarDepth: 0, // 可选的, 默认值是 1
          children: [['table', '表格']],
        },
      ],
    },
  },
  plugins: [
    'demo-container',
    [
      '@vuepress/register-components',
      {
        componentsDir: '../../packages',
      },
    ],
  ],
}
