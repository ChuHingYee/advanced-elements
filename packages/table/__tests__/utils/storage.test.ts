import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getSessionStorage,
  getWebStorage,
  localStorageAdapter,
  sessionStorageAdapter,
} from '../../src/utils/storage'

/**
 * <zh/> Storage 适配器单测——覆盖可用性探测与静默降级。
 * <en/> Storage adapter tests — availability probe and silent degradation.
 */
afterEach(() => {
  vi.restoreAllMocks()
})
describe('getWebStorage', () => {
  it('returns localStorage when available', () => {
    expect(getWebStorage()).toBe(localStorage)
  })

  it('returns null when accessing localStorage throws', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('denied')
      },
    })
    try {
      expect(getWebStorage()).toBeNull()
    }
    finally {
      if (descriptor)
        Object.defineProperty(globalThis, 'localStorage', descriptor)
    }
  })
})

describe('getSessionStorage', () => {
  it('returns sessionStorage when available', () => {
    expect(getSessionStorage()).toBe(sessionStorage)
  })

  it('returns null when accessing sessionStorage throws', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('denied')
      },
    })
    try {
      expect(getSessionStorage()).toBeNull()
    }
    finally {
      if (descriptor)
        Object.defineProperty(globalThis, 'sessionStorage', descriptor)
    }
  })
})

describe('localStorageAdapter', () => {
  it('round-trips set/get/remove', () => {
    localStorageAdapter.set('adv.storage.t', 'v1')
    expect(localStorageAdapter.get('adv.storage.t')).toBe('v1')
    localStorageAdapter.remove('adv.storage.t')
    expect(localStorageAdapter.get('adv.storage.t')).toBeNull()
  })

  it('returns null when backend throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('denied')
    })
    expect(localStorageAdapter.get('k')).toBeNull()
    spy.mockRestore()
  })

  it('silently swallows set/remove errors', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('quota')
    })
    expect(() => localStorageAdapter.set('k', 'v')).not.toThrow()
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => {
      throw new Error('denied')
    })
    expect(() => localStorageAdapter.remove('k')).not.toThrow()
  })
})

describe('sessionStorageAdapter', () => {
  it('round-trips set/get/remove', () => {
    sessionStorageAdapter.set('adv.storage.s', 'v2')
    expect(sessionStorageAdapter.get('adv.storage.s')).toBe('v2')
    sessionStorageAdapter.remove('adv.storage.s')
    expect(sessionStorageAdapter.get('adv.storage.s')).toBeNull()
  })

  it('silently swallows backend errors', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('denied')
    })
    expect(sessionStorageAdapter.get('k')).toBeNull()
    expect(() => sessionStorageAdapter.set('k', 'v')).not.toThrow()
    expect(() => sessionStorageAdapter.remove('k')).not.toThrow()
  })
})
