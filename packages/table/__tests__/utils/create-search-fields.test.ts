import type { AdvColumn } from '../../src/types/column'
import { describe, expect, it } from 'vitest'
import { columnsToSearchFields } from '../../src/utils/create-search-fields'

describe('create-search-fields utils', () => {
  describe('columnsToSearchFields', () => {
    const t = (path: string) => path

    it('should convert columns with search: true and default text type', () => {
      const columns: AdvColumn[] = [{ prop: 'name', label: 'Name', search: true, hidden: false }]

      const fields = columnsToSearchFields(columns, t)

      expect(fields).toHaveLength(1)
      expect(fields[0].prop).toBe('name')
      expect(fields[0].type).toBe('input')
      expect(fields[0].itemProps?.label).toBe('Name')
    })

    it('should convert columns with select valueType', () => {
      const columns: AdvColumn[] = [
        {
          prop: 'status',
          label: 'Status',
          search: true,
          valueType: 'select',
          valueEnum: { 1: 'Active', 2: 'Inactive' },
          hidden: false,
        },
      ]

      const fields = columnsToSearchFields(columns, t)

      expect(fields).toHaveLength(1)
      expect(fields[0].type).toBe('select')
      expect(fields[0].componentProps?.options).toEqual([
        { label: 'Active', value: '1' },
        { label: 'Inactive', value: '2' },
      ])
    })

    it('should convert columns with date valueType', () => {
      const columns: AdvColumn[] = [
        { prop: 'date', label: 'Date', search: true, valueType: 'date', hidden: false },
      ]

      const fields = columnsToSearchFields(columns, t)

      expect(fields).toHaveLength(1)
      expect(fields[0].type).toBe('datePicker')
    })

    it('should convert columns with dateRange valueType', () => {
      const columns: AdvColumn[] = [
        { prop: 'range', label: 'Range', search: true, valueType: 'dateRange', hidden: false },
      ]

      const fields = columnsToSearchFields(columns, t)

      expect(fields).toHaveLength(1)
      expect(fields[0].type).toBe('datePicker')
      expect(fields[0].componentProps?.type).toBe('daterange')
    })

    it('should filter out columns with search: false', () => {
      const columns: AdvColumn[] = [
        { prop: 'name', label: 'Name', search: true, hidden: false },
        { prop: 'id', label: 'ID', search: false, hidden: false },
      ]

      const fields = columnsToSearchFields(columns, t)

      expect(fields).toHaveLength(1)
      expect(fields[0].prop).toBe('name')
    })

    it('should filter out columns with search.hidden: true', () => {
      const columns: AdvColumn[] = [
        { prop: 'name', label: 'Name', search: true, hidden: false },
        { prop: 'id', label: 'ID', search: { hidden: true } },
      ]

      const fields = columnsToSearchFields(columns, t)

      expect(fields).toHaveLength(1)
      expect(fields[0].prop).toBe('name')
    })

    it('should respect search order', () => {
      const columns: AdvColumn[] = [
        { prop: 'name', label: 'Name', search: true, hidden: false },
        { prop: 'id', label: 'ID', search: { order: 1 }, hidden: false },
        { prop: 'status', label: 'Status', search: { order: 2 }, hidden: false },
      ]

      const fields = columnsToSearchFields(columns, t)

      expect(fields[0].prop).toBe('status')
      expect(fields[1].prop).toBe('id')
      expect(fields[2].prop).toBe('name')
    })

    it('should apply custom fieldProps', () => {
      const columns: AdvColumn[] = [
        {
          prop: 'name',
          label: 'Name',
          search: { fieldProps: { placeholder: 'Custom placeholder' } },
          hidden: false,
        },
      ]

      const fields = columnsToSearchFields(columns, t)

      expect(fields[0].componentProps?.placeholder).toBe('Custom placeholder')
    })

    it('should apply custom formItemProps', () => {
      const columns: AdvColumn[] = [
        {
          prop: 'name',
          label: 'Name',
          search: { formItemProps: { labelWidth: 100 } },
          hidden: false,
        },
      ]

      const fields = columnsToSearchFields(columns, t)

      expect(fields[0].itemProps?.labelWidth).toBe(100)
    })

    it('should handle columns with valueEnum as objects', () => {
      const columns: AdvColumn[] = [
        {
          prop: 'status',
          label: 'Status',
          search: true,
          valueType: 'select',
          valueEnum: {
            1: { text: 'Active', color: 'green' },
            2: { text: 'Inactive', color: 'red' },
          },
          hidden: false,
        },
      ]

      const fields = columnsToSearchFields(columns, t)

      expect(fields[0].componentProps?.options).toEqual([
        { label: 'Active', value: '1' },
        { label: 'Inactive', value: '2' },
      ])
    })

    it('should sort by search order descending', () => {
      const columns: AdvColumn[] = [
        { prop: 'a', label: 'A', search: true, hidden: false },
        { prop: 'b', label: 'B', search: true, hidden: false },
        { prop: 'c', label: 'C', search: { order: 3 }, hidden: false },
        { prop: 'd', label: 'D', search: { order: 1 }, hidden: false },
      ]

      const fields = columnsToSearchFields(columns, t)

      expect(fields[0].prop).toBe('c')
      expect(fields[1].prop).toBe('d')
      expect(fields[2].prop).toBe('a')
      expect(fields[3].prop).toBe('b')
    })
  })
})
