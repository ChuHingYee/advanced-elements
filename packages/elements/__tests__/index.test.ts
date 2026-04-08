/**
 * @advanced-elements/elements — 入口测试
 *
 * 测试默认导出的 plugin 结构、.install 方法及具名导出
 * vi.mock 会在模块导入前被 hoist，所以 mock 后的 import 会自动应用。
 */
import { describe, expect, it, vi } from 'vitest'

// vi.mock hoist 后，此处 import 自动应用 mock
import plugin, {
  advConfigKey,
  AdvConfigProvider,
  AdvTable,
  useAdvConfig,
  useColumns,
  useRequest,
} from '../src/index'

// Mock 子包以避免 runtime 依赖 chain（vi.mock 会被 hoist 到 import 之前）
vi.mock('@advanced-elements/config-provider', () => {
  const AdvConfigProvider = { render: null, name: 'AdvConfigProvider' }
  const plugin = Object.assign(AdvConfigProvider, {
    install: (app: any) => app.component('AdvConfigProvider', AdvConfigProvider),
  })
  return {
    default: plugin,
    advConfigKey: Symbol('advConfigKey'),
    provideAdvConfig: vi.fn(),
    useAdvConfig: vi.fn(() => ({ value: {} })),
  }
})

vi.mock('@advanced-elements/table', () => {
  const AdvTable = { render: null, name: 'AdvTable' }
  const plugin = Object.assign(AdvTable, {
    install: (app: any) => app.component('AdvTable', AdvTable),
  })
  return {
    default: plugin,
    AdvTable,
    useColumns: vi.fn(),
    useRequest: vi.fn(),
  }
})

describe('@advanced-elements/elements 入口', () => {
  it('默认导出带有 .install 方法', () => {
    expect(plugin).toBeDefined()
    expect(typeof plugin.install).toBe('function')
  })

  it('.install 调用 app.use 安装 config-provider 和 table', () => {
    const app = { use: vi.fn() } as any
    plugin.install(app)
    expect(app.use).toHaveBeenCalledTimes(2)
  })

  it('具名导出 AdvConfigProvider 组件', () => {
    expect(AdvConfigProvider).toBeDefined()
    expect(AdvConfigProvider.name).toBe('AdvConfigProvider')
  })

  it('具名导出 AdvTable 组件', () => {
    expect(AdvTable).toBeDefined()
    expect(AdvTable.name).toBe('AdvTable')
  })

  it('通过 export * from "@advanced-elements/table" 转发所有导出', () => {
    expect(typeof useColumns).toBe('function')
    expect(typeof useRequest).toBe('function')
    expect(typeof advConfigKey).toBe('symbol')
    expect(typeof useAdvConfig).toBe('function')
  })
})
