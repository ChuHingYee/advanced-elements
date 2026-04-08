import { describe, expect, it } from 'vitest'
import { assertDomContract, verifyDomContract } from '../../../src/components/renderer-core/dom-contract'

function buildRoot(): HTMLElement {
  const root = document.createElement('div')
  const body = document.createElement('div')
  body.className = 'el-table__body-wrapper'
  const row = document.createElement('tr')
  row.className = 'el-table__row'
  body.append(row)
  root.append(body)
  return root
}

describe('dom-contract', () => {
  it('verifyDomContract returns ok when every selector matches', () => {
    const result = verifyDomContract(buildRoot(), ['.el-table__body-wrapper', '.el-table__row'], 'test')
    expect(result).toEqual({ ok: true, missing: [] })
  })

  it('verifyDomContract lists every miss at once', () => {
    const result = verifyDomContract(buildRoot(), ['.el-table__body-wrapper', '.el-table-v2__row', '.gone'], 'test')
    expect(result.ok).toBe(false)
    expect(result.missing).toEqual(['.el-table-v2__row', '.gone'])
  })

  it('verifyDomContract treats a null root as all-missing', () => {
    const result = verifyDomContract(null, ['.a'], 'test')
    expect(result).toEqual({ ok: false, missing: ['.a'] })
  })

  it('assertDomContract passes silently on match and throws listing misses', () => {
    expect(() => assertDomContract(buildRoot(), ['.el-table__row'], 'test')).not.toThrow()
    expect(() => assertDomContract(buildRoot(), ['.el-table__row', '.gone'], 'test')).toThrow(/\.gone/)
  })
})
