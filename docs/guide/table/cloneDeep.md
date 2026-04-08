# CloneDeep 选型 | CloneDeep Choice

> `use-columns.ts:179` `deepCloneColumnTree` 为何保留 `lodash-es`

## 1. 场景

- 列树含 `Date` `RegExp` `Function` `Map/Set`（`render` `formatter` `children` 递归）
- `cloneDeep` 需正确处理上述类型且保留 `Function` 引用

## 2. 对比

| 方案 | `Function` | `Date/RegExp` | `HTTPS` 限制 | 体积 |
|------|------------|---------------|--------------|------|
| `lodash-es cloneDeep` | ✅ 保留 | ✅ | 无 | `~4KB` `tree-shaking` |
| `structuredClone` | ❌ 抛错/丢失 | ✅ | 需 `HTTPS` 安全上下文 | `0KB` 原生 |
| `JSON.parse/stringify` | ❌ 丢失 | ❌ `Date→string` | 无 | `0KB` |

## 3. 结论

- `lodash-es` 仅 `cloneDeep` 被打包，`~4KB` 可接受
- `Stage25` 评估 `structuredClone` 在 `render` 函数场景会出错，保留 `lodash`

## 4. 回归

- `__tests__/unit/cloneDeep.test.ts:1` `Date/RegExp/Function` 深拷贝正确性
- `structuredClone` 对 `Function` 抛错/丢失已回归
