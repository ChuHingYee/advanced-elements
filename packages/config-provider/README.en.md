# @advanced-elements/config-provider

> 🌐 Languages: [中文](./README.md) · **English**

Global config provider for the `@advanced-elements/*` family — supplies global defaults (locale, size, zIndex, etc.), typically used together with `@advanced-elements/table`.

## Install

```bash
pnpm add @advanced-elements/config-provider
```

## Usage

```ts
import { createApp } from 'vue'
import { AdvConfigProvider } from '@advanced-elements/config-provider'

const app = createApp(App)
app.use(AdvConfigProvider)
```

```vue
<template>
  <AdvConfigProvider :locale="zhCn" :size="'small'">
    <AdvTable :columns="columns" :data="data" />
  </AdvConfigProvider>
</template>
```

## License

MIT © ChuHingYee
