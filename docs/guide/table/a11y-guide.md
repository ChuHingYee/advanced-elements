# A11y Guide | 无障碍指南

> `role="grid"` `aria-rowcount/colcount` 双模式统一

## 1. 网格语义

- `table.vue:528` `role="grid"` 双模式统一（原仅 `virtual`）
- `aria-rowcount` 取 `visibleData.length ?? rendererData.length`，`aria-colcount` 取 `leafColumns.length`
- `aria-label` 取 `i18n.t('table.ariaLabel')` 回退 `Advanced Table`
- `table-renderer.vue:92` `aria-selected` 按 `Set.has` 同步，`>500` 行跳过

## 2. 键盘

- `Alt+←/→` 列宽调整 `10px` 步长 `DEFAULT_MIN_COLUMN_WIDTH`
- `Shift+Arrow` 范围扩展复用 `rangeSelection` 锚点

## 3. 校验

- `scripts/check-comment-convention.mjs` 双语校验 `// <zh/>` 必配 `<en/>`
- `vitest` `high-risk-combo` 覆盖 `a11y` 行列计数
