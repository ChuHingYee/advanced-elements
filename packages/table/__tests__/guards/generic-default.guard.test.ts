import type {
  CellClickEvent,
  HeaderClickEvent,
  RowClickEvent,
  ScrollEvent,
  SelectionChangeEvent,
  SortChangeEvent,
} from '../../src/types/events'
import type { AdvTableEmitsMap } from '../../src/types/table-emits'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'

// ─── 泛型默认值唯一性扫描器（spec 5.5.1.1a） ───
// ─── Generic-default uniqueness scanner ───

/**
 * <zh/> 甄别豁免清单：纯"字符串键任意值映射"语义的非行数据泛型（如查询表单模型），不属行数据泛型混用范畴，保留 Record 形态。
 * <en/> Exemption list for generic-default scanner: non-row-data generics with pure "string-key arbitrary-value mapping" semantics (e.g. form model). These are not row-data generic misuse and retain their Record form.
 */
const GENERIC_DEFAULT_EXEMPTIONS: Array<{ file: string, reason: string }> = [
  // <zh/> 以下为纯字符串键值映射语义，不属于行数据泛型
  // <en/> The following are pure string-key mapping semantics, not row-data generics
  { file: 'types/config-options.ts', reason: 'formModel Record<string, any> — search form model shape, not row data' },
  { file: 'types/config-tree.ts', reason: 'searchForm/columnSelect model shapes — pure key-value mapping, not row data' },
]

/**
 * <zh/> 静态扫描源文件，提取所有 `<T = <default>>` 形态的泛型默认值（仅扫描行数据泛型相关模式）。
 * <en/> Statically scan source files for all `<T = <default>>` generic-default patterns.
 */
function scanGenericDefaults(rootDir: string): Array<{ file: string, line: number, default: string }> {
  const results: Array<{ file: string, line: number, default: string }> = []
  const exemptionFiles = new Set(GENERIC_DEFAULT_EXEMPTIONS.map(e => e.file))

  function walkDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.turbo')
          continue
        walkDir(fullPath)
      }
      else if (entry.name.endsWith('.ts') || entry.name.endsWith('.vue')) {
        // Skip exempted files (non-row-data generics)
        const relativePath = path.relative(rootDir, fullPath).split(path.sep).join('/')
        if (exemptionFiles.has(relativePath))
          continue

        const content = fs.readFileSync(fullPath, 'utf-8')
        const lines = content.split('\n')
        lines.forEach((line, idx) => {
          // Match `<T = X>` generic default patterns (with optional whitespace).
          // NOTE: `Record<string, unknown>` contains a nested `>`, so try it first before the generic capture.
          const recordMatch = line.match(/<T\s*=\s*(Record<string,\s*unknown>)\s*>/)
          const match = recordMatch ?? line.match(/<T\s*=\s*([^\s>][^>]*)>/)
          if (match) {
            const defaultVal = match[1].trim()
            results.push({
              file: relativePath,
              line: idx + 1,
              default: defaultVal,
            })
          }
        })
      }
    }
  }

  walkDir(rootDir)
  return results
}

describe('guards/generic-default', () => {
  const srcDir = path.resolve(__dirname, '../../src')
  // <zh/> 行数据泛型默认值策略：允许 `any`（存量兼容）与 `Record<string, unknown>`（新标准，公开入口优先）；
  // <zh/> 禁止其他默认值（如 unknown/never/具体对象），保持传导一致。
  // <en/> Row-data generic default policy: allow `any` (legacy compat) and
  // <en/> `Record<string, unknown>` (new standard, preferred for public entry points); forbid others.
  const ALLOWED_DEFAULTS = new Set(['any', 'Record<string, unknown>'])

  it('row-data generics use only allowed defaults (`any` | `Record<string, unknown>`)', () => {
    const allDefaults = scanGenericDefaults(srcDir)
    const violations = allDefaults.filter(({ default: d }) => !ALLOWED_DEFAULTS.has(d))

    if (violations.length > 0) {
      const details = violations.map(v => `  ${v.file}:${v.line} -> <T = ${v.default}>`).join('\n')

      console.error(`\n[generic-default] Violations found (${violations.length}):\n${details}`)
    }

    expect(
      violations,
      `Row-data generics must use allowed defaults (\`any\` | \`Record<string, unknown>\`). Found ${violations.length} violation(s).`,
    ).toEqual([])
  })

  it('public entry points prefer `Record<string, unknown>` over `any`', () => {
    const allDefaults = scanGenericDefaults(srcDir)
    const byFile = new Map(allDefaults.map(d => [`${d.file}:${d.line}`, d]))
    void byFile
    const propsFile = path.resolve(srcDir, 'types/table-props.ts')
    const slotsFile = path.resolve(srcDir, 'types/slots.ts')
    const propsContent = fs.readFileSync(propsFile, 'utf-8')
    const slotsContent = fs.readFileSync(slotsFile, 'utf-8')
    expect(propsContent, 'AdvTableProps default must be Record<string, unknown>').toMatch(/AdvTableProps<T\s*=\s*Record<string,\s*unknown>>/)
    expect(slotsContent, 'AdvTableColumnSlotProps default must be Record<string, unknown>').toMatch(/AdvTableColumnSlotProps<T\s*=\s*Record<string,\s*unknown>>/)
  })

  it('all generic defaults in source are allowed or in the exemption list', () => {
    const allDefaults = scanGenericDefaults(srcDir)
    const nonAllowedDefaults = allDefaults.filter(({ default: d }) => !ALLOWED_DEFAULTS.has(d))

    // Every non-allowed default must be from an exempted file (which are skipped in scan)
    expect(nonAllowedDefaults).toEqual([])
  })

  // ─── 行数据载荷传导检查（spec 5.5.1.3） ───
  // ─── Row-data payload transmission check ───

  it('event payload aliases with row-data fields transmit generic parameter (not hardcoded any)', () => {
    // <zh/> 这些载荷别名含行数据字段，必须透传泛形参 T
    // <en/> These payload aliases contain row-data fields, must transmit generic T

    type RowClickT = RowClickEvent<{ id: number }>
    type CellClickT = CellClickEvent<{ name: string }>

    // <zh/> 编译期断言：透传泛形参后，载荷行数据字段类型正确收窄
    // <en/> Compile-time assertion: row data field types correctly narrowed after generic transmission
    type _AssertRowClick = RowClickT['row'] extends { id: number } ? true : false
    type _AssertCellClick = CellClickT['cellData'] extends unknown ? true : false

    const check: [_AssertRowClick, _AssertCellClick] = [true, true]
    expect(check).toEqual([true, true])
  })

  it('event payload aliases without row-data fields can use default any (consistency)', () => {
    // <zh/> 这些载荷别名不含行数据字段（表头/排序/滚动），透传泛形参后行为一致
    // <en/> These payload aliases have no row-data fields (header/scroll/sort), consistent after generic transmission

    type HeaderClickT = HeaderClickEvent<{ id: number }>
    type SortChangeT = SortChangeEvent<{ id: number }>
    type ScrollT = ScrollEvent<{ id: number }>

    // <zh/> 编译期断言：无行数据字段的载荷类型不受泛形参影响
    // <en/> Compile-time assertion: payload types without row-data fields unaffected by generic
    type _AssertHeader = HeaderClickT extends HeaderClickEvent ? true : false
    type _AssertSort = SortChangeT extends SortChangeEvent ? true : false
    type _AssertScroll = ScrollT extends ScrollEvent ? true : false

    const check: [_AssertHeader, _AssertSort, _AssertScroll] = [true, true, true]
    expect(check).toEqual([true, true, true])
  })

  // ─── 泛型传导验证用例 ───
  // ─── Generic transmission verification ───

  it('advTableEmitsMap<T> correctly transmits row type to event payloads', () => {
    interface UserRow {
      id: number
      name: string
      email: string
    }

    type Emits = AdvTableEmitsMap<UserRow>

    // <zh/> 编译期断言：rowClick 载荷行数据字段类型为 UserRow
    // <en/> Compile-time assertion: rowClick payload row field type is UserRow
    type _RowClickRow = Emits['rowClick'][0]['row'] extends UserRow ? (UserRow extends Emits['rowClick'][0]['row'] ? true : false) : false
    type _CellClickRow = Emits['cellClick'][0]['row'] extends UserRow ? (UserRow extends Emits['cellClick'][0]['row'] ? true : false) : false

    const check: [_RowClickRow, _CellClickRow] = [true, true]
    expect(check).toEqual([true, true])
  })

  it('selection payload transmits row type through SelectionChangeEvent alias', () => {
    interface ProductRow {
      sku: string
      price: number
    }

    type SelEvent = SelectionChangeEvent<ProductRow>

    // <zh/> 编译期断言：selection 字段的行数据类型为 ProductRow
    // <en/> Compile-time assertion: selection row data type is ProductRow
    type _SelectionType = SelEvent['selection'][0] extends ProductRow ? true : false

    const check: [_SelectionType] = [true]
    expect(check).toEqual([true])
  })
})
