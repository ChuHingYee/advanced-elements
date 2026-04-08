# Security Guide | 安全指南

> 防护面：原型污染、XSS、公式注入、敏感列泄露

## 1. 原型污染 `security.ts:detectPrototypePollution`

- `__proto__/constructor/prototype` 自有属性扫描，`Object.hasOwn` 非 `in`
- `sanitizeRow` `Object.create(null)` 无原型副本，`sanitizeDataArray` 批量

## 2. XSS `print.ts:escapeHtml` `security.ts:sanitizeUrl`

- `escapeHtml` `<>&"'` 转义，`sanitizeUrl` 白名单 `http/https/mailto/tel` + 相对地址
- `resolveCellText` 纯文本单元格转义，`VNode` 不 `innerHTML`

## 3. 公式注入 `security.ts:neutralizeFormulaInjection`

- `^[=+\-@\t\r]` 前缀 `'` 中和，纯数字 `NUMERIC_VALUE_RE` 豁免

## 4. 敏感列 `stripSensitiveColumns`

- `sensitive:true` 列在 `export/print/copy` 咽喉剥离，`__tests__/integration/security.test.ts` 回归
