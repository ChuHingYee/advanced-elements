import type { ProcessedColumn } from '../../src/types/column'
import type { ColumnEditorRules } from '../../src/types/edit'
import { describe, expect, it } from 'vitest'
import { computed } from 'vue'
import { useCellValidate } from '../../src/composables/editing/use-cell-validate'

/**
 * <zh/> 并发/竞态对抗用例——目标是找出问题而非凑覆盖率：
 * <zh/> 聚焦 isValidatingAll 标志在并发 validateAll 下的归属、epoch 过期丢弃、
 * <zh/> 定向清除与批量重建的相互作用。
 * <en/> Concurrency/race adversarial cases — aimed at finding problems, not coverage:
 * <en/> isValidatingAll ownership under concurrent validateAll, epoch staleness drops,
 * <en/> and targeted-clear vs bulk-rebuild interactions.
 */
function makeColumn(prop: string, rules?: ColumnEditorRules): ProcessedColumn {
  return {
    prop,
    key: prop,
    label: prop,
    editable: true,
    cellEditor: 'text',
    editorRules: rules,
  } as unknown as ProcessedColumn
}

function createValidate(columns: ProcessedColumn[], data: Record<string, any>[]) {
  return useCellValidate({
    columns: computed(() => columns),
    data: computed(() => data),
  })
}

describe('cell validation concurrency (adversarial)', () => {
  it('concurrent validateAll: the earlier call is staleness-dropped, the later one is authoritative', async () => {
    // <zh/> 对抗探针（曾经怀疑布尔标志存在「早落定方提前解抑制 → 错误被先起跑批量重建清掉」的危害，
    // <zh/> 实测不可达：epoch 互斥使先起跑方在首个批次检查点即被过期丢弃，永远不会重建）。
    // <zh/> 钉住真实语义：并发两次 validateAll，先者返回 true（stale），后者产出权威结果。
    // <en/> Adversarial probe (a boolean-flag hazard was suspected — the earlier-settling bulk
    // <en/> un-suppressing writes and a still-running earlier rebuild wiping newer single-cell errors —
    // <en/> but it is unreachable: the epoch mutex staleness-drops the earlier bulk at its first batch
    // <en/> checkpoint, so it never rebuilds). Pins the real semantics: of two concurrent validateAll
    // <en/> calls, the earlier resolves true (stale) and the later produces the authoritative result.
    const col = makeColumn('name', { required: true })
    const rows = [{ name: 'ok' }]
    const v = useCellValidate({
      columns: computed(() => [col]),
      data: computed(() => rows),
    })

    const first = v.validateAll()
    const second = v.validateAll()
    const [firstResult, secondResult] = await Promise.all([first, second])

    expect(firstResult).toBe(true)
    expect(secondResult).toBe(true)
    expect(v.errors.value).toHaveLength(0)
  })

  it('single-cell validation during validateAll still returns the true verdict but writes nothing', async () => {
    const col = makeColumn('name', { required: true })
    const rows = Array.from({ length: 100 }, (_, i) => ({ id: String(i), name: `v${i}` }))
    const { validateAll, validateCell, getCellError } = createValidate([col], rows)

    const bulk = validateAll()
    // <zh/> 批量在飞期间的单格失败：返回真值（供提交门控），但不落 errorMap
    // <en/> a failing single-cell during bulk: real verdict returned, nothing lands in errorMap
    const verdict = await validateCell(0, 'name', '', rows[0])
    const bulkResult = await bulk

    expect(bulkResult).toBe(true)
    expect(verdict).toBe(false)
    expect(getCellError(0, 'name', rows[0])).toBeUndefined()
  })

  it('full clearErrors during an in-flight validateAll staleness-drops the sweep', async () => {
    const col = makeColumn('name', { required: true })
    const rows = Array.from({ length: 100 }, (_, i) => ({ id: String(i), name: `v${i}` }))
    const { validateAll, clearErrors, errors } = createValidate([col], rows)

    // <zh/> 全量清除递增 epoch → 在飞的批量结果全部过期丢弃，errors 不被批量重建写入
    // <en/> a full clear bumps the epoch → the in-flight sweep is stale-dropped and never rebuilds
    const bulk = validateAll()
    clearErrors()
    await bulk
    expect(errors.value).toHaveLength(0)
  })

  it('targeted clearRowErrors during bulk does not abort the sweep', async () => {
    const col = makeColumn('name', { required: true })
    // <zh/>偶数行 name 为空 → 批量应产出 50 条错误 | <en/> even rows have empty names → bulk should yield 50 errors
    const rows = Array.from({ length: 100 }, (_, i) => ({ id: String(i), name: i % 2 ? '' : `v${i}` }))
    const { validateAll, clearRowErrors, errors, getCellError } = createValidate([col], rows)

    const bulk = validateAll()
    // <zh/> 定向清除不递增 epoch（文档契约）——批量不被中止 | <en/> targeted clear does not bump the epoch (documented) — bulk not aborted
    clearRowErrors(0, rows[0])
    const result = await bulk

    expect(result).toBe(false)
    expect(errors.value).toHaveLength(50)
    // <zh/> 被定向清除的行若确有错误，批量重建会补回 | <en/> the targeted-cleared row's error is restored by the bulk rebuild
    expect(getCellError(1, 'name', rows[1])).toBeDefined()
  })

  it('crossFieldValidator throwing a string is recorded as a validation error (row + bulk paths)', async () => {
    const col = makeColumn('a')
    const rows = [{ a: 1 }, { a: 2 }]
    const { errors } = createValidate([col], rows)

    const v2 = useCellValidate({
      columns: computed(() => [makeColumn('a')]),
      data: computed(() => rows),
      crossFieldValidator: () => () => {
        // eslint-disable-next-line no-throw-literal -- 用例主体：非 Error 抛出必须保留原字符串
        throw 'boom-string'
      },
    })
    // <zh/> 行级：throw 'boom'（非 Error）被捕获为错误消息并返回 false，而不是炸掉调用链
    // <en/> row path: a thrown 'boom' (non-Error) is captured as an error message with a false verdict
    const rowVerdict = await v2.validateCrossField(0, { a: 1 })
    expect(rowVerdict).toBe(false)
    expect(v2.errors.value.some(e => e.message === 'boom-string' && e.rowIndex === 0)).toBe(true)

    const result = await v2.validateAll()
    expect(result).toBe(false)
    expect(v2.errors.value.some(e => e.message === 'boom-string')).toBe(true)
    expect(errors.value).toHaveLength(0)
  })

  it('validateCell result arriving after clearErrors is dropped (no ghost error)', async () => {
    const col = makeColumn('name', { required: true })
    const rows = [{ id: '1', name: '' }]
    const { validateCell, clearErrors, getCellError } = createValidate([col], rows)

    const pending = validateCell(0, 'name', '', rows[0])
    clearErrors()
    await pending
    // <zh/> await 期间 epoch 被清除递增 → 结果过期，不得写入幽灵错误 | <en/> the clear bumped the epoch mid-await → stale, no ghost error
    expect(getCellError(0, 'name', rows[0])).toBeUndefined()
  })

  it('bulk rebuild stores errors under the string rowKey domain (numeric fallback stringified)', async () => {
    // <zh/> B11 键域契约：rowKeyFn 缺失时 rowIndex 数字回退必须转 string，UI === 比较才同域
    // <en/> B11 key-domain contract: numeric rowIndex fallback must stringify to share the UI's === domain
    const col = makeColumn('name', { required: true })
    const rows = [{ name: '' }, { name: 'ok' }]
    const v = useCellValidate({
      columns: computed(() => [col]),
      data: computed(() => rows),
    })
    const result = await v.validateAll()
    expect(result).toBe(false)
    const err = v.errors.value[0]!
    expect(typeof err.rowKey).toBe('string')
    expect(err.rowKey).toBe('0')
  })

  it('validateAll honors dataOverride instead of the reactive data', async () => {
    const col = makeColumn('name', { required: true })
    const reactiveRows = [{ name: 'ok' }]
    const overrideRows = [{ name: '' }, { name: '' }, { name: '' }]
    const { validateAll, errors } = createValidate([col], reactiveRows)

    const result = await validateAll(overrideRows)
    expect(result).toBe(false)
    expect(errors.value).toHaveLength(3)
  })
})
