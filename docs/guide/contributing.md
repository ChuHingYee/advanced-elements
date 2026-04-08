# 协作开发指南

本页面向**本仓库的贡献者**（与消费者看的[快速开始](/guide/getting-started)相对）。消费者文档只承诺发布产物；这里记录改源码必须过的门禁链。

## 环境

| 工具 | 要求 |
|------|------|
| Node.js | `>=22` |
| pnpm | `>=9`（仓库锁定 `12.11.2`，见根 `package.json:packageManager`） |

```bash
pnpm install          # 必须用 pnpm；preinstall 会拦截 npm/yarn
```

共享依赖走 `pnpm-workspace.yaml:catalog:` 单一版本源，禁止同一依赖多版本并存。`pnpm install` 秒回 `Already up to date` 但 `.bin` 缺失时，跑 `pnpm deps:fix`（先体检：`pnpm deps:fix -- --dry-run`）。

## 本地开发

```bash
pnpm dev:all          # turbo 并行起各包 watch 构建 + play（vite），改源码即 HMR
```

- **无需手动 `build:all`**：play 经 vite alias + tsconfig paths 直连各包 `src`，无 dist 也能启动；唯一的 dist 依赖（vite.config 自身引用的 `@advanced-elements/resolvers`）由 `predev` 缺失时自动补构建。
- **聚焦单包**：`pnpm --filter @advanced-elements/table dev` + 另开终端 `pnpm play`，减少 watch 进程。
- 新增入口文件（非已有入口 import 到的新文件）rolldown watch 可能感知不到，重启对应 `dev`。
- play 本身是未定制的 vite 模板（路由挂各包 demo）；新增页面级 demo 在 `play/src` 加路由即可。

## 文档站示例 demo

文档站的示例是**真组件**：`docs/examples/**/*.vue` 里的 SFC 既渲染示例区，也原样作为源码面板内容（构建期读源码 → 走 VitePress 的 shiki 高亮），因此不存在「文档代码与 demo 实现漂移」。结构对齐 element-plus 的示例卡片：**标题在卡片外，卡片内依次是示例区、操作栏、可折叠源码**。

```md
:::demo 单元格编辑 table/cell-editing.vue
:::
```

- 容器插件 `docs/.vitepress/markdown/demo-container.mjs`（注册在 `config.js` 的 `markdown.config`）：构建期校验文件存在、把源码塞进 fence token，并按 `demo-name.mjs` 的规则写出预览组件标签；文件名写错直接构建失败。
- 主题侧 `import.meta.glob` 把每个 demo 注册为同名全局组件（懒加载），两侧共用 `docs/.vitepress/demo-name.mjs` 的命名规则。
- 操作栏 4 个按钮：StackBlitz 在线编辑（`?file=` 深链到该示例）、GitHub 编辑此示例、复制代码、展开/收起源码。前三个由插件在构建期直接写死 `href`，仓库地址可用 `DOCS_REPO_URL` / `DOCS_REPO_BRANCH` / `DOCS_STACKBLITZ_URL` 覆盖。
- 展开/收起源码是**纯 CSS**：`.demo-block` 的首个子元素是隐藏 checkbox，操作栏 label 用 `for` 关联，兄弟选择器切换 `.demo-source` 的 `display`，无 JS 也能用。
- 复制代码需要一次性事件委托（`docs/.vitepress/theme/demo-actions.mjs`），源码从已高亮的 DOM 反解，不额外打进 bundle；非安全上下文回落 `textarea + execCommand`。
- 示例区包在 `<ClientOnly>` 里：ElTableV2 虚拟网格依赖实测尺寸，服务端渲染不出行，客户端补渲染必然 hydration mismatch。
- 示例内 `import { AdvTable } from '@advanced-elements/table'` 经 vite alias 直连 `packages/table/src`（与 vitest alias 同理），库样式同样直连 src scss，改组件源码即见效果。
- 写作要求：示例必须**自包含且可复制运行**（自带 columns/data/事件处理），别留 `columns`、`data` 这类未定义变量；props 形态以 `packages/table/src/types` 为准——示例即文档，类型改了要同步改示例。
- 该写 demo 的位置：组件页面的「用法 / 示例」章节（`/components/*`）；纯配置类页面（如[按需导入](/components/resolver)）没有可渲染产物，不必硬凑。
- 本地验收：`pnpm docs:build` 通过后开 `pnpm docs:dev`，切到示例页点一遍（操作栏四个按钮、弹层、编辑、分页都真实可用）。

## 门禁链（按 CI 执行顺序）

CI（`.github/workflows/ci.yml`）拆成 6 个并行 job；本地用同样命令预跑。

| 顺序 | 命令 | 门禁 |
|------|------|------|
| lint | `pnpm lint:table` | table 包 0 error（`--max-warnings 0` 棘轮，新增 warning 即红） |
| lint | `pnpm --filter @advanced-elements/table check:comment/check:i18n/check:hook-size/check:namespace-aliases/check:ep-props/check:ep-selectors` | 注释规范、中英键对齐、hook 300 行（warn）、SCSS 命名空间、EP props/selectors 守卫 |
| test | `pnpm turbo run typecheck` | 全包类型检查（table/elements/config-provider 用 vue-tsc，resolvers 用 tsc）；`turbo` 按 `dependsOn: [^build]` 自动先构建 workspace 依赖 |
| test | `pnpm turbo run test` | 全包单测（各包 `test` 脚本即安全默认，table 限定 unit）；新包实现同名 `test` 脚本即自动接入，无需改 CI |
| test | `pnpm --filter @advanced-elements/table coverage` | 覆盖率硬门禁：statements 85 / branches 75 / functions 85 / lines 85（分支阈值按 2026-08 实测基线 78.04% 校准，见 `vitest.coverage.config.ts` 注释） |
| browser | `pnpm --filter @advanced-elements/table test:browser` | 真 Chromium（Playwright）；目前仅 table 有 browser project |
| build | `pnpm build:all`（=`turbo run build --filter=./packages/*`） | 各包 `rimraf ./dist && rolldown -c && vue-tsc -p tsconfig.dts.json`；`prepack` 删除 `dist/**/*.map` |
| build | `pnpm docs:build` | 文档站必须能构建通过（含死链检查） |
| build | `pnpm --filter @advanced-elements/table size` + `check:bundle`，`pnpm --filter @advanced-elements/elements size` | 体积双保险：table 的 size-limit（`dist/index.mjs ≤240KB` / `index.cjs ≤245KB` / `style/index.css ≤30KB`，gzip）+ `dist/index.mjs gzip <120KB` 及重依赖外部化断言；elements 聚合包 `dist/index.mjs/cjs ≤5KB` 防实现被打进统包 |
| audit | `pnpm audit --audit-level=moderate` | 全仓一次；可修复走 `pnpm-workspace.yaml:overrides`，无补丁 2 项（xlsx×2）走同文件 `audit.ignore`（见该文件安全说明） |
| benchmark | `pnpm --filter @advanced-elements/table benchmark` | 仅信息上报（`continue-on-error`），共享 runner 抖动大，不阻塞合入 |

> **新包接入 CI 零改动**：在包 `package.json` 里实现 `build / test / typecheck / coverage / clean` 同名脚本即可（参考 `packages/resolvers` 最小集）；table 专属检查（size/bundle/阈值覆盖率/browser）保留显式 `--filter`，其他包按需增补（聚合包建议加 `size`，参考 `packages/elements`）。

## 提交与 PR

- 提交信息遵循 Conventional Commits（`feat/fix/docs/style/refactor/perf/test/build/ci/chore/revert` + 可选 scope），`commit-msg` 钩子自动校验；`pre-commit` 跑 `lint-staged`（`eslint --fix`）。
- PR Checklist：`lint:table` 通过、单包 typecheck 通过、行为变更附单测（双渲染模式补 parity）、**公开 API 变更更新 `docs/components/table.md` 并附 changeset**。
- 注释遵循根目录 `COMMENT_CONVENTIONS.md` 双语约定（`<zh/>` 在前）：props/emits/expose/工具/类型写 JSDoc，组件头/slot 写 HTML 注释；纯透传、测试、私有 helper 不写。
- `TableExpose` 只增不硬断：废弃走"标记（`@deprecated` + 替代者 + 移除版本）→ dev-only 告警 → major 删除"三步；新增 expose 方法须论证"props/事件无法表达"并同步 `docs/guide/table/api-coverage.md`。

## 发版（changeset → tag → publish）

完整规范见仓库根目录 [`RELEASE.md`](https://github.com/ChuHingYee/advanced-elements/blob/develop/RELEASE.md)。简版：

1. 改完附 **changeset**（`pnpm changeset`，勿手写）：声明受影响包 + major/minor/patch，中英双语说明（版本号策略与废弃三步法见 `RELEASE.md §1`）。
2. 本地落版本号：`pnpm release:version`（消费 changeset → 写版本号/CHANGELOG → 打发版提交），再 `git push origin HEAD && git tag vX.Y.Z && git push origin vX.Y.Z`。
3. CI：tag 触发 release workflow（build → test → typecheck → publish → GitHub Release）。发版前演练：`pnpm release:verify [-- --only=@advanced-elements/table] [-- --skip-build]`（本地 verdaccio，不改版本号）。
4. 文档站：`pnpm docs:release` 构建并强推 `gh-pages`。
