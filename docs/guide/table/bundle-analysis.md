# Bundle Analysis | 体积分析

> 预算：`dist/index.mjs 120KB gzip`、`style 30KB`（`size-limit` + `check-bundle-size` 双门禁）。
> 构成以 `pnpm check:bundle`（内含 `scripts/analyze-bundle.mjs` 的实时输出）为准，本文件只记录结论口径，不手写数字。

## 1. 基准（`pnpm check:bundle`）

- `index.mjs` ~248KB raw / ~75KB gzip（组合式前 ~363KB / ~114KB）；首屏同步闭包 ~347KB raw / ~119KB gzip（此前 ~444KB / ~145KB）
- 懒加载（2 渲染器 + 5 面板 + 搜索栏 + 导出实现 + 拖拽实现 + 剪贴板实现 + 编辑编排器 + 8 编辑器）：~313KB raw / ~109KB gzip，按需 `import()`，不计首屏
- `index.cjs` 同 `mjs` 量级；`style/index.css` ~61KB raw / ~8.7KB gzip

## 2. 占比与组合式加载（`analyze-bundle.mjs` 模块归因，压缩后 token 口径近似值）

- 组合式架构（同步壳 + 异步实现，机制见 `src/utils/async-feature.ts`）：搜索栏 SFC（`v-if="search.hasSearch"` 守卫）、
  导出/导入/打印（方法级懒加载，选择框同步保手势链）、拖拽（`rowDraggable`/`columnDraggable` 门控）、
  剪贴板（首次复制/剪切/粘贴时加载）、编辑编排器（`editConfig` 门控，effectScope 适配器早已就绪、现连代码也动态加载）、
  8 内置编辑器 SFC（注册即异步壳 + 后台预热）均已移出首屏；防回归见 `compositional-split` 守卫测试
- 首屏无单一大户：`AdvTable.vue` ~2.8%，其余数据/编辑/交互 composable 各 ~1.4–2.6%，分布均匀
- `lodash-es`（`use-columns`、`column-filter-form` 2 处）：peer 外部引用，零字节进包（有 `External assertions` 守护）
- `dayjs` / `vue-draggable-plus` / `nanoid`：peer 外部引用，零字节进包
- `xlsx` / `async-validator`：动态 `import()` 懒加载外部依赖，零字节进包（同上有守护）
- `ElTable` / `ElTableV2`：来自消费方 peer `element-plus`，不在包内

## 3. 优化

- `localColumns` 已 `ShallowRef`，`tableData` `WeakMap` 缓存
- `span` 窗口 `O(window×m)` 非 `O(n×m)`
- `scripts/benchmark-pipeline.mjs` 基准 `<50ms` `10k×50`

## 4. CI

- `pnpm check:bundle` 在 `PR` 自动校验：`120KB` 总量阻断 + `analyze-bundle` 外部依赖断言（重依赖实现代码进包即红）
- `pnpm check:comment` `warn-only` 双语校验
- `pnpm check:i18n` `194 keys` 完整性

## 5. 可视化报告（对标 Rsdoctor Bundle Size）

> Rsdoctor 仅支持 Rspack / webpack 插件体系，无法接入本仓的 Rolldown 构建；
> 交互式可视化改用官方支持 Rolldown 的 `rollup-plugin-visualizer`（v7.1.1，peer 覆盖 rolldown 1.x）。

```bash
pnpm analyze:visualizer   # ANALYZE=1 构建，输出 dist/stats.html（treemap + gzip，gitignored，不发布）
pnpm analyze:html          # 零依赖静态报告 dist/bundle-report.html（概览/TreeMap/TreeGraph/重复包，file:// 可开）
```

| Rsdoctor 能力 | 本仓对应 |
|---|---|
| 产物概览卡（Total / Initial JS、文件数） | 顶部 6 张卡：Total / Initial / Lazy JS、Chunks、Modules、重复包 |
| TreeMap（占比、搜索、点击下钻） | 首选 `stats.html`（visualizer treemap + gzip）；离线用 `bundle-report.html` 的 SVG treemap（chunk → 模块两级下钻 + 搜索高亮） |
| TreeGraph（Asset→Module 树、大小过滤、模块详情） | Asset 列表（体积降序、可展开）→ 模块占比条；Asset/Module 双搜索 + 体积下限过滤；点击模块看源码片段（map `sourcesContent`，截断 80 行） |
| 重复包（Duplicate Packages） | `node_modules` 源码进包即列出多拷贝路径 + 引用 chunk（当前为 0，属健康态） |
| 模块详情（引用链） | 模块所在 chunk + 归因体积 + 源码；跨 chunk 引用链未做（按需再加） |
