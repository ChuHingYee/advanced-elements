import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useDataUpdateBridge, writeFullData } from '../../src/composables/data/use-data-update-bridge'

interface Row { id: string, name: string, age?: number }

describe('writeFullData', () => {
  it('routes to setResponseData when a source exists', () => {
    const setResponseData = vi.fn()
    const writeModel = vi.fn()
    const rows: Row[] = [{ id: '1', name: 'A' }]
    writeFullData({ hasSource: () => true, setResponseData, writeModel }, rows)
    expect(setResponseData).toHaveBeenCalledWith(rows)
    expect(writeModel).not.toHaveBeenCalled()
  })

  it('writes to the model otherwise', () => {
    const setResponseData = vi.fn()
    const writeModel = vi.fn()
    const rows: Row[] = [{ id: '1', name: 'A' }]
    writeFullData({ hasSource: () => false, setResponseData, writeModel }, rows)
    expect(writeModel).toHaveBeenCalledWith(rows)
    expect(setResponseData).not.toHaveBeenCalled()
  })
})

describe('useDataUpdateBridge', () => {
  describe('source = "full" (or same reference)', () => {
    it('calls setResponseData when hasSource is true', () => {
      const tableData = ref<Row[]>([{ id: '1', name: 'Alice' }])
      const setResponseData = vi.fn()
      const dataModel = ref<Row[] | undefined>(undefined)
      const rowKeyFn = computed(() => (r: Row) => r.id)

      const { handleDataUpdate } = useDataUpdateBridge<Row>({
        tableData,
        hasSource: ref(true),
        setResponseData,
        dataModel,
        rowKeyFn,
      })

      const newData: Row[] = [{ id: '1', name: 'Bob' }, { id: '2', name: 'Carol' }]
      handleDataUpdate(newData, 'full')

      expect(setResponseData).toHaveBeenCalledWith(newData)
      expect(dataModel.value).toBeUndefined()
    })

    it('assigns to dataModel when hasSource is false', () => {
      const tableData = ref<Row[]>([{ id: '1', name: 'Alice' }])
      const setResponseData = vi.fn()
      const dataModel = ref<Row[] | undefined>(undefined)
      const rowKeyFn = computed(() => (r: Row) => r.id)

      const { handleDataUpdate } = useDataUpdateBridge<Row>({
        tableData,
        hasSource: ref(false),
        setResponseData,
        dataModel,
        rowKeyFn,
      })

      const newData: Row[] = [{ id: '1', name: 'Bob' }]
      handleDataUpdate(newData, 'full')

      expect(setResponseData).not.toHaveBeenCalled()
      expect(dataModel.value).toEqual(newData)
    })

    it('takes the full-replace path when newData references tableData', () => {
      const initial: Row[] = [{ id: '1', name: 'Alice' }]
      const tableData = ref<Row[]>(initial)
      const setResponseData = vi.fn()
      const dataModel = ref<Row[] | undefined>(undefined)
      const rowKeyFn = computed(() => (r: Row) => r.id)

      const { handleDataUpdate } = useDataUpdateBridge<Row>({
        tableData,
        hasSource: ref(true),
        setResponseData,
        dataModel,
        rowKeyFn,
      })

      // Pass the SAME reference (default source = 'view-slice' but reference-equal triggers full path)
      handleDataUpdate(tableData.value)

      expect(setResponseData).toHaveBeenCalledWith(initial)
    })
  })

  describe('source = "view-slice" (default)', () => {
    it('merges view slice into full data by rowKey when hasSource=true', () => {
      const initial: Row[] = [
        { id: '1', name: 'Alice', age: 25 },
        { id: '2', name: 'Bob', age: 30 },
        { id: '3', name: 'Carol', age: 35 },
      ]
      const tableData = ref<Row[]>(initial)
      const setResponseData = vi.fn()
      const dataModel = ref<Row[] | undefined>(undefined)
      const rowKeyFn = computed(() => (r: Row) => r.id)

      const { handleDataUpdate } = useDataUpdateBridge<Row>({
        tableData,
        hasSource: ref(true),
        setResponseData,
        dataModel,
        rowKeyFn,
      })

      const slice: Row[] = [
        { id: '1', name: 'AliceUpdated', age: 26 },
        { id: '3', name: 'CarolUpdated', age: 36 },
      ]
      handleDataUpdate(slice)

      expect(setResponseData).toHaveBeenCalledTimes(1)
      const merged = setResponseData.mock.calls[0][0] as Row[]
      expect(merged).toHaveLength(3)
      expect(merged[0]).toEqual({ id: '1', name: 'AliceUpdated', age: 26 })
      expect(merged[1]).toEqual({ id: '2', name: 'Bob', age: 30 })
      expect(merged[2]).toEqual({ id: '3', name: 'CarolUpdated', age: 36 })
    })

    it('assigns merged data to dataModel when hasSource=false', () => {
      const initial: Row[] = [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
      ]
      const tableData = ref<Row[]>(initial)
      const setResponseData = vi.fn()
      const dataModel = ref<Row[] | undefined>(undefined)
      const rowKeyFn = computed(() => (r: Row) => r.id)

      const { handleDataUpdate } = useDataUpdateBridge<Row>({
        tableData,
        hasSource: ref(false),
        setResponseData,
        dataModel,
        rowKeyFn,
      })

      const slice: Row[] = [{ id: '2', name: 'BobUpdated' }]
      handleDataUpdate(slice)

      expect(setResponseData).not.toHaveBeenCalled()
      expect(dataModel.value).toHaveLength(2)
      expect(dataModel.value![0]).toEqual({ id: '1', name: 'Alice' })
      expect(dataModel.value![1]).toEqual({ id: '2', name: 'BobUpdated' })
    })

    it('skips rows in slice that do not exist in full data', () => {
      const initial: Row[] = [{ id: '1', name: 'Alice' }]
      const tableData = ref<Row[]>(initial)
      const setResponseData = vi.fn()
      const dataModel = ref<Row[] | undefined>(undefined)
      const rowKeyFn = computed(() => (r: Row) => r.id)

      const { handleDataUpdate } = useDataUpdateBridge<Row>({
        tableData,
        hasSource: ref(true),
        setResponseData,
        dataModel,
        rowKeyFn,
      })

      const slice: Row[] = [
        { id: '1', name: 'AliceUpdated' },
        { id: '999', name: 'Orphan' }, // not in full data, should be skipped
      ]
      handleDataUpdate(slice)

      const merged = setResponseData.mock.calls[0][0] as Row[]
      expect(merged).toHaveLength(1)
      expect(merged[0]).toEqual({ id: '1', name: 'AliceUpdated' })
    })

    it('does not mutate the original tableData array', () => {
      const initial: Row[] = [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
      ]
      const tableData = ref<Row[]>(initial)
      const setResponseData = vi.fn()
      const dataModel = ref<Row[] | undefined>(undefined)
      const rowKeyFn = computed(() => (r: Row) => r.id)

      const { handleDataUpdate } = useDataUpdateBridge<Row>({
        tableData,
        hasSource: ref(true),
        setResponseData,
        dataModel,
        rowKeyFn,
      })

      handleDataUpdate([{ id: '1', name: 'AliceUpdated' }])

      expect(tableData.value[0]).toEqual({ id: '1', name: 'Alice' })
      expect(tableData.value[1]).toEqual({ id: '2', name: 'Bob' })
    })

    it('accepts ComputedRef<boolean> for hasSource', () => {
      const tableData = ref<Row[]>([{ id: '1', name: 'Alice' }])
      const setResponseData = vi.fn()
      const dataModel = ref<Row[] | undefined>(undefined)
      const rowKeyFn = computed(() => (r: Row) => r.id)
      const hasSource = computed(() => true)

      const { handleDataUpdate } = useDataUpdateBridge<Row>({
        tableData,
        hasSource,
        setResponseData,
        dataModel,
        rowKeyFn,
      })

      handleDataUpdate([{ id: '1', name: 'Updated' }], 'full')

      expect(setResponseData).toHaveBeenCalledWith([{ id: '1', name: 'Updated' }])
    })
  })
})
