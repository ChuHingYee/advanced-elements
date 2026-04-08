import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useVisibleData } from '../../src/composables/data/use-visible-data'

describe('useVisibleData', () => {
  const data = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }))

  it('passes through data when client pagination is disabled', () => {
    const finalDisplayData = ref(data)
    const { visibleData } = useVisibleData({
      finalDisplayData,
      isClientPagination: false,
      currentPage: 1,
      pageSize: 10,
    })
    expect(visibleData.value).toEqual(data)
    expect(visibleData.value).toHaveLength(25)
  })

  it('returns first page slice when client pagination is enabled', () => {
    const finalDisplayData = ref(data)
    const { visibleData } = useVisibleData({
      finalDisplayData,
      isClientPagination: true,
      currentPage: 1,
      pageSize: 10,
    })
    expect(visibleData.value).toHaveLength(10)
    expect(visibleData.value[0].id).toBe(1)
    expect(visibleData.value[9].id).toBe(10)
  })

  it('returns second page slice correctly', () => {
    const finalDisplayData = ref(data)
    const { visibleData } = useVisibleData({
      finalDisplayData,
      isClientPagination: true,
      currentPage: 2,
      pageSize: 10,
    })
    expect(visibleData.value).toHaveLength(10)
    expect(visibleData.value[0].id).toBe(11)
  })

  it('returns last partial page correctly', () => {
    const finalDisplayData = ref(data)
    const { visibleData } = useVisibleData({
      finalDisplayData,
      isClientPagination: true,
      currentPage: 3,
      pageSize: 10,
    })
    expect(visibleData.value).toHaveLength(5)
    expect(visibleData.value[0].id).toBe(21)
  })

  it('handles empty data', () => {
    const finalDisplayData = ref<any[]>([])
    const { visibleData } = useVisibleData({
      finalDisplayData,
      isClientPagination: true,
      currentPage: 1,
      pageSize: 10,
    })
    expect(visibleData.value).toHaveLength(0)
  })

  it('clamps pageSize to minimum 1', () => {
    const finalDisplayData = ref(data)
    const { visibleData } = useVisibleData({
      finalDisplayData,
      isClientPagination: true,
      currentPage: 1,
      pageSize: 0,
    })
    expect(visibleData.value).toHaveLength(1)
  })

  it('clamps currentPage to minimum 1', () => {
    const finalDisplayData = ref(data)
    const { visibleData } = useVisibleData({
      finalDisplayData,
      isClientPagination: true,
      currentPage: 0,
      pageSize: 10,
    })
    expect(visibleData.value).toHaveLength(10)
    expect(visibleData.value[0].id).toBe(1)
  })

  it('returns empty slice when page exceeds total pages', () => {
    const finalDisplayData = ref(data)
    const { visibleData } = useVisibleData({
      finalDisplayData,
      isClientPagination: true,
      currentPage: 100,
      pageSize: 10,
    })
    expect(visibleData.value).toHaveLength(0)
  })

  it('preserves reference stability when data is unchanged', () => {
    const finalDisplayData = ref(data)
    const { visibleData } = useVisibleData({
      finalDisplayData,
      isClientPagination: false,
      currentPage: 1,
      pageSize: 10,
    })
    const firstRef = visibleData.value
    const secondRef = visibleData.value
    expect(firstRef).toEqual(secondRef)
  })

  it('returns new slice when changing page', () => {
    const finalDisplayData = ref(data)
    const currentPage = ref(1)
    const { visibleData } = useVisibleData({
      finalDisplayData,
      isClientPagination: true,
      currentPage,
      pageSize: 10,
    })
    const page1 = visibleData.value
    currentPage.value = 2
    const page2 = visibleData.value
    expect(page1).not.toBe(page2)
    expect(page1[0].id).toBe(1)
    expect(page2[0].id).toBe(11)
  })

  it('returns previous reference when client pagination is disabled and data unchanged', () => {
    const finalDisplayData = ref(data)
    const { visibleData } = useVisibleData({
      finalDisplayData,
      isClientPagination: false,
      currentPage: 1,
      pageSize: 10,
    })
    const firstRef = visibleData.value
    finalDisplayData.value = data // same array reference
    expect(visibleData.value).toBe(firstRef)
  })

  it('returns previous reference when all data fits on one page', () => {
    const smallData = data.slice(0, 5)
    const finalDisplayData = ref(smallData)
    const { visibleData } = useVisibleData({
      finalDisplayData,
      isClientPagination: true,
      currentPage: 1,
      pageSize: 10,
    })
    const firstRef = visibleData.value
    // Setting same reference — computed should check prev-cache
    finalDisplayData.value = smallData
    expect(visibleData.value).toBe(firstRef)
  })
})
