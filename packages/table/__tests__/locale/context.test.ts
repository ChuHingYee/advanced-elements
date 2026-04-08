import { describe, expect, it } from 'vitest'
import { advLocaleKey as keyFromIndex } from '../../src/locale'
import { advLocaleKey } from '../../src/types/injection-keys'

describe('locale context', () => {
  it('advLocaleKey is a Symbol', () => {
    expect(typeof advLocaleKey).toBe('symbol')
  })

  it('advLocaleKey from canonical source matches re-export from locale index', () => {
    expect(advLocaleKey).toBe(keyFromIndex)
  })
})
