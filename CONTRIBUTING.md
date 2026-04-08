# Contributing to advanced-elements

感谢关注本项目！请阅读以下约定后再提交 PR。 / Thanks for your interest! Please follow the conventions below before opening a PR.

## 开发环境 / Setup

```bash
pnpm install          # Node >= 22, pnpm >= 9
pnpm dev:all          # turbo 并行起各包 watch 构建 + play（vite），改组件源码即 HMR
```

> **无需手动 `build:all`**：play 的组件/样式导入经 vite alias + tsconfig paths 直连各包 `src`
> （见 `play/vite.config.ts` 发版无关的 dev 别名），无 dist 也能启动；唯一的 dist 依赖
> （vite.config 自身引用的 `@advanced-elements/resolvers`）由 `predev`（`scripts/ensure-play-deps.mjs`）
> 缺失时自动补构建。`pnpm build:all` 只在验证产物/发版前需要。
>
> **聚焦单包**：`pnpm --filter @advanced-elements/table dev` + 另终端 `pnpm play`，减少 watch 进程。
> 新增入口文件（非已有入口 import 到的新文件）rolldown watch 可能感知不到，需重启对应 `dev`。
>
> **No manual `build:all` needed**: play's component/style imports link each package's `src`
> directly via vite aliases + tsconfig paths (dev-only aliases in `play/vite.config.ts`, irrelevant
> to releases), so it boots without dist; the single remaining dist dependency
> (`@advanced-elements/resolvers`, imported by vite.config itself on the Node side) is
> auto-built when missing by `predev` (`scripts/ensure-play-deps.mjs`).
> `pnpm build:all` is only needed to verify artifacts / before releases.
>
> **Focus on one package**: `pnpm --filter @advanced-elements/table dev` plus `pnpm play` in
> another terminal, to cut watch processes. New entry files (not imported by existing entries)
> may go unnoticed by rolldown watch — restart the corresponding `dev` then.

> **提交被 `Command "lint-staged" not found` 挡住？** 如果同时 `pnpm install` 秒回 `Already up to date`，
> 说明 `node_modules/.bin` 链接层整体丢失（pnpm 凭 `node_modules/.pnpm-workspace-state.json` 判定"无需安装"，
> 不校验 `.bin`，因此永远不会自愈）。执行 `pnpm deps:fix` 修复；想先体检不修改就用 `pnpm deps:fix -- --dry-run`。
>
> **Commit blocked by `Command "lint-staged" not found`?** If `pnpm install` also answers `Already up to date`
> instantly, the `node_modules/.bin` link layer is gone (pnpm decides "nothing to install" from
> `node_modules/.pnpm-workspace-state.json` and never verifies `.bin`, so it cannot self-heal).
> Run `pnpm deps:fix`; to inspect without touching anything, `pnpm deps:fix -- --dry-run`.

## 提交规范 / Commit Convention

提交信息遵循 Conventional Commits（`scripts/verify-commit.ts` 会在 commit-msg 钩子校验）：

```
feat(table): 支持 applyTransaction 增量事务
fix(table): 修复行拖拽异步守卫的陈旧数据覆写
```

允许的类型：`feat | fix | docs | style | refactor | perf | test | build | ci | chore | revert`

## PR 要求 / PR Checklist

- [ ] `pnpm lint:table` 通过（table 包 0 error 门禁）
- [ ] `pnpm --filter @advanced-elements/table typecheck` 通过
- [ ] 新增/变更行为附带单元测试；涉及双渲染模式时补充 parity 测试
- [ ] 公开 API 变更已更新 docs/components/table.md 并附 changeset

## Lint 门禁（棘轮）/ Lint Gate (Ratchet)

- 本仓无独立 prettier：格式化由 antfu ESLint 承担，`pnpm lint`（= `pnpm format`，均为 `eslint . --fix`）即格式化入口。
- `lint:check`（`--max-warnings 0`）与 `lint:table`（`--max-warnings 0`）的数字是刻意顶格的棘轮值：
  新增 warning 即红。如需上调，先还清既有 warning 债务再收紧数字，禁止无故放宽。
- No standalone prettier here: formatting is provided by antfu ESLint; `pnpm lint` (= `pnpm format`, both `eslint . --fix`) is the formatter entry.
- The numbers in `lint:check` (`--max-warnings 0`) and `lint:table` (`--max-warnings 0`) are intentional at-the-limit ratchets:
  any new warning turns red. To raise them, pay down existing warning debt first; never loosen without cause.

## 类型检查 / Typecheck

```bash
pnpm typecheck            # turbo 聚合各包 typecheck（table/form/elements/config-provider 用 vue-tsc，resolvers 用 tsc）
pnpm --filter @advanced-elements/table typecheck   # 单包
```

根 `tsconfig.json` 仅为被各包继承的基座（`files: []`，自身无输入），真正的类型入口是各包的
`tsconfig.json` + `play` 的 project references（`vue-tsc --build`）。
`pnpm build:all` 内的 `vue-tsc -p tsconfig.dts.json` 负责声明产物，`noEmitOnError: true`，类型红则不产出 `.d.ts`。

```bash
pnpm typecheck            # turbo aggregates per-package typechecks (vue-tsc for table/form/elements/config-provider, tsc for resolvers)
```

The root `tsconfig.json` is a base config inherited by packages (`files: []`, no inputs of its own);
real type entries are each package's `tsconfig.json` plus `play`'s project references (`vue-tsc --build`).
Declaration output is emitted by `vue-tsc -p tsconfig.dts.json` in `pnpm build:all` with `noEmitOnError: true` —
red types produce no `.d.ts`.

## 公开 API 演进/废弃约定 / Public API Evolution & Deprecation

`TableExpose`（约 100 方法）只增不硬断，收敛走以下三步（对应 changeset 类型）：

1. **标记**：旧 API 加 `@deprecated`（注明替代者 + 移除版本），实现保留转发至少 1 个 major：
   ```ts
   /** @deprecated 用 setSort 代替，将在 v4 移除 */
   toggleSort?(...args: unknown[]): void
   ```
2. **告警**：转发体内 dev-only `devWarn` 一次（`devWarnRepeat`），生产零开销；
3. **移除**：major 版本删除，并在 `docs/components/table.md` 迁移指南留档。

禁止：无标记直接改名/删参；`@deprecated` 不写替代者；废弃期短于 1 个 major。

## expose 冻结 / Expose Freeze

`TableExpose`（约 100 成员）只减不增：新能力优先走 props/事件/插槽；确需新增 expose 方法须在 PR 中论证"props/事件无法表达"并同步 `docs/guide/table/api-coverage.md`。内部态（标"内部"者）禁止新增外部依赖。

## 测试 / Tests

```bash
cd packages/table
pnpm test      # happy-dom 单测（含双模式 parity），安全默认无需 chromium
pnpm coverage                     # 全量 + 覆盖率阈值门禁
```

## 发布验证（测试模式）/ Release Verify (Test Mode)

发版前可用本地 verdaccio 验证"版本发布是否正确"，不污染公共 registry：

```bash
pnpm release:verify                            # 全量：构建 → 发布到本地 → 消费者安装 + 导入冒烟
pnpm release:verify -- --only=@advanced-elements/table   # 只验 table 包
pnpm release:verify -- --skip-build           # 复用现有 dist
pnpm release:verify -- --registry=http://localhost:4873  # 发到常驻私有库（包保留，tag 为 test-verify）
pnpm release:verify -- --keep                 # 保留 verdaccio 与临时目录手动排查
```

校验内容：tarball 含 `dist/` + README + LICENSE、无 `.map`/源码泄漏、包内版本号一致、
真实 `npm publish` 到本地成功、消费者全新安装后可导入（table 断言 `AdvTable` /
`registerCellEditor` / `registerFilterType`）。本模式不改版本号、不跑 `changeset version`。

## 代码风格 / Style

- 遵循根目录 `COMMENT_CONVENTIONS.md` 的双语注释约定（`<zh/>` / `<en/>`）
- Vue 组合式 API：`shallowRef` 优先、computed 派生、禁止在 watch 回调中注册生命周期钩子
- 安全契约：所有数据出口（导出/打印/剪贴板）必须经过 `utils/security.ts` 的统一过滤
