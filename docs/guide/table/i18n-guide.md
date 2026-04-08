# I18n Guide | 国际化指南

> `src/locale/lang/zh-cn.ts` `en.ts` 键集合 `scripts/check-i18n.mjs`

## 1. 校验

- `pnpm check:i18n` 对比 `zh/en` 键缺失，`CI` 阻断
- `207` 键，新增 `table.ariaLabel` 等需双文件同步

## 2. 使用

- `useTableI18n: t('table.xxx')` 回退原文，`dayjsLocaleName` 同步 `dayjs`
- `props.emptyText` 等透传 `t`，列 `label` 不经 `t`（业务侧）

## 3. 新增

- `zh-cn.ts` `en.ts` 同步键，`check:i18n` 通过后合入
