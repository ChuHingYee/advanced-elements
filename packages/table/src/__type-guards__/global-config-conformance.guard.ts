import type { AdvTableConfig } from '@advanced-elements/config-provider'
import type { AdvTableProps } from '../types/table-props'

/**
 * <zh/> 全局配置键一致性门禁（编译期闸门，随 `npm run typecheck` 执行）
 *
 * <zh/> 锁定 `AdvTableConfig` 的 key 必须存在于 `AdvTableProps`（或全局专属白名单），
 * <zh/> 防止 provider 加字段而 table 不消费、或 table 改 prop 名而 provider 仍用旧 key 的静默漂移。
 * <zh/> 若门禁失败：要么是 provider 误增字段（删之或在 table 侧接入消费），
 * <zh/> 要么是 table 改名（同步更新 provider 类型），禁止直接放宽白名单。
 * <en/> Global-config key conformance gate (compile-time, runs with `npm run typecheck`).
 *
 * <en/> Pins every `AdvTableConfig` key to an existing `AdvTableProps` key (or the global-only
 * <en/> allowlist), catching silent drift where the provider gains fields the table never reads
 * <en/> or the table renames a prop the provider still sets. On failure: either the provider
 * <en/> added a stray field (remove it or wire consumption table-side), or the table renamed
 * <en/> something (sync the provider type). Do not widen the allowlist to silence it.
 */

/**
 * <zh/> 仅全局生效、无对应 prop 的合法键白名单
 * <en/> Allowlisted keys that are global-only by design, with no matching prop
 */
type GlobalOnlyKeys = 'notify'

/** <zh/> 不在 props 与白名单中的多余键 | <en/> Surplus keys in neither props nor the allowlist */
type UnexpectedKeys = Exclude<keyof AdvTableConfig, keyof AdvTableProps<any> | GlobalOnlyKeys>

type Expect<T extends true> = T
type IsNever<T> = [T] extends [never] ? true : false

export type _GlobalConfigKeysConform = Expect<IsNever<UnexpectedKeys>>
