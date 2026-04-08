import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'

// ─── 组合式拆分守卫：壳不得静态引入重量实现 ───
// ─── Compositional split guard: shells must not statically import heavy implementations ───

/**
 * <zh/> 组合式架构（同步壳 + 异步实现）防回归：壳文件只允许类型引用重量模块，
 * <zh/> 值引用即把实现打回首屏包。此守卫逐壳断言，新增静态引用即红。
 * <en/> Regression guard for the compositional architecture (sync shell + async implementation):
 * <en/> shells may only type-reference heavy modules; a value import pulls the implementation
 * <en/> back into the initial bundle. Any new static import turns this red.
 */
const SRC = path.join(import.meta.dirname, '../../src')

function read(rel: string): string {
  return fs.readFileSync(path.join(SRC, rel), 'utf-8')
}

/**
 * <zh/> 解析值引用（排除 import type 与动态 import） | <en/> Parse value imports (excludes import type and dynamic imports)
 */
function valueImports(text: string): string[] {
  const out: string[] = []
  const fromRe = /^[ \t]*import(?!\s+type\b)[^;]*?from[ \t]*['"]([^'"]+)['"]/gm
  for (let m = fromRe.exec(text); m !== null; m = fromRe.exec(text)) out.push(m[1])
  const bareRe = /^[ \t]*import[ \t]*['"]([^'"]+)['"];?[ \t]*$/gm
  for (let b = bareRe.exec(text); b !== null; b = bareRe.exec(text)) out.push(b[1])
  return out
}

describe('compositional split', () => {
  it('export shell keeps heavy leaves out of the sync graph', () => {
    const text = read('composables/features/use-export-orchestrator.ts')
    const pinned = [
      './export-impl',
      '../features/use-table-export',
      '../features/use-table-import',
      '../features/use-table-print',
      '../../utils/export-csv',
      '../../utils/export-excel',
      '../../utils/export-helpers',
      '../../utils/import-helpers',
      '../../utils/scope-resolvers',
      '../../utils/print',
    ]
    for (const p of pinned)
      expect(valueImports(text), `shell must not statically import ${p}`).not.toContain(p)
    expect(text).toContain('import(\'./export-impl\')')
    expect(text).toContain('createAsyncLoader')
  })

  it('export impl assembles the heavy leaves', () => {
    const text = read('composables/features/export-impl.ts')
    expect(text).toContain('useTableExportOrchestration')
    expect(text).toContain('useTableImport')
    expect(text).toContain('useTablePrintOrchestration')
  })

  it('drag shell keeps row/column drag out of the sync graph', () => {
    const text = read('composables/interaction/use-drag-orchestrator.ts')
    expect(valueImports(text)).not.toContain('../interaction/use-row-drag')
    expect(valueImports(text)).not.toContain('../columns/use-column-drag')
    expect(text).toContain('import(\'./drag-impl\')')
    expect(text).toContain('rowDraggable')
    expect(text).toContain('columnDraggable')
  })

  it('drag impl assembles row/column drag without self-registration', () => {
    const text = read('composables/interaction/drag-impl.ts')
    expect(text).toContain('useRowDrag(')
    expect(text).toContain('useColumnDrag(')
    expect(text).toContain('autoLifecycle: false')
  })

  it('renderer integration keeps clipboard handler out of the sync graph', () => {
    const text = read('composables/core/use-renderer-integration.ts')
    expect(valueImports(text)).not.toContain('../interaction/use-clipboard-handler')
    expect(text).toContain('import(\'../interaction/use-clipboard-handler\')')
  })

  it('deferred features opt out of self-registered lifecycles', () => {
    expect(read('composables/features/use-table-import.ts')).toContain('autoLifecycle')
    expect(read('composables/interaction/use-row-drag.ts')).toContain('autoLifecycle')
    expect(read('composables/columns/use-column-drag.ts')).toContain('autoLifecycle')
  })

  it('search view loads async behind its existing guard', () => {
    const text = read('AdvTable.vue')
    expect(text).not.toMatch(/import TableSearch from/)
    expect(text).toContain('import(\'./components/search/search.vue\')')
  })

  it('async loader mechanism exists', () => {
    expect(read('utils/async-feature.ts')).toContain('export function createAsyncLoader')
  })

  it('editing chain loads on demand behind editConfig', () => {
    const stub = read('composables/editing/create-editing-stub.ts')
    expect(valueImports(stub)).not.toContain('./use-editing-orchestrator')
    expect(stub).toContain('import(\'./use-editing-orchestrator\')')
  })

  it('built-in editors register async without static SFC imports', () => {
    const text = read('components/cell-editors/index.ts')
    for (const f of ['text', 'number', 'select', 'date', 'datetime', 'switch', 'checkbox'])
      expect(valueImports(text), `SFC must not be statically imported`).not.toContain(`./${f}-editor.vue`)
    expect(text).toContain('defineAsyncComponent')
    expect(text).toContain('registerAllBuiltInEditors')
  })
})
