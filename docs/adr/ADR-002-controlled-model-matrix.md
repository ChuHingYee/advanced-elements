# ADR-002：受控模型统一矩阵

> 状态：已实施 | 日期：2026-09-22

## 规则
| 字段 | 门控 | 未受控后果 |
|---|---|---|
| `data` + `editConfig` | `hasUpdateDataListener() \|\| v-model:data \|\| setResponseData` 任一成立即不告警，否则 `TABLE_UNCONTROLLED_EDIT_SHADOW` | 编辑写回只进内部模型，父推送覆盖 |
| `columns` + 列交互 | 显式 opt-in（列拖拽任一级别 / `toolbar.columnSetting===true`）+ 无 `update:columns` 监听即告警 `TABLE_UNCONTROLLED_COLUMNS_SHADOW` | 同上，列维度 |
| `manual` + `request.source` | dev 提示 `DEV_MANUAL_SOURCE_CONFLICT`，不阻断（A1：可并存但不推荐） | 误以为自动拉取，实际只派发 `request` 事件 |

## 新增双向字段要求
必须配守卫（`hasUpdateXListener` 矩阵项 + 文档 + 单测），否则不合入。
