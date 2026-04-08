# E2E | 端到端

> `__tests__/components/e2e/full-pipeline.test.ts` `browser` 真实 DOM 全链路

## 1. 覆盖

- `filter+sort+pagination+tree` `virtual` `400px`
- `mount` 不白屏 `adv-table` 存在

## 2. 运行

- `pnpm --filter @advanced-elements/table test:browser` 需 `playwright install`
- `CI` 已 `Install Playwright chromium` `Browser tests` 2 步

## 3. 基线

- `__screenshots__` 阈值 `0.01`，`visual-regression` `screenshot` 双基线 `Stage27`
- `e2e/full-pipeline` `browser` 全链路 `filter+sort+pagination+tree` `400px`
- `e2e/screenshot` `threshold 0.01` 允许抗锯齿 `1%` 像素差异
