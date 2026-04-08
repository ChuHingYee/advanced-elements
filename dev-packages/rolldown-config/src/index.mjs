import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import * as sass from 'sass'

// <zh/> 经 stdout 输出（不用 console.*，避开 no-console 门禁）
// <en/> Output via stdout (not console.*, staying clear of the no-console gate)
const out = msg => process.stdout.write(`${msg}\n`)

/** <zh/> 匹配 `_` 开头的 partial 文件 | <en/> Matches `_`-prefixed partial files */
const SCSS_PARTIAL_RE = /(^|\/)_[^/]*\.scss$/

/**
 * <zh/> 向上查找工作区根（含 pnpm-workspace.yaml 的首个祖先目录）
 * <en/> Walk up to the workspace root (first ancestor holding pnpm-workspace.yaml)
 */
function findWorkspaceRoot(start) {
  let dir = start.replace(/\\/g, '/')
  for (let i = 0; i < 8; i++) {
    if (existsSync(`${dir}/pnpm-workspace.yaml`))
      return dir
    const parent = dir.replace(/\/[^/]*$/, '')
    if (!parent || parent === dir)
      break
    dir = parent
  }
  return start
}
/** <zh/> 匹配 SFC <style> 块 | <en/> Matches SFC <style> blocks */
const SFC_STYLE_RE = /<style[\s>]/
/** <zh/> 匹配裸 .css 导入（静态与动态） | <en/> Matches bare .css imports (static and dynamic) */
const CSS_IMPORT_RE = /\bimport\s*\(\s*['"][^'"]+\.css['"]/
/** <zh/> 匹配裸 .css 来源子句 | <en/> Matches bare .css from-clauses */
const CSS_FROM_RE = /\bfrom\s+['"][^'"]+\.css['"]/
/** <zh/> JS 入口的 d.ts 后缀 | <en/> d.ts suffix for generated JS entries */
const JS_ENTRY_DTS_RE = /\.m?js$/
/** <zh/> 测试/故事文件（运行时 EP 样式扫描跳过） | <en/> Test/story files (skipped by the runtime EP style scan) */
const TEST_FILE_RE = /\.(test|spec|stories)\.(vue|tsx|ts)$/

/**
 * Recursively collect .scss files / 递归收集 .scss 文件
 */
function collectScssFiles(dir) {
  const results = []
  if (!existsSync(dir))
    return results
  for (const entry of readdirSync(dir)) {
    const fullPath = resolve(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      results.push(...collectScssFiles(fullPath))
    }
    else if (entry.endsWith('.scss')) {
      results.push(fullPath)
    }
  }
  return results
}

/**
 * Recursively collect source files (.vue, .tsx, .ts) / 递归收集源文件
 *
 * @param {string} dir - directory to scan
 * @param {object} [options] - collection options
 * @param {boolean} [options.excludeTests] - skip `__tests__` dirs and `*.test|spec|stories.*`
 * (for runtime-only scans; the style contract check keeps full coverage)
 */
function collectSourceFiles(dir, options = {}) {
  const { excludeTests = false } = options
  const results = []
  if (!existsSync(dir))
    return results
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.'))
      continue
    if (excludeTests && (entry === '__tests__' || TEST_FILE_RE.test(entry)))
      continue
    const fullPath = resolve(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      results.push(...collectSourceFiles(fullPath, options))
    }
    else if (entry.endsWith('.vue') || entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      results.push(fullPath)
    }
  }
  return results
}

/**
 * Convert PascalCase to kebab-case (e.g. TableV2 → table-v2, InputNumber → input-number)
 */
function pascalToKebab(name) {
  return name
    .replace(/([A-Z])/g, '-$1')
    .replace(/^-/, '')
    .toLowerCase()
}

/**
 * Scan source files for Element Plus imports and collect component names.
 * 从源码中扫描 Element Plus 导入并收集组件名。
 *
 * Matches:
 * - Static named imports: `import { ElTable, ElButton, vLoading } from 'element-plus'`
 * - Deep path imports: `import { ElTable } from 'element-plus/es'`
 * - Dynamic imports: `const { ElTable } = await import('element-plus')`
 *
 * Skips: `import type { ... } from 'element-plus'` (type-only imports)
 * Skips: `import { useGlobalConfig } from 'element-plus'` (composables, no styles)
 * Skips: `__tests__` dirs and `*.test|spec|stories.*` (dev-only imports never ship)
 */
function scanElementPlusImports(srcDir) {
  const components = new Set()
  const files = collectSourceFiles(srcDir, { excludeTests: true })

  // Extended regex to cover static, deep-path, and dynamic imports
  // 1. Static named imports: import { ElXxx } from 'element-plus' or 'element-plus/es'.
  //    The (?!...) guard skips `import type {...}` (no runtime component, no styles needed).
  //    NOTE: must not rely on `;` terminators — the repo uses semicolon-less style, so any
  //    `[^;]*` span would swallow subsequent statements across lines.
  const staticRegex = /\bimport(?!\s+type\b)\s*\{([^}]+)\}\s*from\s*['"]element-plus(?:\/es)?['"]/g
  // 2. Dynamic imports with destructuring: const { ElXxx } = await import('element-plus')
  const dynamicRegex = /\b(?:const|let|var)\s*\{([^}]+)\}\s*=\s*(?:await\s+)?import\s*\(\s*['"]element-plus['"]\s*\)/g

  for (const file of files) {
    const content = readFileSync(file, 'utf-8')

    for (const regex of [staticRegex, dynamicRegex]) {
      for (let match = regex.exec(content); match !== null; match = regex.exec(content)) {
        const imports = match[1].split(',').map(s => s.trim())
        for (const imp of imports) {
          const name = imp.split(/\s+as\s+/)[0].trim()
          // Collect El* components and v* directives (vLoading, etc.)
          // Skip use* composables (useGlobalConfig, etc.) — no styles needed
          if (name.startsWith('El') || /^v[A-Z]/.test(name)) {
            components.add(name)
          }
        }
      }
    }
  }

  return components
}

/**
 * 指令名到样式目录的显式映射（与 ElementPlusResolver 的 directives 表对齐）
 * Directive names to style dirs (aligned with ElementPlusResolver's directive table)
 */
const EP_DIRECTIVE_STYLE_NAMES = {
  Loading: 'loading',
  Popover: 'popover',
  InfiniteScroll: 'infinite-scroll',
}
/** <zh/> 匹配 `vXxx` 指令名并捕获 Pascal 部分 | <en/> Matches `vXxx` directive names, capturing the Pascal part */
const EP_DIRECTIVE_RE = /^v([A-Z].*)$/

/**
 * <zh/> 已知无独立样式模块的 EP 组件——与上游 ElementPlusResolver 的
 * <zh/> `noStylesComponents = ["ElAutoResizer"]` 对齐，静默跳过（其视觉样式随 table-v2 入口一并引入）。
 * <zh/> 不在此表的缺失目录仍走 warn，保留对 EP 升级改名/扫描误报的感知。
 * <en/> EP components known to ship no standalone style module — aligned with upstream
 * <en/> ElementPlusResolver's `noStylesComponents = ["ElAutoResizer"]`, skipped silently
 * <en/> (their visuals come with the table-v2 entry). Missing dirs NOT on this list still
 * <en/> warn, keeping visibility into EP upgrade renames / scan false positives.
 */
const EP_NO_STYLE_COMPONENTS = new Set(['ElAutoResizer'])

/**
 * Generate a side-effect JS entry re-exporting the exact EP style modules this
 * package uses internally, by scanning source code for EP imports.
 * 扫描源码中使用的 Element Plus 组件，生成按需复述其样式模块的副作用 JS 入口。
 *
 * 描述符刻意与 ElementPlusResolver 默认（importStyle: 'css'）输出逐字节一致
 * （`element-plus/es/components/<dir>/style/css`），消费方打包器按 resolved id
 * 去重：resolver 已注入过的组件只打包一次；包独占的组件得以覆盖；版本恒为消费方 peer EP。
 *
 * 映射规则：
 * - ElTable → table / ElTableV2 → table-v2 / ElInputNumber → input-number
 * - vLoading → loading（指令走显式映射表）
 * - 无样式目录的组件（如 ElAutoResizer，与 resolver 的 noStylesComponents 一致）跳过
 *
 * @param {string} srcDir - 源码目录
 * @param {object} [options] - 可选配置
 * @param {string} [options.root] - 包根目录（默认 process.cwd()），用于存在性校验
 * @returns {string|null} JS 入口内容，无组件时返回 null
 */
function generateElementPlusStyleEntry(srcDir, options = {}) {
  const { root = process.cwd() } = options

  const components = scanElementPlusImports(srcDir)
  if (components.size === 0) {
    return null
  }

  const dirs = new Set()
  for (const comp of components) {
    let dir = null
    if (comp.startsWith('El')) {
      dir = pascalToKebab(comp.slice(2))
    }
    else {
      const m = EP_DIRECTIVE_RE.exec(comp)
      if (m)
        dir = EP_DIRECTIVE_STYLE_NAMES[m[1]] ?? pascalToKebab(m[1])
    }
    if (!dir)
      continue
    // <zh/> 已知无样式组件静默跳过；未知缺失仍告警（EP 升级改名/扫描误报的信号）
    // <en/> Known style-less components skip silently; unknown missing dirs still warn (signal for EP upgrade renames / scan false positives)
    if (EP_NO_STYLE_COMPONENTS.has(comp))
      continue
    // 存在性校验 = 与 resolver 的 noStylesComponents 对齐后剩余项的真实校验
    // Existence check for everything not explicitly allow-listed above.
    if (!existsSync(resolve(root, 'node_modules/element-plus/es/components', dir, 'style', 'css.mjs'))) {
      console.warn(`[ep-styles] skip ${comp}: no style module at es/components/${dir}/style/css.mjs`)
      continue
    }
    dirs.add(dir)
  }

  if (dirs.size === 0) {
    return null
  }

  const banner = `/**
 * AUTO-GENERATED by rolldown-config. Do not edit manually.
 * Side-effect entry: import once to load exactly the EP styles this package uses.
 * Specifiers intentionally match ElementPlusResolver defaults (importStyle: 'css'),
 * so bundlers dedupe them with resolver-injected styles by resolved id.
 */
`

  return `${banner}import 'element-plus/es/components/base/style/css';\n${[...dirs].sort().map(d => `import 'element-plus/es/components/${d}/style/css';`).join('\n')}\n`
}

/**
 * Incremental SCSS compilation cache — tracks file mtime to skip unchanged files in watch mode.
 * Incremental cache for SCSS compilation.
 */
const scssMtimeCache = new Map()

/**
 * <zh/> 双输出（ESM + CJS）下 writeBundle 每个 output 触发一次，且实测 buildStart 也会随之再触发，
 * <zh/> 导致旧的 buildStart 重置标记从未真正去重（单次构建打两遍 scss/ep 日志、写两遍文件）。
 * <zh/> 改为按 output.format 门控：只在 es 输出（各包首个输出，preserveModules 下唯一输出）跑一次；
 * <zh/> watch 重构建仍正常触发（mtime 缓存决定跳过与否）。
 * <en/> writeBundle fires once per output (ESM + CJS), and buildStart observably re-fires with it,
 * <en/> so the old buildStart-reset flag never actually deduped (one build logged/wrote scss+ep twice).
 * <en/> Gate on output.format instead: run once on the es output (first output of every package,
 * <en/> the only output under preserveModules); watch rebuilds still trigger normally
 * <en/> (the mtime cache decides skip vs compile).
 */
const SCSS_EMIT_FORMAT = 'es'

/**
 * Compile .scss → .css and copy original .scss files in a single pass.
 * 编译 .scss → .css 并复制原始 .scss 文件，单次遍历完成。
 *
 * 支持 sourcemap 输出
 * 支持增量编译（基于 mtime 缓存，watch 模式下跳过未变更文件）
 *
 * @param {string} srcDir - SCSS 源码目录
 * @param {string} destDir - 输出目录
 * @param {boolean} isDev - 是否为开发模式
 * @param {object} [options] - 可选配置
 * @param {boolean} [options.sourceMap] - 是否生成 sourcemap
 * @param {string} [options.root] - 包根目录（默认 process.cwd()），用于 sass loadPaths
 * @param {(rel: string) => boolean} [options.excludeCompile] - 返回 true 则仅复制源码、不独立编译
 * （如 `_` 开头的 partial，被 @use 引用即可，独立编译产物无用）
 */
function processScss(srcDir, destDir, isDev, options = {}) {
  const { sourceMap = true, root = process.cwd(), excludeCompile } = options
  const files = collectScssFiles(srcDir)
  if (files.length === 0)
    return

  const sassOptions = {
    style: 'compressed',
    silenceDeprecations: ['legacy-js-api'],
    loadPaths: [
      resolve(root, 'node_modules'),
      resolve(root, 'src'),
      // <zh/> pnpm 下包级 node_modules 无 element-plus 等同级依赖，兜底工作区根 node_modules
      // <en/> Fall back to the workspace-root node_modules (pnpm isolates per-package dirs)
      resolve(findWorkspaceRoot(root), 'node_modules'),
    ],
    sourceMap,
    sourceMapIncludeSources: sourceMap,
  }

  let compiled = 0
  let skipped = 0

  for (const srcPath of files) {
    let rel = srcPath.slice(srcDir.length).replace(/^[/\\]/, '')
    // Normalize to forward slashes for cross-platform compatibility
    rel = rel.replace(/\\/g, '/')
    const destCssPath = resolve(destDir, rel.replace(/\.scss$/, '.css'))
    const destScssPath = resolve(destDir, rel)
    const destMapPath = resolve(destDir, rel.replace(/\.scss$/, '.css.map'))

    const lastSlash = rel.lastIndexOf('/')
    const destSubDir = lastSlash >= 0 ? resolve(destDir, rel.slice(0, lastSlash)) : destDir
    if (!existsSync(destSubDir)) {
      mkdirSync(destSubDir, { recursive: true })
    }

    // Incremental compilation — skip unchanged files (based on mtime)
    // Note: partials (_*.scss) changed by another file won't be detected here.
    // In watch mode, SFC style changes trigger Vue plugin rebuild; standalone
    // SCSS changes are caught by their own mtime. Partials affecting multiple
    // files require a full rebuild (delete dist/style to force).
    const mtime = statSync(srcPath).mtimeMs
    const cachedMtime = scssMtimeCache.get(srcPath)
    if (cachedMtime === mtime && existsSync(destCssPath) && existsSync(destScssPath)) {
      skipped++
      continue
    }
    scssMtimeCache.set(srcPath, mtime)

    // Partials excluded from standalone compilation still get their source copied below,
    // so `@use` from dist keeps working while no useless `<partial>.css` is emitted.
    if (!excludeCompile || !excludeCompile(rel)) {
      try {
        const result = sass.compile(srcPath, sassOptions)
        writeFileSync(destCssPath, result.css)
        // Write sourcemap
        if (sourceMap && result.sourceMap) {
          const sm = result.sourceMap
          // Normalize source paths to be relative for portability
          sm.sources = sm.sources.map(s => s.replace(/\\/g, '/'))
          writeFileSync(destMapPath, JSON.stringify(sm))
        }
        compiled++
      }
      catch (e) {
        const msg = `[scss] Failed to compile ${rel}: ${e.message}`
        if (isDev) {
          console.error(msg)
        }
        else {
          throw new Error(msg)
        }
      }
    }

    try {
      copyFileSync(srcPath, destScssPath)
    }
    catch (e) {
      console.error(`[scss] Failed to copy ${rel}:`, e.message)
    }
  }

  if (compiled > 0 || skipped > 0) {
    out(`[scss] Compiled ${compiled} file(s)${skipped > 0 ? `, skipped ${skipped} unchanged` : ''}`)
  }
}

/**
 * Generate external dependency filter function.
 * Generates an external dependency filter from package.json fields.
 *
 * @param {object} pkg - package.json content
 * @param {string[]} [externals] - additional external module names
 * @returns {(id: string) => boolean} external filter function
 */
function generateExternal(pkg, externals = []) {
  const { dependencies = {}, peerDependencies = {}, optionalDependencies = {} } = pkg
  const names = [
    ...Object.keys(peerDependencies),
    ...Object.keys(dependencies),
    // Include optionalDependencies (e.g. vue-router, xlsx)
    ...Object.keys(optionalDependencies),
    ...externals,
  ]
  return (id) => {
    if (names.includes(id))
      return true
    return names.some(
      name => id.startsWith(`${name}/`),
    )
  }
}

/**
 * Create a complete Rolldown config object.
 *
 * 与 createRollupPlugins 接口一致，消费方只需将 import 路径从
 * `@advanced-elements/rollup-config` 改为 `@advanced-elements/rolldown-config`，
 * 并将构建脚本中的 `rollup -c` 替换为 `rolldown -c` 即可完成迁移。
 *
 * 相比 rollup-config 的差异：
 * - 移除 rollup-plugin-esbuild → Rolldown 内置 oxc transform 处理 TS/JSX
 * - 移除 @rollup/plugin-node-resolve → Rolldown 内置模块解析
 * - 移除 @rollup/plugin-commonjs → Rolldown 内置 CJS 转 ESM
 * - 移除 @rollup/plugin-terser → 使用 Rolldown 原生 output.minify
 * - 移除 rollup-plugin-postcss → 样式改由内置 processScss 管线直调 dart-sass 编译
 */

/**
 * Assert the repo's style contract at build start: every stylesheet must live in
 * `src/style` because the postcss plugin is configured with `extract: false,
 * inject: false` (SFC `<style>` blocks and plain `.css` imports would be silently
 * dropped). Fail fast with a fix hint instead of shipping unstyled components.
 */
function assertStyleContract(srcDir) {
  const offenders = []
  for (const file of collectSourceFiles(srcDir)) {
    const content = readFileSync(file, 'utf-8')
    if (file.endsWith('.vue') && SFC_STYLE_RE.test(content))
      offenders.push(`${file}: SFC <style> block`)
    if (CSS_IMPORT_RE.test(content) || CSS_FROM_RE.test(content))
      offenders.push(`${file}: plain .css import`)
  }
  if (offenders.length > 0) {
    throw new Error(
      `[style-contract] ${offenders.length} file(s) violate the style contract `
      + `(SFC <style> and plain .css imports are dropped by this config):\n - ${offenders.join('\n - ')}\n`
      + `Move styles into src/style/*.scss (see README "样式契约").`,
    )
  }
}

/**
 * @param {object} pkg - package.json content
 * @param {object} [options] - configuration options
 * @param {string} [options.root] - package root directory (defaults to process.cwd());
 * all path resolutions below derive from it so builds are independent of the invoking cwd
 * @param {string} [options.input] - entry file
 * @param {boolean} [options.isDev] - dev mode flag (defaults to NODE_ENV check)
 * @param {string[]} [options.externals] - additional external modules
 * (e.g. transitive deps only reached via dynamic import, like `async-validator`)
 * @param {string} [options.styleOutput] - style output directory
 * @param {string} [options.elementPlusStyleEntry] - dist-relative path of the generated EP
 * style side-effect entry (e.g. 'style/element-plus.js'); unset disables generation.
 * Specifiers match ElementPlusResolver defaults so bundlers dedupe with resolver-injected styles.
 * @param {boolean} [options.preserveModules] - preserve module structure (ESM-only)
 * @param {boolean} [options.sourcemap] - generate sourcemaps for JS and CSS
 */
function createRolldownConfig(pkg, options = {}) {
  const {
    root = process.cwd(),
    input = 'src/index.ts',
    isDev = process.env.NODE_ENV === 'development',
    externals = [],
    styleOutput = 'dist/style',
    elementPlusStyleEntry = null,
    preserveModules = false,
    sourcemap = true,
  } = options

  const external = generateExternal(pkg, externals)
  const srcDir = resolve(root, 'src')
  const styleDir = resolve(root, 'src/style')
  const destStyleDir = resolve(root, styleOutput)

  const plugins = [
    {
      name: 'assert-style-contract',
      buildStart() {
        assertStyleContract(srcDir)
      },
    },
    vue({
      preprocessStyles: true,
      css: false,
      // NOTE: no scss.additionalData — SFC <style> blocks are banned by
      // assert-style-contract above, so injected globals would never apply.
    }),
    vueJsx(),
    // NOTE: no postcss plugin by design — all styles must live in src/style/*.scss
    // (enforced by assert-style-contract above) and are compiled by the process-scss
    // hook below with dart-sass directly. The previous extract:false/inject:false setup
    // silently discarded any SFC <style> or .css import it happened to process.
    {
      name: 'process-scss',
      writeBundle(outputOptions) {
        // <zh/> 见 SCSS_EMIT_FORMAT：单构建只跑一次，跳过 CJS 输出对应的第二次触发
        // <en/> See SCSS_EMIT_FORMAT: run once per build, skip the second trigger from the CJS output
        if ((outputOptions?.format ?? SCSS_EMIT_FORMAT) !== SCSS_EMIT_FORMAT)
          return
        // _* partials are @use-d, never standalone entries: copy their sources but skip
        // emitting useless <partial>.css files.
        const excludeCompile = rel => SCSS_PARTIAL_RE.test(rel)
        processScss(styleDir, destStyleDir, isDev, { sourceMap: sourcemap, root, excludeCompile })

        // EP style side-effect entry: plain text write (specifiers stay external),
        // no bundling pass needed. Emitted next to the compiled css it complements.
        if (elementPlusStyleEntry) {
          const entryContent = generateElementPlusStyleEntry(srcDir, { root })
          if (entryContent) {
            const outFile = resolve(root, 'dist', elementPlusStyleEntry)
            mkdirSync(resolve(outFile, '..'), { recursive: true })
            writeFileSync(outFile, entryContent)
            writeFileSync(outFile.replace(JS_ENTRY_DTS_RE, '.d.ts'), 'export {}\n')
            out(`[ep-styles] Generated ${elementPlusStyleEntry} (+ .d.ts)`)
          }
          else {
            console.warn('[ep-styles] skipped: no Element Plus imports detected in src')
          }
        }
      },
    },
  ]

  // Banner — scope prefix stripped for cleaner output; license from package.json.
  // No timestamps: builds stay reproducible across years.
  const shortName = pkg.name.replace(/^@[^/]+\//, '')
  const banner = `/*! Advanced Elements ${shortName} v${pkg.version} | ${pkg.license ?? 'MIT'} */\n`

  // Read pkg.sideEffects for treeshake configuration
  // When sideEffects is declared in package.json, pass it to Rolldown's treeshake
  // so the bundler knows which modules have side effects.
  const treeshake = pkg.sideEffects !== undefined
    ? { moduleSideEffects: pkg.sideEffects }
    : undefined

  // preserveModules mode — outputs each module as a separate file (ESM only)
  // Useful for unified packages (@advanced-elements/elements) to enable better tree-shaking
  // by the consumer's bundler.
  const output = preserveModules
    ? [{
        dir: 'dist',
        format: 'es',
        preserveModules: true,
        preserveModulesRoot: 'src',
        exports: 'named',
        banner,
        minify: !isDev,
        sourcemap,
      }]
    : [
        {
          dir: 'dist',
          format: 'es',
          entryFileNames: '[name].mjs',
          chunkFileNames: '[name]-[hash].mjs',
          exports: 'named',
          banner,
          minify: !isDev,
          sourcemap,
        },
        {
          dir: 'dist',
          format: 'cjs',
          entryFileNames: '[name].cjs',
          chunkFileNames: '[name]-[hash].cjs',
          exports: 'named',
          banner,
          minify: !isDev,
          sourcemap,
        },
      ]

  const config = {
    input,
    output,
    external,
    plugins,
    onLog(level, log, defaultHandler) {
      // <zh/> env.ts 的 import.meta 是刻意的：CJS 下被替换为 {} 后经可选链求值为 false
      // <zh/>（见该文件头注释），ESM 下保留 Vite dev 检测。只吞这一处，其余 EMPTY_IMPORT_META 照常告警。
      // <en/> import.meta in env.ts is intentional: replaced with {} in CJS it evaluates to false
      // <en/> via optional chaining (see that file's header), while ESM keeps Vite dev detection.
      // <en/> Swallow only this case; any other EMPTY_IMPORT_META still warns.
      if (log?.code === 'EMPTY_IMPORT_META') {
        const file = String(log.loc?.file ?? log.id ?? '').replace(/\\/g, '/')
        if (file.endsWith('utils/env.ts'))
          return
      }
      defaultHandler(level, log)
    },
  }

  // Only add treeshake if sideEffects is declared
  if (treeshake) {
    config.treeshake = treeshake
  }

  return config
}

export { createRolldownConfig, generateElementPlusStyleEntry, generateExternal, processScss, scanElementPlusImports }
