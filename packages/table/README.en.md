# @advanced-elements/table

[![npm version](https://img.shields.io/npm/v/@advanced-elements/table.svg)](https://www.npmjs.com/package/@advanced-elements/table)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> 🌐 Languages: [中文](./README.md) · **English**

Enterprise Vue 3 table built on Element Plus `ElTable` / `ElTableV2` — config-driven, with virtual scroll, tree, grouping, row pinning, cell editing, span, filter/sort, range selection, import/export and print.

> Online demo: [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/ChuHingYee/advanced-elements) · Full API in [`docs/components/table.md`](https://github.com/ChuHingYee/advanced-elements/blob/develop/docs/components/table.md) (props / events / slots / expose, in sync with `src/types/table-props.ts` / `table-emits.ts` / `use-table-api.ts`)

## Install

```bash
npm install @advanced-elements/table
# peer dependencies you must install once in the host app:
npm install vue element-plus @element-plus/icons-vue @vueuse/core lodash-es dayjs @advanced-elements/config-provider
# optional peers (only if you use the feature):
npm install vue-router      # urlState router sync
npm install xlsx            # Excel import/export (npm's last is 0.18.5; see Security Notes for the patched CDN build)
npm install async-validator # cross-field validation rules
```

> `@vueuse/core` and `@advanced-elements/config-provider` are **peer dependencies** (required at runtime, kept as peers to avoid duplicate copies / singleton conflicts). They are **not** auto-installed.

Import styles once in your app entry:

```ts
import '@advanced-elements/table/style' // full stylesheet (sass source + compiled css)
```

## Usage (minimal)

```vue
<script setup lang="ts">
import { AdvTable } from '@advanced-elements/table'
import '@advanced-elements/table/style'

interface Row { id: string; name: string; age: number }
const columns = [{ prop: 'name', label: 'Name' }, { prop: 'age', label: 'Age' }]
const data: Row[] = [{ id: '1', name: 'Ada', age: 36 }]
</script>

<template>
  <AdvTable<Row>
    mode="virtual"
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
  />
</template>
```

Full API (props / events / slots / expose), guides and examples live in [`docs/components/table.md`](https://github.com/ChuHingYee/advanced-elements/blob/develop/docs/components/table.md).

## Features

| Area | Notes |
| --- | --- |
| Render modes | `mode="default"` (ElTable) / `mode="virtual"` (**default**, ElTableV2 virtual scroll) |
| Columns | setting / grouping / drag reorder / collapse / resize / persisted state |
| Sort | multi-column, optional Web Worker |
| Filter | column filter / quick search / external filter / floating filter / side panel |
| Selection | single / multiple / cross-page / current-page select-all / eligibility predicate |
| Editing | editor registry / batch edit / undo-redo / cell + cross-field validation |
| Cells | Excel-style range selection / clipboard copy-paste |
| Span | row / column / range merging |
| Hierarchy | tree / row grouping / expand detail rows / pinned rows |
| Drag | row drag / column drag (vue-draggable-plus) |
| Context menu | built-in copy / clear / edit / sort-filter reset / import-export, customizable |
| IO | CSV/Excel export-import (`xlsx` optional) / print |
| State sync | URL state sync (pagination / search) |
| i18n | built-in `zhCn` / `en`, custom locale via `advLocaleKey` |
| Extension | interceptors / editor registry (`registerCellEditor`) / filter registry (`registerFilterType`) |
| Errors | render error boundary + structured `@error` events (`TABLE_*` codes) |

## Compatibility

| Dependency | Supported range | Tested |
| --- | --- | --- |
| `vue` | `^3.5.0` | 3.5.x |
| `element-plus` | `^2.14.0` | 2.14.x (minor upgrades need regression: see `EP-UPGRADE-CHECKLIST.md`) |
| `typescript` | `^5.0.0` (types built with 5.9) | 5.9.x |
| `node` (build/dev) | monorepo dev requires `>=22`; published package runtime has no node requirement | — |
| browsers | Chrome/Edge ≥ 94, Firefox ≥ 93, Safari/iOS ≥ 15.4 | — |
| SSR | guarded (`typeof window/document`, storage probe, `tableId` required for multi-table pages to keep hydration ids stable) | — |

Breaking changes and migration notes: see [CHANGELOG](./CHANGELOG.md).

## FAQ (misuse to avoid)

- **Default mode is `virtual`.** First render goes through ElTableV2; use `mode="default"` for the classic ElTable behavior.
- **Select-all scope follows the mode**: `default` = current page, `virtual` = all filtered rows. Mode-independent current-page select-all: `selectAllOnCurrentPage`. Always set `rowConfig.rowKey` for multi-select, tree and expand — without it selection/expansion silently breaks after data refresh. Under server-side pagination virtual's "all filtered rows" is still the current page only; cross-page selection needs `keepSelectionAcrossPages` + controlled `selectedRowKeys`, and `getSelectedRows()` / `selectionChange.rows` hold current-page rows only — resolve full rows via `meta.keys`.
- **Tree + server-side pagination is unsupported** (`TABLE_TREE_REMOTE_PAGINATION_UNSUPPORTED`): tree needs full data — use `pagination.mode="client"` or `pagination.enabled=false`. Tree and row grouping are mutually exclusive (grouping is ignored at runtime).
- **Server source + `autoParams` off = page-local sort/filter**: local-column sorts order the current page only (no refetch/page reset); column filters / `quickFilter` / `externalFilter` filter the current page only (dev warns). Declare `{ type: 'server' }` / `'custom'` sortable columns and enable `request.autoParams` for server-side behavior.
- **Editing + remote source**: sort/filter/page refetches replace `data` wholesale and discard uncommitted edits — call `saveCells()`/`discard()` first.
- **`size` / `tableLayout`** only affect `default` mode; **`estimatedRowHeight`** only affects `virtual` mode (dev hints when ignored). **`pagination.infiniteScroll`** only works in `virtual` mode.
- **Dynamic column slot names need an explicit row type** (`AdvTable<Row>`); with the default `Record<string, unknown>` slot-name typos cannot be type-checked (inherent to the "slot name = column prop" design).
- **`mode` cannot be fenced at runtime**: switching loses edit/scroll/shift-select state; prefer `v-if` recreation.

### Column-width overflow differs per mode (by design)

| Mode | Behavior when total column width exceeds the table width |
| --- | --- |
| `virtual` | Explicit overflow detection (`v2ColumnsOverflow`) forces fixed widths; header/body/summary stay pixel-aligned. |
| `default` | Overflow is handled natively by ElTable's `table-layout` (horizontal scroll). The wrapper adds no second overflow policy. |

The asymmetry is intentional: the virtual renderer owns its width math (it must emit numeric widths so header/body/summary agree), while the default renderer delegates to Element Plus. Do not expect identical overflow visuals across modes.

### `#append` slot differs per mode (by design)

| Mode | `#append` behavior |
| --- | --- |
| `default` | Native `#append` slot rendered by ElTable after the last row. |
| `virtual` | No template outlet (ElTableV2 has no `#append` slot) — append content is synthesized into a trailing data row (`dataWithAppend`). |

The asymmetry is intentional: same content, different mounting strategy. Do not report it as a missing-slot bug. Span + dynamic-grid interactions on the synthesized row only dev-warn (see `renderer-interface.ts`).

### Column fields available per mode

Most column fields work in both modes. Exceptions are documented inline in `AdvColumn` and marked `// only for virtual mode` / `// only for default mode`. The common gotcha: `flexGrow` / `flexShrink` / `maxWidth` are **virtual-only** (ElTableV2-native) and are ignored in `default` mode.

With `autoSizeColumns` on, both modes share one lower-bound rule (largest of `width` / `minWidth`, via `resolveStretchLowerBound`). Non-numeric `minWidth` (e.g. `'100px'`) counts as "no minWidth" and falls back to `width` — this replaces the former `Math.max(width, undefined)` → `NaN` path.

### Cell value formatting is `format`, not `formatter`

Some users look for `formatter`. This component uses **`format`** (with `valueGetter` for value resolution, `valueEnum` / `valueType` for display). A `formatter` key on a column is silently ignored — use `format`.

### Runtime column mutation must go through `setColumns`

The internal column list is a `shallowRef` (deep reactive proxies over a large column config are costly), so mutating a column object in place does **not** trigger a re-render. Use the exposed `setColumns(newArray)` — or replace the array reference via `v-model:columns` — whenever columns are added/removed/edited at runtime. Column drag and column resize already do this for you.

### Filter state: uncontrolled (default) or controlled

- **Uncontrolled (default)**: filtering is internal. Use `setFilter` / `resetColumnFilter` / `resetAllFilters` / `getFilterValue` / `isColumnFiltered` and listen to `@filter-change` for results.
- **Controlled**: pass `:filter-model="myFilters"` (keys are canonical column keys — the same caliber as the `filterChange` payload). Updates sync inward after a content-equality check, so echoing an equal value back from a `filterChange` listener cannot loop. Mixing the prop with `setFilter` means the last write wins.

`filterChange` mirrors `sortChange`: it fires on substantive internal filter changes and skips initialization plus content-equal rewrites (noop→real composable upgrades, re-applying an identical value).

### Custom Element Plus namespace (four-way pairing)

Element Plus lets hosts change the CSS class prefix (`el-` → `xxx-`) via `ConfigProvider namespace`. This library follows it, but **all four sides must agree** — any mismatch trips `TABLE_NAMESPACE_MISMATCH` (warn, production-visible) instead of silently breaking drag/scroll/hover lookups:

| # | Side | Where | Example |
| --- | --- | --- | --- |
| 1 | EP runtime | `<ElConfigProvider namespace="xxx">` | `namespace="xxx"` |
| 2 | This library runtime | `uiConfig.namespace` (or omit to follow EP automatically) | `:ui-config="{ namespace: 'xxx' }"` |
| 3 | This library CSS (build time) | SASS `$ep-namespace` (see `src/style/_ep-classes.scss`) | `@use '.../style/ep-classes' with ($ep-namespace: 'xxx');` **before** any `@use '.../style/index.scss'` |
| 4 | EP's own CSS (build time) | SASS `$namespace`, the EP-documented way | per Element Plus custom-namespace docs |

Rules:

- **Omit `uiConfig.namespace` whenever possible** — the table reads the EP `ConfigProvider` namespace automatically (`core.namespace`: `uiConfig.namespace ?? EP namespace ?? 'el'`). Setting both to different values is the only way to trip the mismatch error.
- **Runtime namespace switching is not supported for styles**: JS lookups follow immediately, but CSS is baked at build time — changing the prefix at runtime breaks visuals until CSS is rebuilt.
- If you ship `dist` CSS as-is, only the default `el` prefix works. Custom prefixes require building styles from source SCSS (same constraint as Element Plus itself).
- EP upgrades that rename classes: only `src/utils/ep-selectors.ts` + `src/style/_ep-classes.scss` change, regressed per `EP-UPGRADE-CHECKLIST.md` (guarded by `check:ep-props` / `check:ep-selectors`).

## Security Notes

- **xlsx (optional) known CVEs**: xlsx 0.18.x has prototype-pollution / ReDoS advisories (incl. CVE-2023-30533, CVE-2024-22363). Before enabling Excel import/export:
  - npm's last published xlsx is **0.18.5** — patched builds (≥ 0.19.3) are distributed only from the SheetJS CDN:
    `pnpm add https://cdn.sheetjs.com/xlsx-latest.tgz` (see https://docs.sheetjs.com/docs/getting-started/installation/nodejs);
  - or keep npm 0.18.5 and isolate import to trusted input; the built-in prototype-pollution guard (`sanitizeDataArray`) stays on in the import pipeline, and formula-injection sanitization runs on the export path.
- **Prefer npm install over CDN dist**: CDN bypasses peer resolution (`element-plus` / `vue-router` / `xlsx`) and lockfile auditing.

## Engineering

- **performanceProfile**: `'high' | 'low'` (prop or ConfigProvider `table.performanceProfile`). `'low'` targets low-end devices: disables scroll-desync watchdog, scroll-velocity tracking and hover mouse tracking; reconcile and range selection are unaffected.
- **browserslist**: ES2022 baseline (Chrome/Edge ≥ 94, Firefox ≥ 93, Safari/iOS ≥ 15.4).

### Slot naming

kebab-case is canonical; the camelCase spellings are kept as compatibility aliases and behave identically at runtime.

| Canonical (kebab) | Alias (camel, legacy) |
| --- | --- |
| `header-left`, `header-right`, `footer`, `footer-extra`, `empty`, `append`, `error` | — (already kebab) |
| `expand-row` | `expandRow` |
| `group-header` | `groupHeader` |

Prefer the kebab names in new code.

## Meta

- License: [MIT](./LICENSE)
- Issues: <https://github.com/ChuHingYee/advanced-elements/issues>
- Versions: `3.x` for Vue 3 (+ Element Plus 2.x); `2.x` legacy Vue 3 line; `1.x` legacy Vue 2 line.
