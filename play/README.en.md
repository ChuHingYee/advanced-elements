# play (local dev playground)

> 🌐 Languages: [中文](./README.md) · **English**

Local playground for the component library: Vite dev server with HMR on each package's `src`. Not published.

## Start

```bash
# from repository root
pnpm play              # = pnpm -C play dev; for a single package, run that package's dev in another terminal first
```

## Direct source (no build needed)

`play/vite.config.ts` dev aliases + tsconfig paths point component/style imports directly at each package's `src`, so the playground starts without `dist`. The only `dist` dependency is `@advanced-elements/resolvers`, which `vite.config` consumes on the Node side; `predev` (`scripts/ensure-play-deps.mjs`) auto-builds it when missing.

To focus on a single package and reduce watch processes:

```bash
pnpm --filter @advanced-elements/table dev   # terminal 1
pnpm play                                    # terminal 2
```

## Pages

| Route | Page | Description |
| --- | --- | --- |
| `/` | Home | Entry navigation |
| `/table` | `views/TableDemo.vue` | Full-featured table demo |
| `/namespace` | `views/NamespaceDemo.vue` | Custom EP namespace four-way pairing demo |

To add a new page-level demo: add a route in `play/src/router/index.ts` and a file under `views/`.
