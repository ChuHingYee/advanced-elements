# ADR-004：结构化错误码新增门槛

> 状态：已实施（A7）| 日期：2026-09-22

## 生产可见条件（需同时满足）
1. 存量可运行配置不会因此新派发事件（显式 opt-in 冲突除外，如树+分组成双开、响应字段显式错配）；
2. `severity` 定级：可恢复 `warn`，不可恢复 `error`，纯通知 `info`（不进 error 流）；
3. 版本窗口：新码即新行为，进 minor 以上并记 CHANGELOG。

## 选用规则
可诊断性缺口（单模式 prop 静默失效、manual+source）走 dev-only `warnOnceDev`；
运行时可恢复异常（树+分组、响应畸形、拖拽失败）走 structured `reportOnce` + 中英词条。

## 现有码
`TABLE_CONFIG_CONFLICT` / `TABLE_RESPONSE_MALFORMED`（A7）即按此门槛生产可见。
