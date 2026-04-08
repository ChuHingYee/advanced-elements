import type { ComputedRef, MaybeRefOrGetter } from 'vue'
/**
 * @file debug-logger.ts
 * @description
 * <zh/> Debug 模式日志器——受 `debug` prop 控制，开启后输出详细的管线/编辑/选择/渲染诊断信息
 * <en/> Debug-mode logger — gated by the `debug` prop; emits detailed pipeline/edit/selection/render diagnostics
 *
 * @remarks
 * <zh/> 设计：运行时门控（非编译期消除），`debug` false 时所有调用零成本短路，生产期显式开启用于实时诊断；
 * <zh/> 按域过滤（data/edit/selection/render）；输出含 tableId + 域标签 + 颜色，便于多实例区分；用 Performance API 测各阶段耗时。
 * <zh/> 受众：库维护者与排障场景（本地复现/测试环境），不构成稳定公开 API——格式与域划分随内部重构可能调整，消费方不应据此分支。
 * <en/> Design: runtime-gated (not compile-time stripped) — `debug` false short-circuits at zero cost;
 * <en/> explicit production enable is supported for live diagnosis; domain filter (data/edit/selection/render);
 * <en/> output carries tableId + domain label + color for multi-instance disambiguation; Performance API for stage timings.
 * <en/> Audience: library maintainers and troubleshooting (local repro / test env); NOT a stable public API —
 * <en/> format and domain partition may change with refactors, consumers must not branch on it.
 */
import { computed, toValue } from 'vue'

/**
 * <zh/> 调试域——用于按域过滤日志输出
 * <en/> Debug domain — used for per-domain log filtering
 */
export type DebugDomain = 'data' | 'edit' | 'selection' | 'render' | 'interaction' | 'lifecycle'

/**
 * <zh/> 调试配置
 * <en/> Debug configuration
 */
export interface DebugConfig {
  /** <zh/> 是否启用调试模式 | <en/> Whether debug mode is enabled */
  enabled?: boolean
  /**
   * <zh/> 域过滤器——仅输出指定域的日志；不传或传空数组表示全域
   * <en/> Domain filter — only output logs for the specified domains; empty/omitted = all domains
   */
  domains?: DebugDomain[]
  /** <zh/> 是否输出性能计时 | <en/> Whether to output performance timing */
  perf?: boolean
}

/** <zh/> 域颜色映射 | <en/> Domain color map */
const DOMAIN_COLORS: Record<DebugDomain, string> = {
  data: '#42b883',
  edit: '#e67e22',
  selection: '#3498db',
  render: '#9b59b6',
  interaction: '#f39c12',
  lifecycle: '#e74c3c',
}

/**
 * <zh/> 创建调试日志器
 *
 * <zh/> 使用方式：
 * <zh/> ```ts
 * <zh/> const debug = createDebugLogger( => props.debug, core.tableId)
 * <zh/> debug.log('data', 'pipeline recomputed', { rows: data.length })
 * <zh/> debug.time('data', 'sort')
 * <zh/> // ... sort logic ...
 * <zh/> debug.timeEnd('data', 'sort')
 * <zh/> ```
 *
 * @param config - <zh/> 调试配置（maybe-reactive） | <en/> Debug config (maybe-reactive)
 * @param tableId - <zh/> 表格实例 ID | <en/> Table instance ID
 */
export function createDebugLogger(
  config: MaybeRefOrGetter<DebugConfig | boolean | undefined>,
  tableId: MaybeRefOrGetter<string>,
) {
  const resolvedConfig = computed<DebugConfig>(() => {
    const raw = toValue(config)
    if (raw == null)
      return { enabled: false }
    if (typeof raw === 'boolean')
      return { enabled: raw }
    return raw
  })

  /**
   * <zh/> 启用判定——显式开启即生效（含生产环境）。
   * <zh/> 修正恒真表达式 `(isDev || true)`：其与文件头"生产剥离"的声明矛盾。
   * <zh/> 现行为：debug 为运行时显式 opt-in，生产开启属合法调试手段（日志为运行时门控，
   * <zh/> 非编译期剔除）；文件头注释已同步修正。
   * <en/> Enablement — explicit opt-in works in ALL environments (including production).
   * <en/> Fixes the historical tautology `(isDev || true)` that contradicted the file-header
   * <en/> claim of "prod stripping". Debug logging is runtime-gated (not compile-time stripped),
   * <en/> so enabling it in production is a legitimate debugging tool; header comment updated.
   */
  const isEnabled = computed(() => {
    return resolvedConfig.value.enabled === true
  })

  function shouldLog(domain: DebugDomain): boolean {
    if (!isEnabled.value)
      return false
    const cfg = resolvedConfig.value
    const domains = cfg.domains
    if (!domains || domains.length === 0)
      return true
    return domains.includes(domain)
  }

  function prefix(domain: DebugDomain): string {
    const tid = toValue(tableId)
    return `%c[AdvTable:${tid}][${domain}]%c`
  }

  function style(domain: DebugDomain): string {
    const color = DOMAIN_COLORS[domain]
    return `color: ${color}; font-weight: bold;`
  }

  const log = (domain: DebugDomain, message: string, ...args: unknown[]) => {
    if (!shouldLog(domain))
      return
    if (typeof console !== 'undefined') {
      // eslint-disable-next-line no-console -- 本模块即日志器，console.log 是其输出通道（warn/error 语义不符）
      console.log(prefix(domain), style(domain), 'color: inherit;', message, ...args)
    }
  }

  const warn = (domain: DebugDomain, message: string, ...args: unknown[]) => {
    if (!shouldLog(domain))
      return
    if (typeof console !== 'undefined') {
      console.warn(prefix(domain), style(domain), 'color: inherit;', message, ...args)
    }
  }

  const error = (domain: DebugDomain, message: string, ...args: unknown[]) => {
    // error 域日志始终输出（即使 debug 关闭），但受域过滤控制
    const cfg = resolvedConfig.value
    const domains = cfg.domains
    const domainAllowed = !domains || domains.length === 0 || domains.includes(domain)
    if (!domainAllowed)
      return
    if (typeof console !== 'undefined') {
      console.error(prefix(domain), style(domain), 'color: inherit;', message, ...args)
    }
  }

  /**
   * <zh/> 性能计时——开始
   * <en/> Performance timing — start
   */
  const time = (domain: DebugDomain, label: string): void => {
    const cfg = resolvedConfig.value
    if (!cfg.enabled || !shouldLog(domain) || !cfg.perf)
      return
    if (typeof performance !== 'undefined') {
      performance.mark(`advtable:${toValue(tableId)}:${domain}:${label}:start`)
    }
  }

  /**
   * <zh/> 性能计时——结束并输出
   * <en/> Performance timing — end and output
   */
  const timeEnd = (domain: DebugDomain, label: string): void => {
    const cfg = resolvedConfig.value
    if (!cfg.enabled || !shouldLog(domain) || !cfg.perf)
      return
    if (typeof performance === 'undefined')
      return
    const tid = toValue(tableId)
    const startMark = `advtable:${tid}:${domain}:${label}:start`
    const endMark = `advtable:${tid}:${domain}:${label}:end`
    const measureName = `advtable:${tid}:${domain}:${label}`
    try {
      performance.mark(endMark)
      // <zh/> 同名 measure 先清除——修复“二次计时被拒”并防止缓冲无限增长；
      // <zh/> 计时后随即清理 start/end marks，长会话零残留。
      // <en/> Clear a same-name historical measure first -- fixes 'second timing refused'
      // <en/> and unbounded buffer growth; start/end marks are
      // <en/> cleared afterwards so long sessions leave zero residue.
      if (performance.getEntriesByName(measureName).length > 0)
        performance.clearMeasures(measureName)
      performance.measure(measureName, startMark, endMark)
      const measure = performance.getEntriesByName(measureName)
      const duration = measure[0]?.duration
      if (duration != null) {
        log(domain, `⏱${label}: ${duration.toFixed(2)}ms`)
        performance.clearMarks(startMark)
        performance.clearMarks(endMark)
      }
    }
    catch {
      // mark 不存在或重复测量时静默
    }
  }

  /**
   * <zh/> 创建域限定日志器——绑定域，简化调用
   * <en/> Create domain-scoped logger — binds domain for simpler calls
   */
  const scoped = (domain: DebugDomain) => ({
    log: (message: string, ...args: unknown[]) => log(domain, message, ...args),
    warn: (message: string, ...args: unknown[]) => warn(domain, message, ...args),
    error: (message: string, ...args: unknown[]) => error(domain, message, ...args),
    time: (label: string) => time(domain, label),
    timeEnd: (label: string) => timeEnd(domain, label),
  })

  return {
    log,
    warn,
    error,
    time,
    timeEnd,
    scoped,
    isEnabled: isEnabled as ComputedRef<boolean>,
  }
}

/** <zh/> 调试日志器返回类型 | <en/> Debug logger return type */
export type DebugLogger = ReturnType<typeof createDebugLogger>
