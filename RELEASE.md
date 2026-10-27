# 发版指南 / Release Guide

本文件是 `@advanced-elements/*` 包的发版唯一规范入口。工程门禁、commit/PR 约定见根 `CONTRIBUTING.md`；组件开发与测试见 `docs/guide/contributing.md`。

This is the single source of truth for releasing `@advanced-elements/*` packages. Engineering gates, commit/PR conventions live in root `CONTRIBUTING.md`; component development and testing live in `docs/guide/contributing.md`.

---

## 1. 版本号策略 / Versioning Policy

本仓 **独立发版**（per-package versioning）：各包版本号不同步，`table` 已到 `4.0.0` 而 `elements` 仍在 `2.x`。changeset 的 `updateInternalDependencies` 为 `patch`，升级某包时被它依赖的包自动升 patch。

This repo uses **independent per-package versioning**: package versions are not synchronized (`table` is 4.0.0 while `elements` is still 2.x). changesets `updateInternalDependencies: "patch"` auto-bumps dependent packages on a patch when a dependency moves.

### 1.1 bump 选择 / Choosing the bump

| 变更类型 | bump | 判据 |
|---|---|---|
| 修复 bug、性能、内部重构（无公开 API 变化） | `patch` | 消费者代码无需改动 |
| 新增公开 API、新组件、新增可选 props/emit | `minor` | 旧用法继续可用 |
| 删除/重命名公开 API、改变默认行为、breaking 行为变更 | `major` | 旧用法必须改代码 |

### 1.2 废弃三步法与 bump 的联动 / Deprecation ladder vs. bump

`CONTRIBUTING.md §公开 API 演进/废弃约定` 规定的三步：**标记（`@deprecated` + 替代者 + 移除版本）→ 告警（dev-only `devWarn`）→ major 删除**。

- **标记/告警** 阶段：`minor`（新增替代 API）或 `patch`（仅加告警）。
- **删除** 阶段：`major`，并且必须在 `docs/components/table.md` 迁移指南留档。

禁止：无标记直接改名/删参；`@deprecated` 不写替代者；废弃期短于 1 个 major。

### 1.3 changeset 怎么写 / Writing a changeset

```bash
pnpm changeset          # 交互式：选受影响包 + major/minor/patch + 中英双语说明
```

- 包名与 bump 类型按 §1.1 判定，勿手写 `.changeset/*.md`。
- 公开 API 变更同时更新 `docs/components/table.md` 并附 changeset（PR checklist）。
- changesets 按 `baseBranch: develop` 计算 dependent bumps；在 `develop` 上开发，勿切 `main`/`master` 跑 changeset。

---

## 2. 完整发版流程 / Full Release Flow

```
pnpm changeset                    # 1. 声明本次发版内容（develop 上）
pnpm release:version              # 2. 消费 changeset：写版本号 + CHANGELOG，打发版提交
git push origin HEAD              # 3. 推发版提交
git tag vX.Y.Z && git push origin vX.Y.Z   # 4. 推 tag → 触发 release workflow
# CI: build → test → typecheck → publish → GitHub Release
pnpm docs:release                 # 5. 文档站强推 gh-pages（可与 4 并行）
```

### 步骤 2 的细节 / Step 2 details

- `release:version` 会先跑 `changeset status --output` 抓取发布计划，再跑 `changeset version`（**`commit: false`**，由本脚本统一提交）。
- 工作区不干净时拒绝执行；确实要带着改动发版加 `--allow-dirty`，但发版提交只 `git add -- .changeset packages`，不会把其他改动卷进去。
- 提交信息为 `chore(release): <pkg>@<ver>, ...`（通过 `commit-msg` 钩子）。
- 建议的 tag 打印在结尾；tag 取本次**改动包**里版本号最高的一个（本仓独立发版，未改动的包版本高于 tag 是正常的）。

### 步骤 4 的 tag 约定 / Tag convention

- tag 格式 `vX.Y.Z`（稳定）或 `vX.Y.Z-rc.N` / `vX.Y.Z-beta.N`（预发）。
- tag **必须**打在 `release:version` 产出的 commit 上——tag 的 tree 必须已经带版本 bump。workflow 的第一道门禁会校验这一点。

---

## 3. 预发链路 / Prerelease (Beta) Flow

`release.ts` 旧实现已下线。beta 发布 = **changesets 预发模式 + tag 约定**，两步缺一不可：

**第 1 步 · 进入预发模式**。包版本必须带 `-beta.N`——`release:publish` 的门禁要求 tag 版本号与某个包的当前版本**完全一致**，普通版本号 + beta tag 会被拒：

```bash
pnpm changeset pre enter beta   # 进入预发模式（生成 .changeset/pre.json）
pnpm changeset                  # 照常写 changeset（自动落入 .changeset/pre/）
pnpm release:version            # 版本号落为 X.Y.Z-beta.N，打发版提交
```

**第 2 步 · 打 beta tag**。格式 `vX.Y.Z-beta.N`，`X.Y.Z` 取本次改动包的最高版本（独立发版，未改动包版本高于 tag 属正常）：

```bash
git push origin HEAD
git tag vX.Y.Z-beta.N && git push origin vX.Y.Z-beta.N
```

CI 行为（`.github/workflows/release.yml`，按 tag 名自动判定，无需手动干预）：

- tag 名含 `-` → GitHub Release 标记 `prerelease: true`，与稳定版分开；
- `RELEASE_TAG` 由 tag 名推断：`v2.2.0-beta.0` → npm dist-tag `beta`；稳定 tag → `latest`。**beta 不占 `latest`**；
- 本地手动发布仍可用 `RELEASE_TAG=beta pnpm release:publish`。

**转正**：稳定版发版前先 `pnpm changeset pre exit`（pre 模式下的 changeset 会回到 `.changeset/` 根目录继续有效），再走 §2 全流程——`changeset version` 把 `X.Y.Z-beta.N` 落为正式版 `X.Y.Z`。

---

## 4. 凭证与授权 / Credentials & Authorization

workflow（`.github/workflows/release.yml`）具备两套鉴权并存：

- **OIDC Trusted Publishing**：`permissions.id-token: write` + `NPM_CONFIG_PROVENANCE: true`。npmjs.com 上把本仓库注册为 trusted publisher 后，无需 token/OTP，provenance 自动签名。**推荐**。
- **长期 token + OTP**：`NPM_TOKEN` + `NPM_OTP` secrets。OTP 走 `NPM_CONFIG_OTP` 环境变量（不是 CLI flag——`@changesets/cli` 自己读它，并在 spawn `npm publish` 前剥掉、改用 `--otp` 显式传参；CLI flag 曾被静默丢弃）。

**谁可以发版**：能 push `v*` tag 的人（受 `CODEOWNERS` / branch protection 约束）。tag 推送前务必确认 `develop` 上的 CI 全绿。

---

## 5. 失败补救 / Recovery

`release:publish` 的门禁会在以下情况**发布之前**就失败，不会污染 registry：

1. 未消费的 changeset 存在 → tag 打在版本 bump 之前。
2. tag 版本与任何包版本都不一致 → 同上。
3. tag 版本与本次改动包的最高版本不一致 → 漏推/打早。

**发布过程中**失败（网络、OTP 过期、部分包已发）：

- `changeset publish` 是幂等的：已发的包会被 npm 跳过（"previously published"），重新跑 `pnpm release:publish` 即可。
- **不要**重新跑 `release:version`——版本号已落定，重跑会再 bump 一次。
- 若 tag 已推但版本号有误：删 tag（`git push origin :refs/tags/vX.Y.Z` + `git tag -d vX.Y.Z`），在 `develop` 上修正后重新 `release:version` → 新 tag。
- GitHub Release 已创建但 publish 失败：workflow 顺序保证 publish 先于 Release，正常情况下不会出现；若手动创建了，删掉 draft 重新跑。

`release:version` 的发版提交可回滚：`git reset --soft HEAD~1` + `git checkout HEAD -- packages .changeset`。

---

## 6. 本地验证（不污染公共源）/ Local Verification

发版前用 verdaccio 全链路演练，不改版本号、不跑 `changeset version`：

```bash
pnpm release:verify                              # 全量：构建 → 发布到本地 → 消费者安装 + 导入冒烟
pnpm release:verify -- --only=@advanced-elements/table
pnpm release:verify -- --skip-build
pnpm release:verify -- --registry=http://localhost:4873
pnpm release:verify -- --keep
```

校验内容：tarball 含 `dist/` + README + LICENSE、无 `.map`/源码泄漏、包内版本号一致、真实 `npm publish` 到本地成功、消费者全新安装后可导入。

---

## 7. 文档站 / Docs Site

```bash
pnpm docs:release    # 构建并强推 gh-pages
```

文档站示例是真组件（`docs/examples/**/*.vue`），改示例等于改文档——发版前确认 `pnpm docs:build` 通过。

---

## 8. 包发布元数据约定 / Package Publishing Metadata

可发布包必须具备（除 `table` 外其余三个包仍缺，见下）：

- `publishConfig.access: "public"`（scoped 包必填）
- `repository` / `homepage` / `bugs` / `keywords`
- `files` 至少含 `dist` 与 `README.md`/`LICENSE`
- 根目录放 `README.md` 与 `LICENSE`

`release:verify` 的 packlist 检查现在对 README.md / LICENSE 做**硬失败**（不再条件跳过）：任何可发布包的 tarball 缺了这两个文件都会红。新增包请按 `packages/table` 的元数据为模板。

---

## 9. 安全漏洞上报 / Security

公开依赖库的漏洞上报通道：见根目录 `SECURITY.md`（如缺失请先创建）。内部安全门禁（`pnpm audit`、xlsx 可选 peer 等）见 `pnpm-workspace.yaml` 安全说明。
