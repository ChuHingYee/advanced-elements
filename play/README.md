# play 本地联调站

> 🌐 Languages: **中文** · [English](./README.en.md)

组件库的本地 playground：Vite dev server，改各包 `src` 即 HMR。不参与发布。

## 启动

```bash
# 仓库根目录
pnpm play              # = pnpm -C play dev；聚焦单包时先另起终端跑对应包的 dev
```

## 直连源码（无需 build）

`play/vite.config.ts` 的 dev 别名 + tsconfig paths 把组件/样式导入直连各包 `src`，无 `dist` 也能启动。唯一的 dist 依赖是 vite.config 自身在 Node 侧引用的 `@advanced-elements/resolvers`，由 `predev`（`scripts/ensure-play-deps.mjs`）缺失时自动补构建。

聚焦单包开发时减少 watch 进程：

```bash
pnpm --filter @advanced-elements/table dev   # 终端一
pnpm play                                    # 终端二
```

## 页面

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 首页 | 入口导航 |
| `/table` | `views/TableDemo.vue` | 表格全功能演示 |
| `/namespace` | `views/NamespaceDemo.vue` | 自定义 EP namespace 四方配对演示 |

加新页面级 demo：在 `play/src/router/index.ts` 加路由 + `views/` 下加文件即可。
