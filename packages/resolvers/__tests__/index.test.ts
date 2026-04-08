import type { ComponentResolver } from '../src/index'
/**
 * @advanced-elements/resolvers — 测试
 *
 * 测试 AdvancedElementsResolver 函数在不同选项组合下的行为
 */
import { describe, expect, it } from 'vitest'
import { AdvancedElementsResolver } from '../src/index'

describe('advancedElementsResolver 选项', () => {
  describe('默认选项（external, 带 sideEffects）', () => {
    const resolver = AdvancedElementsResolver()

    it('advTable 返回 external 导入路径', () => {
      const result = resolver('AdvTable')
      expect(result).toEqual({
        name: 'AdvTable',
        from: '@advanced-elements/elements',
        sideEffects: ['@advanced-elements/table/style'],
      })
    })

    it('advConfigProvider 返回 external 导入路径（无 style）', () => {
      const result = resolver('AdvConfigProvider')
      expect(result).toEqual({
        name: 'AdvConfigProvider',
        from: '@advanced-elements/elements',
      })
    })

    it('不支持的组件名返回 undefined', () => {
      expect(resolver('UnknownComponent')).toBeUndefined()
    })

    it('空字符串组件名返回 undefined', () => {
      expect(resolver('')).toBeUndefined()
    })
  })

  describe('direct: true', () => {
    const resolver = AdvancedElementsResolver({ direct: true })

    it('advTable 返回 direct 导入路径', () => {
      const result = resolver('AdvTable')
      expect(result).toEqual({
        name: 'AdvTable',
        from: '@advanced-elements/table',
        sideEffects: ['@advanced-elements/table/style'],
      })
    })

    it('advConfigProvider 返回 direct 导入路径', () => {
      const result = resolver('AdvConfigProvider')
      expect(result).toEqual({
        name: 'AdvConfigProvider',
        from: '@advanced-elements/config-provider',
      })
    })
  })

  describe('sideEffects: false', () => {
    const resolver = AdvancedElementsResolver({ sideEffects: false })

    it('advTable 不包含 sideEffects', () => {
      const result = resolver('AdvTable')
      expect(result).toEqual({
        name: 'AdvTable',
        from: '@advanced-elements/elements',
      })
    })

    it('advConfigProvider 不包含 sideEffects', () => {
      const result = resolver('AdvConfigProvider')
      expect(result).toEqual({
        name: 'AdvConfigProvider',
        from: '@advanced-elements/elements',
      })
    })
  })

  describe('direct + sideEffects: false 组合', () => {
    const resolver = AdvancedElementsResolver({ direct: true, sideEffects: false })

    it('advTable 返回 direct 路径且无 sideEffects', () => {
      const result = resolver('AdvTable')
      expect(result).toEqual({
        name: 'AdvTable',
        from: '@advanced-elements/table',
      })
    })
  })
})

describe('类型导出', () => {
  it('componentResolver 类型可引用', () => {
    // 仅在类型层面验证，运行时不可用 import type
    const resolver: ComponentResolver = AdvancedElementsResolver()
    expect(typeof resolver).toBe('function')
  })
})
