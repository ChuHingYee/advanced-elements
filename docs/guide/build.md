# 构建底座（@advanced-elements/rolldown-config）

各包共享的 Rolldown（Rust）构建配置，源码在 `dev-packages/rolldown-config`（私有包，不发布）。新包照抄三步即接入。

## 新包接入三步

1. **替换依赖**（`package.json`）：
   ```json
   "devDependencies": {
     "@advanced-elements/rolldown-config": "workspace:*"
   }
   ```
2. **建配置**（`rolldown.config.mjs`）：
   ```js
   import { createRolldownConfig } from '@advanced-elements/rolldown-config'

   const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))
   const config = createRolldownConfig(pkg, { input: 'src/index.ts' })
   export default config
   ```
3. **接脚本**：
   ```json
   "scripts": {
     "dev": "rolldown -c -w",
     "build": "rimraf ./dist && rolldown -c && vue-tsc -p tsconfig.dts.json",
     "prepack": "rimraf --glob \"./dist/**/*.map\""
   }
   ```

另需在包 `package.json` 补齐 CI 约定的同名脚本：`test`、`typecheck`、`coverage`、`clean`（最小集参考 `packages/resolvers`）。

## 导出 API

```js
import { createRolldownConfig, generateExternal, processScss } from '@advanced-elements/rolldown-config'
```

- **`createRolldownConfig(pkg, options)`**——返回完整 Rolldown 配置。选项：`root`（默认 `process.cwd()`）、`input`（默认 `'src/index.ts'`）、`isDev`（默认 `NODE_ENV === 'development'`）、`externals`（额外外部依赖；经动态 `import()` 间接触达的传递依赖如 `async-validator` 也要声明，否则被打进包造成重复）、`styleOutput`（默认 `'dist/style'`）、`elementPlusStyleEntry`（见下）、`preserveModules`（仅 ESM，统包如 elements 开启以利 tree-shaking）、`sourcemap`（默认 `true`，发布时 `prepack` 删除）。
- **`generateExternal(pkg, externals)`**——生成外部依赖过滤函数（支持 `optionalDependencies`）。
- **`processScss(srcDir, destDir, isDev, options)`**——编译 SCSS 并复制源文件（增量 + sourcemap）。

与旧 rollup-config 的差异：oxc 内置转译/模块解析/CJS 转 ESM/`output.minify` 原生压缩；CSS 改直调 dart-sass；SFC `<style>`/裸 css 由 `assert-style-contract` 拦截。

## 样式契约（必读）

- 所有样式必须放在 `src/style/*.scss`，由 `processScss` 编译进 `dist/style`；`_` 开头 partial 只被 `@use` 引用，不独立输出 css（源码仍复制，保证 `@use 'pkg/dist/style/...'` 可用）。
- SCSS 用 `@use ... as *`（`@import` 已废弃）；`_` partial 改动后删 `dist/style` 强制全量重编（增量基于 mtime）。
- `elementPlusStyleEntry`（如 `'style/element-plus.js'`）：扫描源码 `import { ElXxx } from 'element-plus'` 生成副作用入口，逐行复述内部使用的 EP 样式模块（与 `ElementPlusResolver` 默认输出逐字节一致，消费方打包器按模块去重）。使用方必须同步在 `package.json` 加 `exports["./style/element-plus"]`（仅 `import` 条件）与 `sideEffects` 白名单，否则纯副作用 js 会被静默丢弃（构建期不报错）。

## 体积门禁（table 为例）

| 检查 | 命令 | 预算 | 含义 |
|------|------|------|------|
| size-limit | `pnpm --filter @advanced-elements/table size` | `index.mjs ≤240KB` / `index.cjs ≤245KB` / `style/index.css ≤30KB`（gzip，含依赖打包；esbuild 口径） | 防依赖膨胀 |
| bundle 回归 | `check:bundle`（`check-bundle-size.mjs && analyze-bundle.mjs`） | `dist/index.mjs gzip <120KB` + 重依赖（lodash-es/dayjs/xlsx/async-validator/vue-draggable-plus/nanoid）必须外部化 | 防产物膨胀；可出 `--json/--html` 报告，`ANALYZE=1` 出 `dist/stats.html` |

## 故障排查

- `rolldown: command not found`——根 `node_modules/.bin` 链接层丢失（`shamefullyHoist` 布局假设），跑 `pnpm deps:fix`（先 `-- --dry-run` 体检）。
- `pnpm install` 秒回但构建缺二进制——同上，pnpm 状态文件与产物不一致的标准症状。
