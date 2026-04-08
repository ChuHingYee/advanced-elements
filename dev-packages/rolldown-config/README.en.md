# @advanced-elements/rolldown-config

> 🌐 Languages: [中文](./README.md) · **English**

Shared build configuration based on [Rolldown](https://rolldown.rs), with an interface consistent with `@advanced-elements/rollup-config`.

## Migration guide

### 1. Replace dependencies

In the consumer's `package.json`:

```diff
  "devDependencies": {
-   "@advanced-elements/rollup-config": "workspace:*",
-   "rollup": "^4.28.0",
+   "@advanced-elements/rolldown-config": "workspace:*",
+   "rolldown": "^1.2.13",
  }
```

### 2. Update config file

Rename `rollup.config.mjs` to `rolldown.config.mjs`:

```diff
- import { createRollupPlugins } from '@advanced-elements/rollup-config'
+ import { createRolldownConfig } from '@advanced-elements/rolldown-config'

  const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))
- const config = createRollupPlugins(pkg, { input: 'src/index.ts' })
+ const config = createRolldownConfig(pkg, { input: 'src/index.ts' })
  export default config
```

### 3. Update build scripts

```diff
  "scripts": {
-   "dev": "rollup -c -w",
-   "build": "rimraf ./dist && rollup -c && vue-tsc -p tsconfig.dts.json"
+   "dev": "rolldown -c -w",
+   "build": "rimraf ./dist && rolldown -c && vue-tsc -p tsconfig.dts.json"
  }
```

## Differences from rollup-config

| Item | rollup-config | rolldown-config |
| --- | --- | --- |
| Core bundler | Rollup 4.x | Rolldown (Rust) |
| TS/JSX transpile | `rollup-plugin-esbuild` | Rolldown built-in oxc transform |
| Module resolution | `@rollup/plugin-node-resolve` | Rolldown built-in |
| CJS to ESM | `@rollup/plugin-commonjs` | Rolldown built-in |
| Minify | `@rollup/plugin-terser` | native `output.minify` |
| CSS/SCSS | `rollup-plugin-postcss` | removed; handled by built-in `processScss` calling dart-sass directly |
| Vue SFC | `@vitejs/plugin-vue` | same |
| Vue JSX | `@vitejs/plugin-vue-jsx` | same |
| Sourcemap | not supported | both JS and CSS |
| SCSS incremental compile | not supported | mtime-based cache |
| SCSS syntax | `@import` (deprecated) | `@use ... as *` |

## Exported API

```js
import { createRolldownConfig, generateExternal, processScss } from '@advanced-elements/rolldown-config'
```

- **`createRolldownConfig(pkg, options)`** — returns a complete Rolldown config object.
- **`generateExternal(pkg, externals)`** — generates the external-dependency filter (supports `optionalDependencies`).
- **`processScss(srcDir, destDir, isDev, options)`** — compiles SCSS and copies source files (incremental compile + sourcemap).

## `createRolldownConfig` options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `root` | `string` | `process.cwd()` | Package root; all paths resolve relative to it, independent of calling cwd |
| `input` | `string` | `'src/index.ts'` | Entry file |
| `isDev` | `boolean` | `NODE_ENV === 'development'` | Dev-mode flag |
| `externals` | `string[]` | `[]` | Extra externals. Transitive deps reached only via dynamic `import()` (e.g. `async-validator` via Element Plus) must also be declared here, otherwise they get bundled and duplicated |
| `styleOutput` | `string` | `'dist/style'` | Style output directory |
| `elementPlusStyleEntry` | `string \| null` | `null` | EP style side-effect entry (dist-relative path, e.g. `'style/element-plus.js'`); set to generate, omit to skip |
| `preserveModules` | `boolean` | `false` | Preserve module structure (ESM only, helps consumer tree-shaking) |
| `sourcemap` | `boolean` | `true` | Generate JS and CSS sourcemaps (for `analyze` / `size-limit` debugging; `prepack` deletes `dist/**/*.map` on publish, so package size is unaffected) |

### `elementPlusStyleEntry`

Scans source for `import { ElXxx } from 'element-plus'` and generates a side-effect JS entry that re-exports the EP style modules used internally:

```js
import 'element-plus/es/components/base/style/css';
import 'element-plus/es/components/button/style/css';
// ...
```

The descriptor matches `ElementPlusResolver`'s default (`importStyle: 'css'`) byte-for-byte, so the consumer bundler dedupes by resolved id — components already injected by the resolver are bundled once, package-exclusive components get covered, and the version is always the consumer's peer EP. A matching `.d.ts` (containing only `export {}`) is also generated for TS resolution.

Consumers must do two things (missing either silently drops styles, no build error):

1. Add an export entry (only the `import` condition; CJS/SSR use full css) and a `sideEffects` allowlist in `package.json`:
   ```json
   {
     "sideEffects": ["*.scss", "*.css", "./dist/style/element-plus.js"],
     "exports": {
       "./style/element-plus": {
         "types": "./dist/style/element-plus.d.ts",
         "import": "./dist/style/element-plus.js"
       }
     }
   }
   ```
   The allowlist is mandatory: once `sideEffects` is narrowed, a pure side-effect `.js` is treated as side-effect-free and dropped (equivalent to dropping styles, silently).
2. Components with no style directory (e.g. `ElAutoResizer`, matching resolver's `noStylesComponents`) are skipped with a warning; consumers using `importStyle: 'sass'` will still duplicate because of the different id scheme (`.../style/index`) — use the default css mode or accept the duplication.

The old "compile-time baking" scheme (`_element-plus.scss` baked into the package + `index.no-ep.css` derivative) has been removed: it baked the build-time EP version into the artifact (drifting from the consumer's runtime version) and duplicated `base` + shared components across packages; `_`-partials are no longer emitted as standalone css (source is still copied, so `@use` keeps working).

### `preserveModules`

Preserves module structure, emitting each source module as a separate file (ESM only). Used by unified packages like `@advanced-elements/elements` so the consumer bundler can tree-shake unused components better.

## Style contract (must read)

This config ships no postcss plugins, so **all styles must live in `src/style/*.scss`** and are compiled into `dist/style` by the built-in `processScss` pipeline. SFC `<style>` blocks and bare `.css` imports are silently dropped — the build-time `assert-style-contract` check throws and points at migration if it finds any, so do not bypass it.

Other style rules:

- `_`-prefixed partials are only referenced via `@use` and are no longer emitted as standalone `<partial>.css` (source is still copied to dist so `@use 'pkg/dist/style/...'` keeps working).
- The build writes nothing into `src/`: no generated artifacts land there except source copying, so there is no crash-residue problem.

## Notes

- Rolldown's chunk splitting differs from Rollup; artifact structure may vary slightly.
- Validate on the simplest package (e.g. `config-provider`) first, then migrate the rest.
- SCSS incremental compile is mtime-based; after editing `_*.scss` partials, delete `dist/style` to force a full recompile.
