import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * <zh/> isVirtual 消费白名单守卫（收敛防回退）——hook/业务层不得新增 `if (isVirtual)` 模式判断，
 * <zh/> 新代码一律查 `caps` 能力表。仅能力源/适配器内部/管道透传/模板语义分支允许。
 * <en/> isVirtual consumption allowlist guard (convergence anti-regression) — hooks/business code
 * <en/> must not add new `if (isVirtual)` mode checks; new code queries the `caps` table instead.
 * <en/> Only the capability source / adapter internals / pipeline passthrough / template branches are allowed.
 */

// <zh/> 允许出现 isVirtual **代码引用**的文件（相对 src 的正斜杠路径）
// <en/> Files allowed to contain isVirtual **code references** (forward-slash paths relative to src)
const ALLOWLIST = new Set([
  'composables/core/use-table-config.ts',
  'composables/core/use-renderer-adapter.ts',
  'composables/core/use-table-renderer-refs.ts',
  'composables/core/use-adv-table-core.ts',
  'composables/use-adv-table.ts',
  'AdvTable.vue',
  'types/renderer.ts',
  'types/renderer-caps.ts',
  'index.ts',
])

function isCommentLine(trimmed: string): boolean {
  return trimmed.startsWith('//')
    || trimmed.startsWith('*')
    || trimmed.startsWith('/*')
    || trimmed.startsWith('<!--')
    || trimmed.startsWith('#')
}

function scanIsVirtualUsages(rootDir: string): Array<{ file: string, line: number, text: string }> {
  const results: Array<{ file: string, line: number, text: string }> = []

  function walkDir(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.turbo')
          continue
        walkDir(fullPath)
        continue
      }
      if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.vue') && !entry.name.endsWith('.tsx'))
        continue
      const relativePath = path.relative(rootDir, fullPath).split(path.sep).join('/')
      const content = fs.readFileSync(fullPath, 'utf-8')
      const lines = content.split('\n')
      lines.forEach((line, idx) => {
        if (!line.includes('isVirtual'))
          return
        const trimmed = line.trim()
        if (isCommentLine(trimmed))
          return
        // <zh/> 类型守卫名 isVirtualRendererProps 属类型层，非模式布尔量，放行
        // <en/> The type-guard name isVirtualRendererProps is type-level, not the mode boolean — allow
        const withoutGuardName = line.split('isVirtualRendererProps').join('')
        if (!withoutGuardName.includes('isVirtual'))
          return
        // <zh/> 行内注释提及（如“原 isVirtual ? v2 : el 分派已移除”）不计入
        // <en/> Inline comment mentions (e.g. "former isVirtual ? v2 : el dispatch removed") don't count
        const codePart = line.split('//')[0]
        if (!codePart.includes('isVirtual'))
          return
        results.push({ file: relativePath, line: idx + 1, text: trimmed.slice(0, 160) })
      })
    }
  }

  walkDir(rootDir)
  return results
}

describe('guards/is-virtual-allowlist', () => {
  const srcDir = path.resolve(__dirname, '../../src')

  it('isVirtual code usages stay within the allowlist', () => {
    const usages = scanIsVirtualUsages(srcDir)
    const violations = usages.filter(u => !ALLOWLIST.has(u.file))
    if (violations.length > 0) {
      const details = violations.map(v => `  ${v.file}:${v.line} -> ${v.text}`).join('\n')
      console.error(`\n[is-virtual-allowlist] Violations (${violations.length}):\n${details}`)
    }
    expect(violations, 'New isVirtual code usages outside the allowlist. Query caps instead.').toEqual([])
  })

  it('advTable.vue keeps at most 3 template isVirtual branches', () => {
    const tableVue = fs.readFileSync(path.resolve(srcDir, 'AdvTable.vue'), 'utf-8')
    const templatePart = tableVue.split('<template>')[1]?.split('</template>')[0] ?? ''
    const scriptPart = tableVue.split('<template>')[0] ?? ''
    const templateHits = templatePart.split('isVirtual').length - 1
    // <zh/> script 内的 rendererProps/computed 引用计入 allowlist 但不计入模板配额
    // <en/> Script-side rendererProps/computed refs are allowlisted, not counted against the template quota
    void scriptPart
    expect(templateHits, `AdvTable.vue template isVirtual branches must stay <= 3 (got ${templateHits})`).toBeLessThanOrEqual(3)
  })
})
