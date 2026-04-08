# @advanced-elements/rolldown-config

基于 [Rolldown](https://rolldown.rs) 的共享构建配置，与 `@advanced-elements/rollup-config` 接口一致。

## 迁移指南

### 1. 替换依赖

在消费方 `package.json` 中：

```diff
  "devDependencies": {
-   "@advanced-elements/rollup-config": "workspace:*",
-   "rollup": "^4.28.0",
+   "@advanced-elements/rolldown-config": "workspace:*",
+   "rolldown": "^1.2.13",
  }
```

### 2. 修改配置文件

将 `rollup.config.mjs` 重命名为 `rolldown.config.mjs`：

```diff
- import { createRollupPlugins } from '@advanced-elements/rollup-config'
+ import { createRolldownConfig } from '@advanced-elements/rolldown-config'

  const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))
- const config = createRollupPlugins(pkg, { input: 'src/index.ts' })
+ const config = createRolldownConfig(pkg, { input: 'src/index.ts' })
  export default config
```

### 3. 修改构建脚本

```diff
  "scripts": {
-   "dev": "rollup -c -w",
-   "build": "rimraf ./dist && rollup -c && vue-tsc -p tsconfig.dts.json"
+   "dev": "rolldown -c -w",
+   "build": "rimraf ./dist && rolldown -c && vue-tsc -p tsconfig.dts.json"
  }
```

## 与 rollup-config 的差异

| 项目 | rollup-config | rolldown-config |
|---|---|---|
| 核心打包器 | Rollup 4.x | Rolldown (Rust) |
| TS/JSX 转译 | `rollup-plugin-esbuild` | Rolldown 内置 oxc transform |
| 模块解析 | `@rollup/plugin-node-resolve` | Rolldown 内置 |
| CJS 转 ESM | `@rollup/plugin-commonjs` | Rolldown 内置 |
| 压缩 | `@rollup/plugin-terser` | `output.minify` 原生支持 |
| CSS/SCSS | `rollup-plugin-postcss` | 移除，改由内置 `processScss` 直调 dart-sass |
| Vue SFC | `@vitejs/plugin-vue` | 同 |
| Vue JSX | `@vitejs/plugin-vue-jsx` | 同 |
| Sourcemap | 不支持 | JS + CSS 均支持 |
| SCSS 增量编译 | 不支持 | 基于 mtime 缓存 |
| SCSS 语法 | `@import`（已废弃） | `@use ... as *` |

## 导出 API

```js
import { createRolldownConfig, generateExternal, processScss } from '@advanced-elements/rolldown-config'
```

- **`createRolldownConfig(pkg, options)`** — 返回完整的 Rolldown 配置对象
- **`generateExternal(pkg, externals)`** — 生成外部依赖过滤函数（支持 `optionalDependencies`）
- **`processScss(srcDir, destDir, isDev, options)`** — 编译 SCSS 并复制源文件（支持增量编译和 sourcemap）

## `createRolldownConfig` 选项

| 选项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `root` | `string` | `process.cwd()` | 包根目录；所有路径解析均以此为基准，与调用 cwd 无关 |
| `input` | `string` | `'src/index.ts'` | 入口文件 |
| `isDev` | `boolean` | `NODE_ENV === 'development'` | 开发模式标志 |
| `externals` | `string[]` | `[]` | 额外部依赖。传递依赖若仅经动态 `import()` 到达（如 `async-validator` 经 Element Plus 透传），也需在此声明，否则会被打进包造成重复 |
| `styleOutput` | `string` | `'dist/style'` | 样式输出目录 |
| `elementPlusStyleEntry` | `string \| null` | `null` | EP 样式副作用入口（dist 相对路径，如 `'style/element-plus.js'`）；设值即生成，不设即跳过 |
| `preserveModules` | `boolean` | `false` | 保留模块结构（仅 ESM 输出，利于消费方 tree-shaking） |
| `sourcemap` | `boolean` | `true` | 生成 JS 和 CSS 的 sourcemap（供 `analyze`/`size-limit` 调试；发布时 `prepack` 会删除 `dist/**/*.map`，包体积不受影响） |

### `elementPlusStyleEntry`

扫描源码中 `import { ElXxx } from 'element-plus'`，生成一个副作用 JS 入口，逐行复述本包内部使用的 EP 样式模块：

```js
import 'element-plus/es/components/base/style/css';
import 'element-plus/es/components/button/style/css';
// ...
```

描述符与 `ElementPlusResolver` 默认（`importStyle: 'css'`）输出逐字节一致，消费方打包器按 resolved id 去重——resolver 已注入的组件只打包一次，包独占的组件得以覆盖，版本恒为消费方的 peer EP。附带生成同名 `.d.ts`（内容仅 `export {}`，供 TS 解析）。

使用方必须同步做两件事（缺一即丢样式，构建期不报错，只能靠文档约束）：

1. `package.json` 增加导出项（仅 `import` 条件，CJS/SSR 请用全量 css）与 `sideEffects` 白名单：
   ```json
   {
     "sideEffects": ["*.scss", "*.css", "./dist/style/element-plus.js"],
     "exports": {
       "./style/element-plus": {
         "types": "./dist/style/element-plus.d.ts",
         "import": "./dist/style/element-plus.js"
       }
     }
   }
   ```
   白名单不可省略：包已声明 `sideEffects` 收窄时，纯副作用 `.js` 会被打包器当无副作用丢弃（与丢样式等价，且静默）。
2. 无样式目录的组件（如 `ElAutoResizer`，与 resolver 的 `noStylesComponents` 一致）会被跳过并告警；`importStyle: 'sass'` 的消费方因 ID 体系不同（`.../style/index`）仍会重复，请改用默认 css 模式或自行承担。

旧的“编译烘焙”方案（`_element-plus.scss` 打进包 + `index.no-ep.css` 衍生物）已删除：它把构建时 EP 版本烘焙进产物（与消费方运行时版本漂移），且多包叠加时 `base` 与共享组件重复；`_`-partial 不再独立输出 css（源码仍复制，保证 `@use` 可用）。

### `preserveModules`

保留模块结构，每个源码模块输出为独立文件（仅 ESM 格式）。适用于统一包（如 `@advanced-elements/elements`），让消费方的打包器能更好地 tree-shake 未使用的组件。

## 样式契约（必读）

本配置不含 postcss 插件，**所有样式必须放在 `src/style/*.scss`**，由内置的 `processScss` 管线编译进 `dist/style`。SFC `<style>` 块与裸 `.css` import 会被静默丢弃——构建期（`assert-style-contract`）扫到即抛错并指引迁移，不要绕过。

其他样式规则：

- `_` 开头的 partial 只被 `@use` 引用，不再独立输出 `<partial>.css`（源码仍会复制到 dist，保证 `@use 'pkg/dist/style/...'` 可用）。
- 构建不写 `src/`：除源码复制外无任何生成物落盘，不存在崩溃残留问题。

## 注意事项

- Rolldown 的 chunk splitting 算法与 Rollup 有差异，产物结构可能略有不同
- 建议先在最简单的包（如 `config-provider`）上验证，确认无误后再迁移其他包
- SCSS 增量编译基于文件 mtime，修改 `_*.scss` partial 文件后需删除 `dist/style` 目录强制全量重编译
