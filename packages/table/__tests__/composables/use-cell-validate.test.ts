import type { ProcessedColumn } from '../../src/types/column'
import type { ColumnEditorRules } from '../../src/types/edit'
import { describe, expect, it } from 'vitest'
import { computed } from 'vue'
import { useCellValidate } from '../../src/composables/editing/use-cell-validate'

/**
 * Helper: create a minimal column with editorRules.
 */
function makeColumn(prop: string, rules?: ColumnEditorRules): ProcessedColumn {
  return {
    prop,
    key: prop,
    label: prop.charAt(0).toUpperCase() + prop.slice(1),
    editable: true,
    cellEditor: 'text',
    editorRules: rules,
  } as unknown as ProcessedColumn
}

/**
 * Helper: create useCellValidate instance with defaults.
 */
function createValidate(
  columns: ProcessedColumn[],
  data: Record<string, any>[],
) {
  return useCellValidate({
    columns: computed(() => columns),
    data: computed(() => data),
  })
}

describe('useCellValidate', () => {
  describe('validateCell', () => {
    it('returns true when no rules defined', async () => {
      const col = makeColumn('name')
      const { validateCell } = createValidate([col], [{ name: 'Alice' }])
      const result = await validateCell(0, 'name', 'Alice')
      expect(result).toBe(true)
    })

    it('returns true when value passes required rule', async () => {
      const col = makeColumn('name', { required: true })
      const { validateCell } = createValidate([col], [{ name: 'Alice' }])
      const result = await validateCell(0, 'name', 'Alice')
      expect(result).toBe(true)
    })

    it('returns true when a non-empty numeric value passes a required rule (rowData attached)', async () => {
      // Regression: rowData was previously spread onto every async-validator rule, which breaks the
      // single-key `{ required: true }` detection and makes the rule run as the string validator,
      // wrongly rejecting valid numbers (e.g. age 3 → "required"). rowData must only attach to
      // custom asyncValidator rules.
      const col = makeColumn('age', { required: '年龄不能为空', min: { value: 0, message: '年龄不能为负数' } })
      const { validateCell, errors } = createValidate([col], [{ id: '1', age: -1 }])
      for (const age of [1, 2, 3]) {
        const result = await validateCell(0, 'age', age, { id: '1', age: -1 })
        expect(result, `age=${age} should pass required + min`).toBe(true)
      }
      expect(errors.value).toHaveLength(0)
    })

    it('returns true when a non-empty numeric value passes a required rule without rowData', async () => {
      const col = makeColumn('age', { required: '年龄不能为空', max: { value: 150, message: '年龄不能超过150' } })
      const { validateCell } = createValidate([col], [{ id: '1', age: -1 }])
      const result = await validateCell(0, 'age', 30)
      expect(result).toBe(true)
    })

    it('returns false when required rule fails with empty string', async () => {
      const col = makeColumn('name', { required: 'Name is required' })
      const { validateCell, errors } = createValidate([col], [{ name: '' }])
      const result = await validateCell(0, 'name', '')
      expect(result).toBe(false)
      expect(errors.value).toHaveLength(1)
      expect(errors.value[0].message).toBe('Name is required')
      expect(errors.value[0].rowIndex).toBe(0)
      expect(errors.value[0].columnKey).toBe('name')
    })

    it('returns false when required rule fails with default message', async () => {
      const col = makeColumn('name', { required: true })
      const { validateCell, errors } = createValidate([col], [{ name: '' }])
      const result = await validateCell(0, 'name', '')
      expect(result).toBe(false)
      expect(errors.value[0].message).toContain('required')
    })

    it('validates min rule (number)', async () => {
      const col = makeColumn('age', { min: 0 })
      const { validateCell } = createValidate([col], [{ age: 5 }])
      const valid = await validateCell(0, 'age', 5)
      expect(valid).toBe(true)

      const invalid = await validateCell(0, 'age', -1)
      expect(invalid).toBe(false)
    })

    it('validates min rule with custom message', async () => {
      const col = makeColumn('age', { min: { value: 0, message: 'Age must be positive' } })
      const { validateCell, errors } = createValidate([col], [{ age: -1 }])
      await validateCell(0, 'age', -1)
      expect(errors.value[0].message).toBe('Age must be positive')
    })

    it('validates max rule (number)', async () => {
      const col = makeColumn('age', { max: 150 })
      const { validateCell } = createValidate([col], [{ age: 100 }])
      const valid = await validateCell(0, 'age', 100)
      expect(valid).toBe(true)

      const invalid = await validateCell(0, 'age', 200)
      expect(invalid).toBe(false)
    })

    it('validates maxLength rule (string)', async () => {
      const col = makeColumn('name', { maxLength: 5 })
      const { validateCell } = createValidate([col], [{ name: 'Hi' }])
      const valid = await validateCell(0, 'name', 'Hi')
      expect(valid).toBe(true)

      const invalid = await validateCell(0, 'name', 'TooLongName')
      expect(invalid).toBe(false)
    })

    it('validates minLength rule (string)', async () => {
      const col = makeColumn('name', { minLength: 2 })
      const { validateCell } = createValidate([col], [{ name: 'Al' }])
      const valid = await validateCell(0, 'name', 'Al')
      expect(valid).toBe(true)

      const invalid = await validateCell(0, 'name', 'A')
      expect(invalid).toBe(false)
    })

    it('validates pattern rule (RegExp)', async () => {
      const col = makeColumn('email', { pattern: /^[^@]+@[^@][^.@]*\.[^@]+$/ })
      const { validateCell } = createValidate([col], [{ email: 'test@example.com' }])
      const valid = await validateCell(0, 'email', 'test@example.com')
      expect(valid).toBe(true)

      const invalid = await validateCell(0, 'email', 'invalid')
      expect(invalid).toBe(false)
    })

    it('validates pattern rule with custom message', async () => {
      const col = makeColumn('email', {
        pattern: { regexp: /^[^@]+@[^@][^.@]*\.[^@]+$/, message: 'Invalid email format' },
      })
      const { validateCell, errors } = createValidate([col], [{ email: 'bad' }])
      await validateCell(0, 'email', 'bad')
      expect(errors.value[0].message).toBe('Invalid email format')
    })

    it('validates custom validator function returning true', async () => {
      const col = makeColumn('code', {
        validator: (value: any) => value === 'VALID',
      })
      const { validateCell } = createValidate([col], [{ code: 'VALID' }])
      const result = await validateCell(0, 'code', 'VALID')
      expect(result).toBe(true)
    })

    it('validates custom validator function returning false', async () => {
      const col = makeColumn('code', {
        validator: (value: any) => value === 'VALID' ? true : 'Code must be VALID',
      })
      const { validateCell, errors } = createValidate([col], [{ code: 'INVALID' }])
      const result = await validateCell(0, 'code', 'INVALID')
      expect(result).toBe(false)
      expect(errors.value[0].message).toBe('Code must be VALID')
    })

    it('validates custom async validator function', async () => {
      const col = makeColumn('code', {
        validator: async (value: any) => {
          return value === 'VALID' ? true : 'Async validation failed'
        },
      })
      const { validateCell, errors } = createValidate([col], [{ code: 'BAD' }])
      const result = await validateCell(0, 'code', 'BAD')
      expect(result).toBe(false)
      expect(errors.value[0].message).toBe('Async validation failed')
    })

    it('clears previous error for the same cell on re-validation', async () => {
      const col = makeColumn('name', { required: 'Required' })
      const { validateCell, errors } = createValidate([col], [{ name: '' }])

      // First validation fails
      await validateCell(0, 'name', '')
      expect(errors.value).toHaveLength(1)

      // Re-validate with valid value — error should be cleared
      await validateCell(0, 'name', 'Alice')
      expect(errors.value).toHaveLength(0)
    })

    it('returns true for column not found', async () => {
      const { validateCell } = createValidate([], [])
      const result = await validateCell(0, 'nonexistent', 'value')
      expect(result).toBe(true)
    })
  })

  describe('validateRow', () => {
    it('validates all editable cells in a row', async () => {
      const nameCol = makeColumn('name', { required: 'Name required' })
      const ageCol = makeColumn('age', { min: { value: 0, message: 'Age must be >= 0' } })
      const emailCol = makeColumn('email') // no rules

      const { validateRow, errors } = createValidate(
        [nameCol, ageCol, emailCol],
        [{ name: '', age: -1, email: 'test@test.com' }],
      )

      const result = await validateRow(0, { name: '', age: -1, email: 'test@test.com' })
      expect(result).toBe(false)
      expect(errors.value).toHaveLength(2)
    })

    it('returns true when all cells pass', async () => {
      const nameCol = makeColumn('name', { required: true })
      const { validateRow } = createValidate(
        [nameCol],
        [{ name: 'Alice' }],
      )
      const result = await validateRow(0, { name: 'Alice' })
      expect(result).toBe(true)
    })

    it('returns true for out-of-bounds rowIndex', async () => {
      const nameCol = makeColumn('name', { required: true })
      const { validateRow } = createValidate([nameCol], [{ name: 'Alice' }])
      const result = await validateRow(99, { name: '' })
      expect(result).toBe(true)
    })

    it('skips columns without editorRules', async () => {
      const col1 = makeColumn('name') // no rules
      const col2 = makeColumn('email') // no rules
      const { validateRow, errors } = createValidate(
        [col1, col2],
        [{ name: '', email: '' }],
      )
      const result = await validateRow(0, { name: '', email: '' })
      expect(result).toBe(true)
      expect(errors.value).toHaveLength(0)
    })
  })

  describe('validateAll', () => {
    it('validates all rows and columns with rules', async () => {
      const nameCol = makeColumn('name', { required: 'Name required' })
      const ageCol = makeColumn('age', { min: 0 })

      const { validateAll, errors } = createValidate(
        [nameCol, ageCol],
        [
          { name: '', age: 25 },
          { name: 'Bob', age: -1 },
        ],
      )

      const result = await validateAll()
      expect(result).toBe(false)
      expect(errors.value).toHaveLength(2)
    })

    it('validates a supplied data override', async () => {
      const nameCol = makeColumn('name', { required: 'Name required' })
      const { validateAll, errors } = createValidate(
        [nameCol],
        [{ name: 'Alice' }],
      )
      const result = await validateAll([{ name: '' }])
      expect(result).toBe(false)
      expect(errors.value).toHaveLength(1)
    })

    it('returns true when all data is valid', async () => {
      const nameCol = makeColumn('name', { required: true })
      const { validateAll } = createValidate(
        [nameCol],
        [{ name: 'Alice' }, { name: 'Bob' }],
      )
      const result = await validateAll()
      expect(result).toBe(true)
    })

    it('returns true when no columns have rules', async () => {
      const col = makeColumn('name')
      const { validateAll, errors } = createValidate(
        [col],
        [{ name: '' }],
      )
      const result = await validateAll()
      expect(result).toBe(true)
      expect(errors.value).toHaveLength(0)
    })
  })

  describe('clearErrors', () => {
    it('clears all errors when called without arguments', async () => {
      const col = makeColumn('name', { required: 'Required' })
      const { validateCell, clearErrors, errors } = createValidate([col], [{ name: '' }])

      await validateCell(0, 'name', '')
      expect(errors.value).toHaveLength(1)

      clearErrors()
      expect(errors.value).toHaveLength(0)
    })

    it('clears errors for a specific cell', async () => {
      const nameCol = makeColumn('name', { required: 'Name required' })
      const ageCol = makeColumn('age', { min: { value: 0, message: 'Age invalid' } })

      const { validateCell, clearErrors, errors } = createValidate(
        [nameCol, ageCol],
        [{ name: '', age: -1 }],
      )

      await validateCell(0, 'name', '')
      await validateCell(0, 'age', -1)
      expect(errors.value).toHaveLength(2)

      clearErrors({ rowIndex: 0, columnKey: 'name' })
      expect(errors.value).toHaveLength(1)
      expect(errors.value[0].columnKey).toBe('age')
    })

    it('clears errors for a specific row', async () => {
      const col = makeColumn('name', { required: 'Required' })
      const { validateCell, clearErrors, errors } = createValidate(
        [col],
        [{ name: '' }, { name: '' }],
      )

      await validateCell(0, 'name', '')
      await validateCell(1, 'name', '')
      expect(errors.value).toHaveLength(2)

      clearErrors({ rowIndex: 0 })
      expect(errors.value).toHaveLength(1)
      expect(errors.value[0].rowIndex).toBe(1)
    })

    it('clears errors for a specific columnKey across all rows', async () => {
      const nameCol = makeColumn('name', { required: 'Required' })
      const ageCol = makeColumn('age', { min: 0 })

      const { validateCell, clearErrors, errors } = createValidate(
        [nameCol, ageCol],
        [{ name: '', age: -1 }],
      )

      await validateCell(0, 'name', '')
      await validateCell(0, 'age', -1)
      expect(errors.value).toHaveLength(2)

      clearErrors({ columnKey: 'name' })
      expect(errors.value).toHaveLength(1)
      expect(errors.value[0].columnKey).toBe('age')
    })
  })

  describe('getCellError', () => {
    it('returns undefined when no error exists', () => {
      const col = makeColumn('name', { required: true })
      const { getCellError } = createValidate([col], [{ name: 'Alice' }])
      expect(getCellError(0, 'name')).toBeUndefined()
    })

    it('returns error message after failed validation', async () => {
      const col = makeColumn('name', { required: 'Name is required' })
      const { validateCell, getCellError } = createValidate([col], [{ name: '' }])
      await validateCell(0, 'name', '')
      expect(getCellError(0, 'name')).toBe('Name is required')
    })

    it('returns undefined after error is cleared', async () => {
      const col = makeColumn('name', { required: 'Required' })
      const { validateCell, clearErrors, getCellError } = createValidate([col], [{ name: '' }])
      await validateCell(0, 'name', '')
      expect(getCellError(0, 'name')).toBe('Required')

      clearErrors({ rowIndex: 0, columnKey: 'name' })
      expect(getCellError(0, 'name')).toBeUndefined()
    })
  })

  describe('multiple rules on same column', () => {
    it('validates required + minLength together', async () => {
      const col = makeColumn('name', {
        required: 'Name is required',
        minLength: { value: 2, message: 'Name too short' },
      })
      const { validateCell, errors } = createValidate([col], [{ name: '' }])

      // Empty string — required fails first (firstFields: true)
      await validateCell(0, 'name', '')
      expect(errors.value).toHaveLength(1)
      expect(errors.value[0].message).toBe('Name is required')

      // Single char — required passes, minLength fails
      await validateCell(0, 'name', 'A')
      expect(errors.value).toHaveLength(1)
      expect(errors.value[0].message).toBe('Name too short')

      // Valid value
      await validateCell(0, 'name', 'Alice')
      expect(errors.value).toHaveLength(0)
    })
  })

  describe('rule conversion edge cases', () => {
    it('handles max rule with custom message', async () => {
      const col = makeColumn('score', { max: { value: 100, message: 'Score exceeds 100' } })
      const { validateCell, errors } = createValidate([col], [{ score: 150 }])
      await validateCell(0, 'score', 150)
      expect(errors.value[0].message).toBe('Score exceeds 100')
    })

    it('handles maxLength rule with custom message', async () => {
      const col = makeColumn('bio', { maxLength: { value: 50, message: 'Bio too long' } })
      const { validateCell, errors } = createValidate([col], [{ bio: 'x'.repeat(60) }])
      await validateCell(0, 'bio', 'x'.repeat(60))
      expect(errors.value[0].message).toBe('Bio too long')
    })

    it('handles minLength rule with custom message', async () => {
      const col = makeColumn('password', { minLength: { value: 8, message: 'Password too short' } })
      const { validateCell, errors } = createValidate([col], [{ password: 'abc' }])
      await validateCell(0, 'password', 'abc')
      expect(errors.value[0].message).toBe('Password too short')
    })

    it('handles validator returning string error', async () => {
      const col = makeColumn('code', {
        validator: (value: any) => value === 'OK' ? true : 'Code must be OK',
      })
      const { validateCell, errors } = createValidate([col], [{ code: 'BAD' }])
      await validateCell(0, 'code', 'BAD')
      expect(errors.value[0].message).toBe('Code must be OK')
    })

    it('handles validator returning false (default message)', async () => {
      const col = makeColumn('code', {
        validator: (value: any) => value === 'OK',
      })
      const { validateCell, errors } = createValidate([col], [{ code: 'BAD' }])
      await validateCell(0, 'code', 'BAD')
      expect(errors.value[0].message).toContain('validation failed')
    })
  })

  describe('validateCrossField', () => {
    it('returns true when no crossFieldValidator provided', async () => {
      const col = makeColumn('name')
      const { validateCrossField } = createValidate([col], [{ name: 'A' }])
      expect(await validateCrossField(0, { name: 'A' })).toBe(true)
    })

    it('returns true when row does not exist', async () => {
      const col = makeColumn('name')
      const crossFieldValidator = () => async () => []
      const { validateCrossField } = useCellValidate({
        columns: computed(() => [col]),
        data: computed(() => [{ name: 'A' }]),
        crossFieldValidator,
      })
      expect(await validateCrossField(99, { name: 'A' })).toBe(true)
    })

    it('returns true and clears errors when crossFieldValidator returns no errors', async () => {
      const col = makeColumn('name')
      const crossFieldValidator = () => async () => []
      const { validateCrossField, errors } = useCellValidate({
        columns: computed(() => [col]),
        data: computed(() => [{ name: 'A' }]),
        crossFieldValidator,
      })
      expect(await validateCrossField(0, { name: 'A' })).toBe(true)
      expect(errors.value).toHaveLength(0)
    })

    it('stores string errors with __row__ columnKey', async () => {
      const col = makeColumn('name')
      const crossFieldValidator = () => async () => ['Row has an error']
      const { validateCrossField, errors } = useCellValidate({
        columns: computed(() => [col]),
        data: computed(() => [{ name: 'A' }]),
        crossFieldValidator,
      })
      expect(await validateCrossField(0, { name: 'A' })).toBe(false)
      expect(errors.value).toHaveLength(1)
      expect(errors.value[0].message).toBe('Row has an error')
      expect(errors.value[0].columnKey).toBe('__row__')
    })

    it('stores structured errors with specific columnKey', async () => {
      const col1 = makeColumn('start')
      const col2 = makeColumn('end')
      const crossFieldValidator = () => async () => [
        { columnKey: 'end', message: 'End must be after start' },
      ]
      const { validateCrossField, errors } = useCellValidate({
        columns: computed(() => [col1, col2]),
        data: computed(() => [{ start: 1, end: 0 }]),
        crossFieldValidator,
      })
      expect(await validateCrossField(0, { start: 1, end: 0 })).toBe(false)
      expect(errors.value).toHaveLength(1)
      expect(errors.value[0].columnKey).toBe('end')
      expect(errors.value[0].message).toBe('End must be after start')
    })

    it('handles multiple cross-field errors (mixed string and structured)', async () => {
      const col1 = makeColumn('start')
      const col2 = makeColumn('end')
      const crossFieldValidator = () => async () => [
        'Row-level error',
        { columnKey: 'end', message: 'End too small' },
      ]
      const { validateCrossField, errors } = useCellValidate({
        columns: computed(() => [col1, col2]),
        data: computed(() => [{ start: 1, end: 0 }]),
        crossFieldValidator,
      })
      expect(await validateCrossField(0, { start: 1, end: 0 })).toBe(false)
      expect(errors.value).toHaveLength(2)
    })
  })

  describe('clearRowCrossFieldErrors', () => {
    it('clears only cross-field errors for the specified row', async () => {
      const col = makeColumn('name', { required: 'Required' })
      const crossFieldValidator = () => async () => ['Cross error']
      const { validateCell, validateCrossField, clearRowCrossFieldErrors, errors } = useCellValidate({
        columns: computed(() => [col]),
        data: computed(() => [{ name: '' }]),
        crossFieldValidator,
      })

      // Add a single-field error
      await validateCell(0, 'name', '')
      // Add a cross-field error
      await validateCrossField(0, { name: '' })
      expect(errors.value).toHaveLength(2)

      // Clear only cross-field errors
      clearRowCrossFieldErrors(0)
      expect(errors.value).toHaveLength(1)
      expect(errors.value[0].message).toBe('Required')
    })

    it('does nothing when no cross-field errors exist', async () => {
      const col = makeColumn('name', { required: 'Required' })
      const { validateCell, clearRowCrossFieldErrors, errors } = createValidate([col], [{ name: '' }])
      await validateCell(0, 'name', '')
      clearRowCrossFieldErrors(0)
      expect(errors.value).toHaveLength(1)
    })
  })

  describe('clearRowErrors', () => {
    it('clears all errors for the specified row', async () => {
      const col1 = makeColumn('name', { required: 'Name required' })
      const col2 = makeColumn('age', { required: 'Age required' })
      const { validateCell, clearRowErrors, errors } = createValidate(
        [col1, col2],
        [{ name: '', age: '' }, { name: '', age: '' }],
      )

      await validateCell(0, 'name', '')
      await validateCell(0, 'age', '')
      await validateCell(1, 'name', '')
      expect(errors.value).toHaveLength(3)

      clearRowErrors(0)
      expect(errors.value).toHaveLength(1)
      expect(errors.value[0].rowIndex).toBe(1)
    })

    it('does nothing when row has no errors', () => {
      const col = makeColumn('name', { required: 'Required' })
      const { clearRowErrors, errors } = createValidate([col], [{ name: 'A' }])
      clearRowErrors(0)
      expect(errors.value).toHaveLength(0)
    })
  })

  describe('clearCellError', () => {
    it('clears error for a specific cell', async () => {
      const col = makeColumn('name', { required: 'Required' })
      const { validateCell, clearCellError, errors, getCellError } = createValidate([col], [{ name: '' }])
      await validateCell(0, 'name', '')
      expect(getCellError(0, 'name')).toBe('Required')

      clearCellError(0, 'name')
      expect(getCellError(0, 'name')).toBeUndefined()
      expect(errors.value).toHaveLength(0)
    })

    it('does nothing when cell has no error', () => {
      const col = makeColumn('name')
      const { clearCellError, errors } = createValidate([col], [{ name: 'A' }])
      clearCellError(0, 'name')
      expect(errors.value).toHaveLength(0)
    })
  })

  describe('getCellError (phase2 branches)', () => {
    it('returns undefined for cell with no error', () => {
      const col = makeColumn('name')
      const { getCellError } = createValidate([col], [{ name: 'A' }])
      expect(getCellError(0, 'name')).toBeUndefined()
    })

    it('returns error message for cell with error', async () => {
      const col = makeColumn('name', { required: 'Required' })
      const { validateCell, getCellError } = createValidate([col], [{ name: '' }])
      await validateCell(0, 'name', '')
      expect(getCellError(0, 'name')).toBe('Required')
    })
  })

  describe('validateAll (phase2 branches)', () => {
    it('validates all rows and columns', async () => {
      const col1 = makeColumn('name', { required: 'Name required' })
      const col2 = makeColumn('email', { required: 'Email required' })
      const { validateAll, errors } = createValidate(
        [col1, col2],
        [
          { name: 'Alice', email: 'a@t.com' },
          { name: '', email: 'b@t.com' },
        ],
      )
      const result = await validateAll()
      expect(result).toBe(false)
      expect(errors.value).toHaveLength(1)
      expect(errors.value[0].message).toBe('Name required')
      expect(errors.value[0].rowIndex).toBe(1)
    })

    it('returns true when all rows pass validation', async () => {
      const col = makeColumn('name', { required: 'Required' })
      const { validateAll, errors } = createValidate(
        [col],
        [{ name: 'Alice' }, { name: 'Bob' }],
      )
      const result = await validateAll()
      expect(result).toBe(true)
      expect(errors.value).toHaveLength(0)
    })

    it('returns true when no columns have editorRules', async () => {
      const col = makeColumn('name')
      const { validateAll } = createValidate([col], [{ name: 'A' }])
      expect(await validateAll()).toBe(true)
    })

    it('skips cells during validateAll (isValidatingAll guard)', async () => {
      const col = makeColumn('name', { required: 'Required' })
      const { validateAll, validateCell, errors } = createValidate(
        [col],
        [{ name: '' }, { name: '' }],
      )
      // Start validateAll and simultaneously try validateCell
      const allPromise = validateAll()
      // This should be skipped due to isValidatingAll guard
      await validateCell(0, 'name', 'test')
      await allPromise
      // errors should only contain validateAll results
      expect(errors.value).toHaveLength(2)
    })
  })

  describe('clearErrors (phase2 branches)', () => {
    it('clears all errors when no target specified', async () => {
      const col = makeColumn('name', { required: 'Required' })
      const { validateCell, clearErrors, errors } = createValidate(
        [col],
        [{ name: '' }, { name: '' }],
      )
      await validateCell(0, 'name', '')
      await validateCell(1, 'name', '')
      expect(errors.value).toHaveLength(2)

      clearErrors()
      expect(errors.value).toHaveLength(0)
    })

    it('clears errors for a specific column', async () => {
      const col1 = makeColumn('name', { required: 'Name required' })
      const col2 = makeColumn('age', { required: 'Age required' })
      const { validateCell, clearErrors, errors } = createValidate(
        [col1, col2],
        [{ name: '', age: '' }],
      )
      await validateCell(0, 'name', '')
      await validateCell(0, 'age', '')
      expect(errors.value).toHaveLength(2)

      clearErrors({ columnKey: 'name' })
      expect(errors.value).toHaveLength(1)
      expect(errors.value[0].columnKey).toBe('age')
    })

    it('clears errors for a specific row', async () => {
      const col = makeColumn('name', { required: 'Required' })
      const { validateCell, clearErrors, errors } = createValidate(
        [col],
        [{ name: '' }, { name: '' }],
      )
      await validateCell(0, 'name', '')
      await validateCell(1, 'name', '')
      expect(errors.value).toHaveLength(2)

      clearErrors({ rowIndex: 0 })
      expect(errors.value).toHaveLength(1)
      expect(errors.value[0].rowIndex).toBe(1)
    })
  })

  describe('validateRow (phase2 branches)', () => {
    it('returns true when row does not exist', async () => {
      const col = makeColumn('name', { required: 'Required' })
      const { validateRow } = createValidate([col], [{ name: 'A' }])
      expect(await validateRow(99, { name: 'A' })).toBe(true)
    })

    it('returns true when no columns have editorRules', async () => {
      const col = makeColumn('name')
      const { validateRow } = createValidate([col], [{ name: 'A' }])
      expect(await validateRow(0, { name: 'A' })).toBe(true)
    })

    it('validates multiple fields in a row', async () => {
      const col1 = makeColumn('name', { required: 'Name required' })
      const col2 = makeColumn('age', { required: 'Age required' })
      const { validateRow, errors } = createValidate(
        [col1, col2],
        [{ name: '', age: '' }],
      )
      const result = await validateRow(0, { name: '', age: '' })
      expect(result).toBe(false)
      expect(errors.value).toHaveLength(2)
    })
  })
})
