# 自定义命名空间配置清单（宿主侧，一次性）

> 把 Element Plus 类前缀从默认 `el-` 换成自定义前缀（如 `xxx-`）时，宿主必须完成的配置。
> 默认 `el-` 前缀**零配置**：三处都不做即开箱即用，本清单仅在改前缀时执行。
>
> 原理（一句话）：运行时类名由 ConfigProvider 决定（本包 JS 自动跟随，无需配置），
> 两套 CSS 分别在构建期固化（EP 自身 `$namespace`、本包 `$ep-namespace`），必须与运行时一致。
> 官方依据：[EP 自定义命名空间指南](https://element-plus.org/zh-CN/guide/namespace)（"必须同时设置 `ElConfigProvider` 和 scss `$namespace`"）。

## 步骤（按顺序执行，共 3 步 + 1 个通常省略项）

### 1. 运行时：`ElConfigProvider namespace`（必须）

```vue
<!-- App.vue 或表格所在子树根部 -->
<template>
  <el-config-provider namespace="xxx">
    <!-- ... -->
  </el-config-provider>
</template>
```

或等价的应用级写法：

```ts
app.use(ElementPlus, { namespace: 'xxx' })
```

- 本包 JS 侧**无需任何配置**：`core.namespace` 经 `useGlobalConfig()` 自动读到 `xxx`
  （`src/composables/core/use-table-config.ts:324`），全部 `ep-selectors.ts` 构造器同步切换。
- `uiConfig.namespace` **省略**（README 推荐路径）。只有当你有意让本包与 EP 用不同前缀时才传，
  且两者不同会立即触发 `TABLE_NAMESPACE_MISMATCH`（warn，生产可见）——这是正确的响亮失败，不是 bug。

### 2. 构建期：重编 EP 自身 CSS（必须，与步骤 1 同值）

按 [EP 官方指南](https://element-plus.org/zh-CN/guide/namespace)操作：

```scss
// styles/element/index.scss
@forward 'element-plus/theme-chalk/src/mixins/config.scss' with (
  $namespace: 'xxx'
);
```

```ts
// vite.config.ts
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "~/styles/element/index.scss" as *;`,
      },
    },
  },
})
```

### 3. 构建期：配置本包 `$ep-namespace`（必须，与步骤 1 同值）

```scss
// 宿主样式入口，在 @use 本包 index.scss 之前
@use '@advanced-elements/table/src/style/ep-classes' with ($ep-namespace: 'xxx');
```

- 顺序不可颠倒：SASS 模块单例，`index.scss` 先加载会把 `ep-classes` 锁死为默认值，后配直接**编译报错**（免费的顺序校验）。
- 配对关系见 `src/style/_ep-classes.scss:13-29` 头部注释。

## 验证（每步做完即验，不要三步全做完才看）

| 验什么 | 方法 | 通过标准 |
|---|---|---|
| 步骤 1 生效 | DevTools 检查表格 DOM | 行/单元格类名为 `xxx-table__row` 等，而非 `el-` 开头 |
| 步骤 1 无误报 | 打开控制台 / 监听 `@error` | 无 `TABLE_NAMESPACE_MISMATCH` |
| 步骤 2 生效 | DevTools 检查 EP 组件样式 | 按钮/输入框等 EP 原生样式正常（非裸 HTML 外观） |
| 步骤 3 生效 | 视觉走查 summary + border + stripe | 合计行、边框、斑马纹正常；`sass` 编译产物中断言零 `.el-` 选择器（见 `EP-UPGRADE-CHECKLIST.md` §1 第 4 项回归方法） |
| 端到端 | 拖拽一行 / 滚动 / hover 操作列 | 无静默失效；若有异常先查 `@error` 是否有 `TABLE_NAMESPACE_MISMATCH`，其 `cause` 自带 `expectedSelector` 与 `namespace` |

## 故障对照表（跳过某步的症状）

| 漏掉的步骤 | 症状 | 谁先报 |
|---|---|---|
| 只做步骤 1（最常见） | EP 原生组件 + 本包自定义样式**同时**无样式（裸 HTML 外观）；JS 交互正常 | 无报错——因为"只改运行时"本就是 EP 文档明令禁止的不完整配置 |
| 只做步骤 2/3，不做步骤 1 | EP 组件发 `el-` 类，CSS 期望 `xxx-`：**EP 自己先坏**；本包 JS 跟随 `el-`，同样与 CSS 脱钩 | 本包 `probeNamespaceDom` 在有数据行时报 `TABLE_NAMESPACE_MISMATCH`（`source: 'dom-probe'`） |
| 步骤 1 与 `uiConfig.namespace` 写成两个不同值 | 立即 `TABLE_NAMESPACE_MISMATCH`（warn） | `use-table-config-guard.ts` 配置校验（`cause.uiConfigNamespace` vs `cause.epNamespace` 指名道姓） |
| 步骤 3 写在 `index.scss` 之后 | **构建直接失败** | SASS 编译器（模块已加载不可再配置），到不了运行时 |

## 常见误区

1. **"我只改 ConfigProvider，功能都正常啊"** —— JS 交互确实正常（自动跟随），坏的是视觉。裸 HTML 外观 + 无报错 = 典型的"漏做步骤 2/3"，不是 bug。
2. **"报错 `TABLE_NAMESPACE_MISMATCH` 是不是坏了"** —— 不是。这是设计好的响亮失败，读 `cause` 里指出的两个值，对齐它们即可。
3. **运行时切换命名空间** —— 不支持。JS 查询会即时跟随，但 CSS 构建期固化，切换后视觉必崩直至重建（见 README 命名空间章节）。
4. **`uiConfig.namespace` 该传吗** —— 不该（除非你有意与 EP 用不同前缀）。省略它，让本包跟随 EP，是唯一推荐路径；显式传值只会新增一个"两个真相源打架"的风险面。

## 相关文档

- 本包四元配对总表：README「Custom Element Plus namespace (four-way pairing)」
- 本包样式单点：`src/style/_ep-classes.scss`
- 运行时跟随实现：`src/composables/core/use-table-config.ts:324`
- 失配守卫与 DOM 实测：`src/composables/core/use-table-config-guard.ts`、`src/composables/core/use-adv-table-lifecycle.ts:128`
- EP 官方指南：https://element-plus.org/zh-CN/guide/namespace
