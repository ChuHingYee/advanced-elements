## What / 变更内容

<!-- 简述改动与动机；关联 Issue 用 Fixes #123 -->

## Type / 变更类型

- [ ] feat
- [ ] fix
- [ ] refactor
- [ ] perf
- [ ] test
- [ ] docs / build / ci / chore

## Checklist

- [ ] `pnpm lint:table` 通过
- [ ] `pnpm --filter @advanced-elements/table typecheck` 通过
- [ ] 补充/更新了测试（含双模式 parity 场景如适用）
- [ ] 公开 API 变更附 changeset 与文档更新
- [ ] 双实现检查：跨路径规则已查 `docs/ownership-matrix.md`，无重复实现
- [ ] 新增跨层字段走按域注入（`src/types/injection-keys.ts`），未新增上帝字段
- [ ] 新增 caps/错误码/API 已同步类型↔清单↔运行时三锚点
