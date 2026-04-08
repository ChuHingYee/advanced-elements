import type { ColumnState } from '../../src/types/column-state'
import type {
  ColumnContext as _ColumnContext,
  CrossCuttingContext as _CrossCuttingContext,
  RendererContext as _RendererContext,
  RowContext as _RowContext,
} from '../../src/types/orchestrator-context'
import type { AdvTableEmitsMap } from '../../src/types/table-emits'
import type { AdvTableProps } from '../../src/types/table-props'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'

// ─── 静态守卫：出口白名单扫描（spec 5.6.1.2a） ───
// ─── Static guard: export whitelist scan ───

/**
 * <zh/> 通配导出白名单：允许出现在 `src/types/index.ts` 或 `src/index.ts` 的 `export * from '...'` 中的目标模块。
 * <en/> Wildcard export whitelist: module targets allowed in `export * from '...'` within `src/types/index.ts` or `src/index.ts`.
 */
const EXPORT_WHITELIST = [
  './cell-locator',
  './clipboard-api',
  './column',
  './column-state',
  './config',
  './context-menu',
  './drag-locator',
  './edit',
  './error',
  './events',
  './filter',
  './interceptor',
  './renderer',
  './renderer-caps',
  './request',
  './response',
  './row-rect',
  './scope',
  './slots',
  './sort',
  './table-emits',
  './table-props',
  './translator',
  './version',
] as const

/**
 * <zh/> 禁止出现在通配导出中的内部模块。
 * <en/> Internal modules that must never appear in wildcard exports.
 */
const INTERNAL_MODULES = [
  './orchestrator-context',
  './renderer-emits',
] as const

/**
 * <zh/> 从源文件文本中解析全部 `export * from '...'` 语句的目标模块。
 * <en/> Parse all `export * from '...'` target modules from source text.
 */
function parseWildcardExports(sourceText: string): string[] {
  const results: string[] = []
  const regex = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  do {
    match = regex.exec(sourceText)
    if (match) {
      results.push(match[1])
    }
  } while (match)
  return results
}

describe('guards/type-exports type-contract', () => {
  const typesIndexFile = path.resolve(__dirname, '../../src/types/index.ts')
  const packageIndexFile = path.resolve(__dirname, '../../src/index.ts')
  const typesIndexContent = fs.readFileSync(typesIndexFile, 'utf-8')
  const packageIndexContent = fs.readFileSync(packageIndexFile, 'utf-8')

  it('types/index.ts only whitelisted modules appear in export *', () => {
    const wildcardExports = parseWildcardExports(typesIndexContent)

    for (const exp of wildcardExports) {
      const isWhitelisted = (EXPORT_WHITELIST as readonly string[]).includes(exp)
      expect(
        isWhitelisted,
        `Module "${exp}" in types/index.ts is not in the export whitelist. Add it to EXPORT_WHITELIST or use named export.`,
      ).toBe(true)
    }
  })

  it('no internal modules appear in types/index.ts export *', () => {
    const wildcardExports = parseWildcardExports(typesIndexContent)

    for (const internal of INTERNAL_MODULES) {
      expect(
        wildcardExports,
        `Internal module "${internal}" must not appear in wildcard exports.`,
      ).not.toContain(internal)
    }
  })

  it('index.ts only re-exports from whitelisted module paths', () => {
    const wildcardExports = parseWildcardExports(packageIndexContent)

    const allowedFromIndex = ['./types']
    for (const exp of wildcardExports) {
      const isAllowed = allowedFromIndex.includes(exp)
      expect(
        isAllowed,
        `Module "${exp}" in index.ts is not in the allowed re-export list.`,
      ).toBe(true)
    }
  })

  it('no internal module names appear in index.ts export *', () => {
    const wildcardExports = parseWildcardExports(packageIndexContent)

    for (const internal of INTERNAL_MODULES) {
      expect(
        wildcardExports,
        `Internal module "${internal}" must not appear in index.ts wildcard exports.`,
      ).not.toContain(internal)
    }
  })
})

// ─── 类型级守卫：内部类型不得从包根导入 ───
// ─── Type-level guard: internal types not importable from package root ───

/**
 * <zh/> 类型级测试：已移除的内部类型不应从 `../../src/types` 导入成功
 * <en/> Type-level test: removed internal types should not be importable from `../../src/types`
 *
 * <zh/> 注意：以下类型已通过包内文件直接路径导入（`'../../types/orchestrator-context'`）保证可用，
 * <zh/> 但从包根 `'@advanced-elements/table'` 或 `'../../src/types'` 不应再能访问。
 * <en/> Note: These types remain accessible via direct paths within the package.
 */
describe('guards/type-exports type-level contract', () => {
  it('public types can be imported (sanity check)', () => {
    // <zh/> 编译期守卫：公共类型可正常导入
    // <en/> Compile-time guard: public types importable
    type _CheckEmits = AdvTableEmitsMap extends never ? false : true
    type _CheckProps = AdvTableProps extends never ? false : true
    type _CheckState = ColumnState extends never ? false : true

    const check: [_CheckEmits, _CheckProps, _CheckState] = [true, true, true]
    expect(check).toEqual([true, true, true])
  })

  it('internal orchestrator-context types are not in the public export surface', () => {
    // <zh/> 类型级守卫：orchestrator-context 类型不应从 types/index 导出。
    // <zh/> 类型擦除后运行时无信号，真正的否定断言由上方白名单扫描承担；此处锁定"直接路径可用"，
    // <zh/> 类型损坏时编译期失败（旧 expect(true) 写法恒绿，属假阳性）。
    // <en/> Compile-time guard: orchestrator-context types should not be exported from types/index.
    // <en/> No runtime signal survives erasure — the negative assertion lives in the whitelist scan above;
    // <en/> this locks "usable via direct paths" and fails compilation when the types break.
    type _CheckRow = _RowContext<{ id: number }> extends never ? false : true
    type _CheckCol = _ColumnContext extends never ? false : true
    type _CheckRenderer = _RendererContext extends never ? false : true
    type _CheckCross = _CrossCuttingContext extends never ? false : true

    const check: [_CheckRow, _CheckCol, _CheckRenderer, _CheckCross] = [true, true, true, true]
    expect(check).toEqual([true, true, true, true])
  })
})
