import { describe, expect, it } from 'vitest'
import { parseResponseData } from '../../src/utils/format-response'

describe('parseResponseData', () => {
  it('parses default field names (list/total)', () => {
    const result = parseResponseData(
      { list: [{ id: 1 }, { id: 2 }], total: 100 },
      { data: 'list', total: 'total' },
    )
    expect(result.data).toEqual([{ id: 1 }, { id: 2 }])
    expect(result.total).toBe(100)
  })

  it('handles custom formatMaps', () => {
    const result = parseResponseData(
      { items: [{ id: 1 }], count: 50 },
      { data: 'items', total: 'count' },
    )
    expect(result.data).toEqual([{ id: 1 }])
    expect(result.total).toBe(50)
  })

  it('uses default field names when formatMaps is empty', () => {
    const result = parseResponseData(
      { data: [{ id: 1 }], total: 10 },
      {},
    )
    expect(result.data).toEqual([{ id: 1 }])
    expect(result.total).toBe(10)
  })

  it('handles non-array data field', () => {
    const result = parseResponseData(
      { list: 'not-an-array', total: 10 },
      { list: 'data', total: 'total' } as any,
    )
    expect(result.data).toEqual([])
  })

  it('handles non-numeric total', () => {
    const result = parseResponseData(
      { list: [{ id: 1 }], total: 'abc' },
      { list: 'data', total: 'total' } as any,
    )
    expect(result.total).toBe(0)
  })

  it('handles string numeric total', () => {
    const result = parseResponseData(
      { list: [{ id: 1 }], total: '50' },
      { list: 'data', total: 'total' } as any,
    )
    expect(result.total).toBe(50)
  })

  it('returns empty data for missing source key', () => {
    const result = parseResponseData(
      { something: [{ id: 1 }] },
      { list: 'data' } as any,
    )
    expect(result.data).toEqual([])
  })
})
