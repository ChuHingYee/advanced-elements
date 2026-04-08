# @advanced-elements/elements

> 🌐 Languages: [中文](./README.md) · **English**

Unified export package. Aggregates the `@advanced-elements/*` family into one package — install once, use everything.

## Install

```bash
pnpm add @advanced-elements/elements
```

## Usage

### Named imports (recommended)

```vue
<script setup lang="ts">
import { AdvTable } from '@advanced-elements/elements'
import '@advanced-elements/elements/style'
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
app.use(AdvancedElements) // registers AdvTable and all other components
```

### Type imports

```ts
import type { AdvColumn } from '@advanced-elements/elements'
```

## Included components

| Component | Source package | Description |
| --- | --- | --- |
| AdvTable | `@advanced-elements/table` | Enhanced table component |
| AdvConfigProvider | `@advanced-elements/config-provider` | Global config injection |

> Only the table and global config components are published today (plus their composables / utils / types re-exports). Form components (`AdvForm`, etc.) are not published yet — rely on this package's actual exports.

## Unified export vs direct sub-package

| Approach | Install | Import |
| --- | --- | --- |
| Unified export (recommended) | `@advanced-elements/elements` | install once, import freely |
| Direct sub-package | `@advanced-elements/table` | install on demand, import on demand |

With named imports, the unified package adds **no extra bundle size** thanks to ESM tree-shaking and Vite/Rollup optimization. Global install (`app.use(AdvancedElements)`) registers all components and is best for quick prototyping only.
