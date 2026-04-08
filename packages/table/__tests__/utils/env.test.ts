import { describe, expect, it } from 'vitest'
import { isBrowser, isDev } from '../../src/utils/env'

/**
 * <zh/> 环境检测单测——覆盖开发/浏览器判定常量。
 * <en/> Env detection tests — dev/browser flag constants.
 */
describe('env flags', () => {
  it('reports dev in test runtime', () => {
    expect(isDev).toBe(true)
  })

  it('reports browser under happy-dom', () => {
    expect(isBrowser).toBe(true)
  })
})
