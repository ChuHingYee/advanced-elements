# Advanced Elements

[![CI](https://github.com/ChuHingYee/advanced-elements/actions/workflows/ci.yml/badge.svg)](https://github.com/ChuHingYee/advanced-elements/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D.svg)](https://vuejs.org/)
[![Element Plus](https://img.shields.io/badge/Element_Plus-2.14-409EFF.svg)](https://element-plus.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220.svg)](https://pnpm.io/)

An enterprise-grade component library built on **Vue 3 + Element Plus**, providing an advanced table, forms and supporting utilities in a **config-driven** way, ready to use with full type definitions.

The repository is managed as a **pnpm workspace monorepo**. Documentation is built with **VitePress**, builds use **rolldown / Rollup**, tests use **Vitest**, and orchestration uses **Turbo**.

> Local docs: `pnpm docs:dev` (build: `pnpm docs:build`)
>
> Online demo: [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/ChuHingYee/advanced-elements)

---

## Features

- **Advanced table** (`@advanced-elements/table`): wraps Element Plus `ElTable` / `ElTableV2`, supporting both `default` and `virtual` render modes.
- **Unified data pipeline**: sorting → column filtering → external filtering → derived processing, composable and chainable.
- **Built-in editing & validation**: cell / row / batch editing, rule validation, cross-field validation, undo / redo.
- **Virtual scrolling**: smooth rendering of tens of thousands of rows via `ElTableV2`.
- **Tree data / row grouping / expandable rows**: multi-dimensional data organization and display.
- **Context menu**: built-in copy / cut / paste / edit / delete / export, customizable.
- **Column state persistence**: column width, visibility, pinning and sorting saved and restored locally.
- **Import / export / print**: CSV / Excel export, Excel / CSV import, print preview.
- **Range selection / drag sorting**: cell range selection, column drag, row drag.
- **Event interceptors**: intervene before / after keyboard, edit, click and sort events.
- **Advanced capabilities**: URL state sync, polling refresh, external filters, and more.
- **Auto on-demand import** (`@advanced-elements/resolvers`): works with `unplugin-vue-components`.

---

## Package structure

| Package | Description | Version |
| --- | --- | --- |
| `@advanced-elements/elements` | Unified export package — install once, use everything | `2.1.1` |
| `@advanced-elements/table` | Advanced table component (core) | `4.0.0` |
| `@advanced-elements/config-provider` | Global default config provider | `2.1.0` |
| `@advanced-elements/resolvers` | Auto-import resolver for `unplugin-vue-components` | `2.1.0` |

---

## Quick start

### Install

```shell
# Option 1: unified export package (recommended)
pnpm add @advanced-elements/elements

# Option 2: table only
pnpm add @advanced-elements/table
```

### Usage

```vue
<script setup lang="ts">
import { AdvTable } from '@advanced-elements/elements'
import '@advanced-elements/elements/style'

const columns = [
  { prop: 'name', label: 'Name', width: 120 },
  { prop: 'age', label: 'Age', width: 80 },
  { prop: 'email', label: 'Email', minWidth: 200 },
  { prop: 'status', label: 'Status', valueType: 'select', valueEnum: { 1: 'Enabled', 0: 'Disabled' } },
]

const data = [
  { name: 'Alice', age: 28, email: 'alice@example.com', status: 1 },
  { name: 'Bob', age: 32, email: 'bob@example.com', status: 0 },
]
</script>

<template>
  <AdvTable :columns="columns" :data="data" />
</template>
```

### Global install

```ts
import { createApp } from 'vue'
import AdvancedElements from '@advanced-elements/elements'

const app = createApp(App)
app.use(AdvancedElements)
```

### Auto on-demand import

Use with `unplugin-vue-components` and `@advanced-elements/resolvers`:

```ts
// vite.config.ts
import Components from 'unplugin-vue-components/vite'
import { AdvancedElementsResolver } from '@advanced-elements/resolvers'

export default defineConfig({
  plugins: [
    Components({ resolvers: [AdvancedElementsResolver()] }),
  ],
})
```

---

## Tech stack

- **Vue 3** (`<script setup>` + TSX)
- **Element Plus** / `@element-plus/icons-vue`
- **TypeScript** 5.x, type-safety first
- **pnpm** workspace + **Turbo**
- **rolldown / Rollup** build, **VitePress** docs, **Vitest** tests

### Main dependencies

| Package | Purpose |
| --- | --- |
| `element-plus` | UI foundation |
| `@vueuse/core` | Composables |
| `dayjs` | Date handling |
| `lodash-es` | Utilities |
| `sortablejs` / `vue-draggable-plus` | Drag and drop |
| `nanoid` | Unique IDs |
| `xlsx` (optional) | Excel import / export |

---

## Scripts

Run from the repository root (pnpm + Turbo):

```shell
pnpm install            # install dependencies (pnpm required)

pnpm play              # start local playground dev server
pnpm dev:all           # start dev build for all packages

pnpm build:all         # build all packages

pnpm test              # run tests (turbo)
pnpm coverage          # run with coverage

pnpm lint              # ESLint check and auto-fix

pnpm docs:dev          # start VitePress docs locally
pnpm docs:build        # build docs

pnpm release:version   # release step 1: consume changesets, write versions/CHANGELOG
pnpm release:publish   # release step 2: build and publish
pnpm release:verify    # release dry-run: full chain on local verdaccio
pnpm docs:release      # build docs and force-push gh-pages
```

For single-package development, enter the package directory and run its scripts, e.g.:

```shell
cd packages/table
pnpm dev       # rolldown watch build
pnpm test      # vitest
pnpm build     # build and generate d.ts
```

---

## Documentation

- Component overview: `docs/components/` (table: `docs/components/table.md`)
- Local docs: `pnpm docs:dev`
- Full table API: `docs/components/table.md`
- Getting started: `docs/guide/getting-started.md`
- Online demo (StackBlitz): <https://stackblitz.com/github/ChuHingYee/advanced-elements>

---

## Development conventions

- Commit messages follow Conventional Commits (validated by `scripts/verify-commit.ts`).
- Prefer splitting files above the agreed size (about 300 lines) — see root `CONTRIBUTING.md`.
- Keep documentation and examples in sync with code.

---

## License

[MIT](./LICENSE) © ChuHingYee
