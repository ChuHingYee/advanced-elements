# Internal Architecture Map — `@advanced-elements/table`

> **Audience**: maintainers of this package. Consumer-facing behavior lives in `README.md`.
> **Purpose**: a code review found that four thin forwarding layers in
> `composables/columns/` and three similarly-named request modules in `composables/data/` make
> "where does X live?" expensive. Per the review's anti-over-engineering protocol we did **not**
> force-merge them (the cost of a risky refactor exceeds the navigation benefit, and splitting/merging
> files is not a correctness problem). This document is the cheap, low-risk half of that finding.
>
> **Rule of thumb for this codebase**: extract a composable when it owns *state + lifecycle*;
> forward a value when it merely relays. If a module has no state of its own, treat it as a
> candidate for merging *the next time that file is edited anyway* — never in a standalone
> "reduce file count" pass.

## 1. Column domain — `src/composables/columns/`

Read in this order when tracing column behavior:

| Order | Module | Lines | Owns (single responsibility) |
| --- | --- | --- | --- |
| 1 | `use-columns.ts` | 545 | **Column truth source.** `localColumns` (`shallowRef` — replace the array reference to trigger), default merging (`defaultColDef → columnTypes → column`), `hidden`, `key`/id assignment, reorder, reset, `setColumns` / `touchColumns`, origin/pristine snapshots. |
| 2 | `use-columns-orchestrator.ts` | 109 | Binds `useColumns` + `useColumnCollapse` and exposes the reorder/collapse event exits. No independent state. |
| 3 | `use-column-features.ts` | 152 | Downstream column metadata that needs **both** columns and the data pipeline: categorization, column-state persistence wiring, filter panel, column group. Composition only. |
| 4 | `use-column-state.ts` | 837 | Column **persistence** (width / hidden / fixed / sort), storage adapters, debounced save, `flush-on-deactivate`, generation guards against stale restores. |
| 5 | `use-column-setting.ts` | 241 | The column-setting side panel's view model (enable/reset/order/width overrides). |
| — | `use-column-resize*.ts`, `use-column-drag.ts`, `use-column-group.ts`, `use-column-collapse.ts` | — | Single-concern features; each owns its own listeners/observers. |

`setColumns` therefore resolves to: `use-columns.ts` (implementation) → `use-columns-orchestrator.ts`
→ `use-column-features.ts` → `core/use-column-domain.ts` → `core/use-adv-table-data-columns.ts`.
That five-hop trace is the cost this map removes; the hops are intentional (upstream owns state,
downstream composes it) and are not a defect.

## 2. Request domain — `src/composables/data/`

Three similarly-named modules, three distinct jobs:

| Module | Lines | Owns |
| --- | --- | --- |
| `use-request.ts` | 506 | The **generic transport**: auto mode polling, `AbortController` + latest-request-id cancellation, retries, `onMalformed`, request-response normalization. Knows nothing about pagination. |
| `use-table-request.ts` | 977 | The **table-facing request surface**: auto vs. manual mode wiring, data-source resolution, `applyPaginationEffects` fan-out, and it *composes* `pagination-effects.ts`. Owns `requestId` echo (`setResponseData(data, requestId)`). |
| `use-remote-refetch.ts` | 242 | **Query-change → refetch policy**: debounced (300 ms) coalescing, and the single shared trigger that merges a sort + filter change in one batch into one request. Deliberately not request execution. |
| `pagination-effects.ts` | ~160 | Pagination side effects only (page log, `pageChange` emit, server refetch, server empty-page correction). Exposes `dispose()`; the setup assembly may ignore it. |

## 3. Rendering domain — `src/components/`

| Mode | Entry | Notes |
| --- | --- | --- |
| Mode switch | `core/use-renderer-adapter.ts` + `types/renderer-caps.ts` | The **only** place that branches on mode. Templates must query `caps`, never `isVirtual` (lint rule R3). |
| Renderer props | `utils/renderer-props-factory.ts` | `buildRendererProps(mode, domains)` — the single assembly point for what each renderer receives. |
| `default` | `table-renderer/TableRenderer.vue` + `use-table-renderer.ts`, `normal-column.tsx` | ElTable. Width math defers to EP. |
| `virtual` | `table-virtual-renderer/TableVirtualRenderer.vue` + `use-v2-*.ts` | ElTableV2. Owns its width math (numeric widths so header/body/summary align). |
| Shared column rules | `renderer-core/column-build-shared.ts` | Predicates and shared width rules (`resolveStretchLowerBound`) that must stay identical across both renderers. |
| EP DOM access | `renderer-core/dom-adapter.ts` + `utils/ep-selectors.ts` | The **only** module allowed to hold EP class names. Guarded by `npm run check:ep-selectors` and `check:ep-props`. |

## 4. Deliberate asymmetries (do not "fix" them)

- **Column width overflow**: `virtual` detects overflow explicitly; `default` delegates to EP's
  `table-layout`. See README → "Column-width overflow differs per mode".
- **Grouped headers**: `default` recurses into `children`; `virtual` flattens to V2 leaf columns.
  Same content, different layout strategy — this is what `column-build-shared` shares and what it
  must not try to unify.
- **Grand total**: aggregation lives in the shared `use-grand-total-core`; only *splicing* differs
  (interleaved `pinnedDisplayData` vs `dataWithAppend` + pinned strips). The parity test
  (`__tests__/components/parity/`) locks both sides to one caliber.

## 5. Contract gates (CI-enforced)

| Gate | Command | Fails when |
| --- | --- | --- |
| Public API surface | `typecheck` (`vue-tsc -p tsconfig.dts.json`) | `defineExpose` drifts from `TableExpose` (bidirectional `api-contract.keys.ts` check). |
| EP props | `npm run check:ep-props` | A bound prop is a ghost key in `ElTable` / `ElTableV2`. |
| EP selectors | `npm run check:ep-selectors` | A layout-critical EP class disappears from the installed EP version. |
| Event naming | `vitest run __tests__/guards` | A `<subject>Change` event is missing from the manifest, or a removed legacy name returns. |
| Comment convention | `npm run check:comment` | Public JSDoc loses the bilingual `<zh/>` / `<en/>` form. |
